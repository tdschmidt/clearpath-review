import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Offer, ReviewCase } from "../shared/types";

const fixture = (path: string) => resolve("public/fixtures", path);
const caseId = (page: Page) =>
  new URL(page.url()).hash.slice("#review/".length).split("/")[0];
const current = (review: ReviewCase) => review.revisions.at(-1)!;

async function createSubmission(
  page: Page,
  options: {
    title: string;
    product?: "personal_loan" | "credit_card" | "mortgage";
    file?: string;
    destination?: boolean;
    destinationUrl?: string;
  },
) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "New submission", exact: true })
    .click();
  const form = page.getByRole("dialog", {
    name: "New submission",
    exact: true,
  });
  await form.getByLabel("Submission name").fill(options.title);
  await form
    .getByRole("combobox", { name: "Product", exact: true })
    .selectOption(options.product || "personal_loan");
  await form
    .getByRole("combobox", { name: /^Offer reference/ })
    .selectOption({ index: 1 });
  await form
    .getByLabel("Intended use")
    .fill(
      "Named affiliate paid social placement and supplied destination proof, September 2026.",
    );
  await form
    .getByLabel("Accompanying copy")
    .fill("No origination fee. Explore your ClearPath offer.");
  if (options.destinationUrl)
    await form.getByLabel("Destination URL").fill(options.destinationUrl);
  await form.getByLabel("Submitted by", { exact: true }).fill("Taylor Partner");
  await form.getByLabel("Contact email").fill("taylor@example.com");
  const files = [fixture(options.file || "loan/v1/social-ad.png")];
  if (options.destination) files.push(fixture("loan/v3/destination.pdf"));
  await form.locator("input[type=file]").setInputFiles(files);
  if (options.destination)
    await form
      .getByLabel("Role for destination.pdf")
      .selectOption("destination");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/cases") &&
      response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Create submission" }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  const review: ReviewCase = await response.json();
  await expect(
    page.getByRole("heading", { name: options.title, exact: true }),
  ).toBeVisible();
  await expect(form).not.toBeVisible();
  return review;
}

async function action(page: Page, click: () => Promise<unknown>) {
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/cases/${caseId(page)}/actions`) &&
      response.request().method() === "POST",
  );
  await click();
  const saved = await response;
  expect(saved.ok()).toBeTruthy();
  return (await saved.json()) as ReviewCase;
}

async function confirmIntake(page: Page) {
  const review = await action(page, () =>
    page.getByRole("button", { name: "Confirm package" }).click(),
  );
  await expect(
    page.getByRole("button", { name: "Confirm package" }),
  ).not.toBeVisible();
  return review;
}

async function addFinding(
  page: Page,
  finding: { title: string; kind: "correction" | "evidence"; request: string },
) {
  await page.getByRole("button", { name: "Add finding", exact: true }).click();
  const dialog = page.locator(".rw-editor");
  await dialog
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption(finding.kind);
  await dialog.getByLabel("Finding", { exact: true }).fill(finding.title);
  await dialog
    .getByRole("combobox", { name: "Audience", exact: true })
    .selectOption("submitter");
  await dialog
    .getByRole("combobox", { name: "Related material", exact: true })
    .selectOption("");
  await dialog.getByLabel("Location").fill("Accompanying copy");
  await dialog
    .getByLabel("Observation and supporting basis")
    .fill(
      "Human review against the supplied fictional offer reference; the stated claim requires correction or support.",
    );
  await dialog.getByLabel("Requested action").fill(finding.request);
  const review = await action(page, () =>
    dialog.getByRole("button", { name: "Add finding", exact: true }).click(),
  );
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: finding.title, exact: true }),
  ).toBeVisible();
  return review;
}

async function submitRevision(
  page: Page,
  options: { copy: string; replaceImage?: boolean; destinationUrl?: string },
) {
  await page.getByRole("button", { name: "Add revision", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Submit an updated package",
  });
  if (options.replaceImage) {
    await dialog
      .locator(".retain-row")
      .filter({ hasText: "social-ad.png" })
      .locator("input[type=file]")
      .setInputFiles(fixture("loan/v2/social-ad.png"));
  }
  await dialog.getByLabel("Accompanying copy").fill(options.copy);
  if (options.destinationUrl)
    await dialog.getByLabel("Destination URL").fill(options.destinationUrl);
  await dialog
    .getByLabel("Revision note")
    .fill(
      "Updated the caption and identified changed material. Other evidence remains under review.",
    );
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/cases/${caseId(page)}/revisions`) &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Save new version" }).click();
  const response = await saved;
  expect(response.ok()).toBeTruthy();
  await expect(dialog).not.toBeVisible();
  return (await response.json()) as ReviewCase;
}

async function resolveFinding(page: Page, title: string, reason: string) {
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await card.getByRole("button", { name: "Resolve", exact: true }).click();
  const dialog = page.locator(".rw-editor");
  await dialog.getByRole("textbox").fill(reason);
  const review = await action(page, () =>
    dialog.getByRole("button", { name: "Save", exact: true }).click(),
  );
  await expect(dialog).not.toBeVisible();
  return review;
}

test("a real visual package keeps partial findings, private notes, and exact-version approval intact", async ({
  page,
}) => {
  const earlierDestination = "https://clearpath.example/personal-loans/initial";
  const currentDestination = "https://clearpath.example/personal-loans/revised";
  const initial = await createSubmission(page, {
    title: "Browser review · partial correction",
    destination: true,
    destinationUrl: earlierDestination,
  });
  const offers: Offer[] = await (await page.request.get("/api/offers")).json();
  const offer = offers.find((item) => item.id === current(initial).offerId)!;
  expect(initial.findings).toEqual([]);
  expect(
    current(initial).components.map((component) => component.role),
  ).toEqual(["creative", "destination"]);
  await expect(
    page.getByRole("heading", { name: "No open findings" }),
  ).toBeVisible();
  const sourceImage = initial.assets.find(
    (asset) => asset.name === "social-ad.png",
  )!;
  const image = page.getByRole("img", {
    name: "Submitted creative: social-ad.png",
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth))
    .toBeGreaterThan(0);
  const original = await page.request.get(
    `/api/cases/${initial.id}/assets/${sourceImage.id}`,
  );
  expect(await original.body()).toEqual(
    readFileSync(fixture("loan/v1/social-ad.png")),
  );

  await page
    .getByRole("combobox", { name: "File", exact: true })
    .selectOption({ label: "destination.pdf · Destination" });
  await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await expect(page.locator("canvas.pdf-canvas")).toBeVisible();
  await confirmIntake(page);
  await addFinding(page, {
    title: "Correct fee claim",
    kind: "correction",
    request: "Replace the unsupported no-origination-fee caption.",
  });
  await addFinding(page, {
    title: "Confirm intended placement",
    kind: "evidence",
    request: "Supply confirmation of the named affiliate placement and dates.",
  });

  const internalNote =
    "INTERNAL ONLY: hold the partner discussion until the account team confirms context.";
  await page.getByRole("tab", { name: "History & notes", exact: true }).click();
  await page.getByLabel("Note", { exact: true }).fill(internalNote);
  await action(page, () =>
    page.getByRole("button", { name: "Save note", exact: true }).click(),
  );
  await expect(
    page.locator(".rw-notes").getByText(internalNote, { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Review", exact: true }).click();
  await page
    .getByRole("button", { name: "Prepare feedback", exact: true })
    .last()
    .click();
  const draft = page.getByRole("dialog", {
    name: "Prepare a reply",
    exact: true,
  });
  await expect(
    draft.getByRole("textbox", { name: "Message", exact: true }),
  ).toHaveValue(/Replace the unsupported no-origination-fee caption/);
  await expect(
    draft.getByRole("textbox", { name: "Message", exact: true }),
  ).not.toHaveValue(/INTERNAL ONLY/);
  const withDraft = await action(page, () =>
    draft.getByRole("button", { name: "Save draft", exact: true }).click(),
  );
  expect(withDraft.drafts[0].status).toBe("prepared");
  expect(withDraft.drafts[0].body).not.toContain(internalNote);
  await page
    .getByRole("tab", { name: "Feedback & replies", exact: true })
    .click();
  await expect(page.getByText("Prepared", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Review", exact: true }).click();

  const revised = await submitRevision(page, {
    copy: "An origination fee may apply. Explore your ClearPath offer.",
    replaceImage: true,
    destinationUrl: currentDestination,
  });
  expect(revised.revisions).toHaveLength(2);
  expect(revised.revisions[0]).toEqual(initial.revisions[0]);
  const destinationId = initial.assets.find(
    (asset) => asset.name === "destination.pdf",
  )!.id;
  expect(current(revised).components).toContainEqual({
    assetId: destinationId,
    role: "destination",
  });
  expect(
    current(revised).components.some(
      (component) => component.assetId === sourceImage.id,
    ),
  ).toBe(false);
  expect(revised.findings.every((finding) => finding.status === "open")).toBe(
    true,
  );
  const confirmed = await confirmIntake(page);
  await page
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  const blocked = page.getByRole("dialog", { name: "Record your decision" });
  await expect(
    blocked.getByText("Not ready for approval", { exact: true }),
  ).toBeVisible();
  await expect(
    blocked.getByRole("button", { name: "Record approval", exact: true }),
  ).toBeDisabled();
  // Verify that disabling the button is backed by the server, not only the UI.
  const bypass = await page.request.post(`/api/cases/${initial.id}/actions`, {
    data: {
      expectedVersion: confirmed.version,
      type: "decide",
      outcome: "approved",
      scope: "Attempted approval with open findings",
      rationale: "Test the approval gate",
      reviewed: true,
    },
  });
  expect(bypass.status()).toBe(409);
  expect((await bypass.json()).code).toBe("unresolved_findings");
  await blocked.getByRole("button", { name: "Back to review" }).click();

  const partial = await resolveFinding(
    page,
    "Correct fee claim",
    "Inspected the revised caption and image against the supplied offer reference.",
  );
  expect(
    partial.findings.find(
      (finding) => finding.title === "Confirm intended placement",
    )?.status,
  ).toBe("open");
  await expect(
    page.getByRole("heading", {
      name: "Confirm intended placement",
      exact: true,
    }),
  ).toBeVisible();
  await resolveFinding(
    page,
    "Confirm intended placement",
    "Confirmed that the stated placement and dates match the submitted context.",
  );
  await page
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  const decision = page.getByRole("dialog", { name: "Record your decision" });
  const scope =
    "Version 2 image, accompanying copy, and supplied destination proof for the named affiliate placement in September 2026.";
  const internalRationale =
    "INTERNAL DECISION: reviewed both pages and revised creative; account-team discussion remains internal.";
  await decision.getByLabel("Scope of this decision").fill(scope);
  await decision.getByLabel("Decision rationale").fill(internalRationale);
  await decision.getByRole("checkbox").check();
  const approved = await action(page, () =>
    decision
      .getByRole("button", { name: "Record approval", exact: true })
      .click(),
  );
  expect(approved.decisions[0].revisionId).toBe(current(approved).id);
  expect(approved.decisions[0].scope).toBe(scope);
  expect(approved.decisions[0].rationale).toBe(internalRationale);
  await page
    .getByRole("button", { name: "View decision", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Approved for the stated use",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(internalRationale, { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Prepare result", exact: true })
    .click();
  const decisionReply = page.getByRole("dialog", {
    name: "Prepare a reply",
    exact: true,
  });
  const decisionBody = decisionReply.getByRole("textbox", {
    name: "Message",
    exact: true,
  });
  await expect(decisionBody).toHaveValue("");
  await expect(decisionReply.getByText(scope, { exact: true })).toBeVisible();
  await decisionBody.fill(`Approved for ${scope}`);
  const savedReply = await action(page, () =>
    decisionReply
      .getByRole("button", { name: "Save draft", exact: true })
      .click(),
  );
  expect(savedReply.drafts.at(-1)?.body).toContain(scope);
  expect(savedReply.drafts.at(-1)?.body).not.toContain("INTERNAL DECISION");
  await page.reload();
  await expect(page.getByText(scope, { exact: true })).toBeVisible();
  await expect(
    page.getByText(internalRationale, { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "History & notes", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download internal record", exact: true })
    .click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(
    `${approved.reference}-review-record.zip`,
  );
  expect(await download.failure()).toBeNull();
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const archive = readFileSync(downloadedPath!);
  expect(archive.subarray(0, 4).toString("hex")).toBe("504b0304");
  expect(archive.length).toBeGreaterThan(1000);
  await page.getByRole("tab", { name: /^Versions/ }).click();
  await expect(
    page.getByRole("heading", { name: "Earlier · version 1", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Current · version 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Accompanying copy changed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No origination fee. Explore your ClearPath offer.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "An origination fee may apply. Explore your ClearPath offer.",
      { exact: true },
    ),
  ).toBeVisible();
  const earlierPanel = page.locator(".rw-compare-grid > section").filter({
    has: page.getByRole("heading", {
      name: "Earlier · version 1",
      exact: true,
    }),
  });
  const currentPanel = page.locator(".rw-compare-grid > section").filter({
    has: page.getByRole("heading", {
      name: "Current · version 2",
      exact: true,
    }),
  });
  await expect(
    earlierPanel.getByText(`${offer.name} · ${offer.version}`, { exact: true }),
  ).toBeVisible();
  await expect(
    currentPanel.getByText(`${offer.name} · ${offer.version}`, { exact: true }),
  ).toBeVisible();
  await expect(
    earlierPanel.getByText(earlierDestination, { exact: true }),
  ).toBeVisible();
  await expect(
    earlierPanel.getByText(currentDestination, { exact: true }),
  ).not.toBeVisible();
  await expect(
    currentPanel.getByText(currentDestination, { exact: true }),
  ).toBeVisible();
});

test("credit-card and mortgage submissions use the same human intake without seeded findings", async ({
  page,
}) => {
  for (const scenario of [
    {
      product: "credit_card" as const,
      file: "card/social-ad.png",
      title: "Fresh card promotion",
    },
    {
      product: "mortgage" as const,
      file: "mortgage/social-ad.jpg",
      title: "Fresh mortgage prequalification",
    },
  ]) {
    const created = await createSubmission(page, scenario);
    expect(created.product).toBe(scenario.product);
    expect(created.example).toBe(false);
    expect(created.findings).toEqual([]);
    const confirmed = await confirmIntake(page);
    expect(confirmed.status).toBe("in_review");
    expect(confirmed.findings).toEqual([]);
    await expect(
      page.getByRole("heading", { name: "No open findings" }),
    ).toBeVisible();
    await expect(page.getByText(/Fictional/i).first()).toBeVisible();
  }
});

test("a stale browser tab cannot approve a package changed in another tab", async ({
  page,
  context,
}) => {
  const created = await createSubmission(page, {
    title: "Concurrent review safeguard",
  });
  await confirmIntake(page);
  await page
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  const decision = page.getByRole("dialog", { name: "Record your decision" });
  await decision
    .getByLabel("Decision rationale")
    .fill("Reviewed the originally submitted version.");
  await decision.getByRole("checkbox").check();

  const editor = await context.newPage();
  await editor.goto(page.url());
  const revised = await submitRevision(editor, {
    copy: "This is a changed offer claim that requires a new review.",
  });
  const denied = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/cases/${created.id}/actions`) &&
      response.request().method() === "POST",
  );
  await decision
    .getByRole("button", { name: "Record approval", exact: true })
    .click();
  expect((await denied).status()).toBe(409);
  await expect(decision.getByRole("alert")).toBeVisible();
  const stored = await page.request.get(`/api/cases/${created.id}`);
  const latest: ReviewCase = await stored.json();
  expect(latest.decisions).toEqual([]);
  expect(latest.status).toBe("needs_intake");
  expect(current(latest).id).toBe(current(revised).id);
  await expect(decision.getByLabel("Decision rationale")).toHaveValue(
    "Reviewed the originally submitted version.",
  );
  await expect(decision.getByRole("checkbox")).not.toBeChecked();
  await decision.getByRole("button", { name: "Back to review" }).click();
  await expect(
    page.getByText(
      "This is a changed offer claim that requires a new review.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm package", exact: true }),
  ).toBeVisible();
  await editor.close();
});

test("a finding preserves its exact PDF page and source while the reviewer edits", async ({
  page,
}) => {
  const initial = await createSubmission(page, {
    title: "Exact page and retained reasoning",
    destination: true,
  });
  await confirmIntake(page);
  await page
    .getByRole("combobox", { name: "File", exact: true })
    .selectOption({ label: "destination.pdf · Destination" });
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByText("Page 2 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add finding", exact: true }).click();
  const editor = page.locator(".rw-editor");
  await editor
    .getByLabel("Finding", { exact: true })
    .fill("Inspect terms disclosure");
  await editor
    .getByLabel("Observation and supporting basis")
    .fill("Compare the terms rendition with the preserved product source.");
  await editor
    .getByLabel("Requested action")
    .fill("Confirm this disclosure applies to the supplied campaign.");
  await editor.getByLabel("Location note").fill("Terms paragraph");
  await page
    .getByRole("button", { name: "Source · p. 1", exact: true })
    .first()
    .click();
  await expect(page.locator(".rw-source")).toBeVisible();
  await expect(editor.getByLabel("Finding", { exact: true })).toHaveValue(
    "Inspect terms disclosure",
  );
  await editor
    .getByRole("button", { name: "Attach the source page currently shown" })
    .click();
  await editor.getByRole("button", { name: "Keep draft", exact: true }).click();
  await page.getByRole("button", { name: "Add finding", exact: true }).click();
  await expect(editor.getByLabel("Finding", { exact: true })).toHaveValue(
    "Inspect terms disclosure",
  );
  const saved = await action(page, () =>
    editor.getByRole("button", { name: "Add finding", exact: true }).click(),
  );
  expect(saved.findings[0].owner).toBe(initial.owner);
  expect(saved.findings[0].audience).toBe("internal");
  expect(saved.findings[0].citations?.[0]).toMatchObject({
    revisionId: current(initial).id,
    page: 2,
  });
  expect(saved.findings[0].sourceCitations?.[0]).toMatchObject({
    offerId: current(initial).offerId,
    page: 1,
  });
  await submitRevision(page, {
    copy: "Changed accompanying copy for a second version.",
  });
  await page
    .getByRole("button", { name: /^v1 · destination.pdf · p. 2/ })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Material version" }),
  ).toHaveValue(current(initial).id);
  await expect(
    page.locator(".rw-material").getByText("Page 2 of 2", { exact: true }),
  ).toBeVisible();
  const pageInput = page.locator(".rw-material").getByRole("spinbutton");
  await pageInput.fill("99");
  await expect(page.locator(".rw-material").getByRole("alert")).toContainText(
    "99",
  );
  await expect(page.locator(".rw-material canvas")).not.toBeVisible();
  await pageInput.fill("2");
  await expect(page.locator(".rw-material .pdf-text-layer")).toContainText(
    "Before you borrow",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".rw-material")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBeTruthy();
});
