import { expect, test, type APIRequestContext } from "@playwright/test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import type {
  CaseAction,
  Offer,
  ReviewCase,
  SubmitterCase,
  SubmitterReceipt,
} from "../shared/types";

const fixture = (path: string) => resolve("public/fixtures", path);
async function createExternalDraftCase(
  request: APIRequestContext,
  title: string,
) {
  const response = await request.post("/api/submissions", {
    multipart: {
      payload: JSON.stringify({
        title,
        product: "personal_loan",
        submitter: "Taylor Partner",
        submittedBy: "Taylor Partner",
        submitterEmail: "taylor@example.com",
        channel: "Paid social",
        launchDate: "2026-10-12",
        advertisedOffer: "Standard loan",
        intendedUse: "Named affiliate social placement in California.",
        copy: "Original version-one copy.",
        destinationUrl: "",
        summary: "Initial package",
        fileRoles: ["creative"],
      }),
      files: {
        name: "social-ad.png",
        mimeType: "image/png",
        buffer: readFileSync(fixture("loan/v1/social-ad.png")),
      },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as SubmitterReceipt;
}
async function concurrentExternalRevision(
  request: APIRequestContext,
  token: string,
  copy: string,
) {
  const latest: SubmitterCase = await (
    await request.get(`/api/submissions/${token}`)
  ).json();
  const base = latest.revisions.at(-1)!;
  const response = await request.post(`/api/submissions/${token}/revisions`, {
    multipart: {
      payload: JSON.stringify({
        expectedVersion: latest.version,
        submittedBy: "Another collaborator",
        summary: "Updated by another collaborator",
        product: base.product,
        channel: base.channel,
        launchDate: base.launchDate,
        advertisedOffer: base.advertisedOffer,
        intendedUse: base.intendedUse,
        copy,
        destinationUrl: base.destinationUrl,
        retainedComponents: base.components.map(({ assetId, role }) => ({
          assetId,
          role,
        })),
        fileRoles: [],
        replacements: [],
      }),
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as SubmitterCase;
}
type Action = CaseAction extends infer A
  ? A extends { expectedVersion: number }
    ? Omit<A, "expectedVersion">
    : never
  : never;
async function internalAction(
  request: APIRequestContext,
  id: string,
  input: Action,
) {
  const review: ReviewCase = await (
    await request.get(`/api/cases/${id}`)
  ).json();
  const response = await request.post(`/api/cases/${id}/actions`, {
    data: { ...input, actorId: "maya", expectedVersion: review.version },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as ReviewCase;
}

test("all shared requests remain actionable across feedback batches, and only explicit reviewer updates show acceptance", async ({
  page,
}) => {
  const receipt = await createExternalDraftCase(
    page.request,
    "Shared request follow-through",
  );
  const cases: ReviewCase[] = await (
    await page.request.get("/api/cases")
  ).json();
  let review = cases.find(
    (item) => item.reference === receipt.submission.reference,
  )!;
  const offers: Offer[] = await (await page.request.get("/api/offers")).json();
  review = await internalAction(page.request, review.id, {
    type: "confirm_intake",
    offerId: offers.find((offer) => offer.product === "personal_loan")!.id,
  });
  const initial = receipt.submission.revisions[0];
  const add = async (title: string, material = true) => {
    review = await internalAction(page.request, review.id, {
      type: "add_finding",
      finding: {
        kind: "evidence",
        title,
        detail: "PRIVATE_REQUEST_REASONING",
        request: `Please address ${title}.`,
        location: "Headline on the submitted creative",
        assetId: initial.components[0].assetId,
        owner: "Taylor Partner",
        material,
        audience: "submitter",
        citations: [
          {
            revisionId: initial.id,
            assetId: initial.components[0].assetId,
            page: 1,
            note: "Check the fee statement in the original headline.",
          },
        ],
      },
    });
    return review.findings.at(-1)!;
  };
  const first = await add("A: substantiate fee terms");
  const second = await add("B: confirm placement");
  review = await internalAction(page.request, review.id, {
    type: "publish_feedback",
    findingIds: [first.id, second.id],
    subject: "First review message",
    body: "Please address the terms and placement.",
  });
  const third = await add("C: consider a clearer caption", false);
  review = await internalAction(page.request, review.id, {
    type: "publish_feedback",
    findingIds: [third.id],
    subject: "Later caption advice",
    body: "One additional suggestion.",
  });

  await page.goto(`/submit/${receipt.token}`);
  const requests = page.getByRole("region", {
    name: "Requests from the reviewer",
  });
  const firstCard = requests.getByRole("article", {
    name: `F${String(first.number).padStart(2, "0")}: ${first.title}`,
  });
  const secondCard = requests.getByRole("article", {
    name: `F${String(second.number).padStart(2, "0")}: ${second.title}`,
  });
  const thirdCard = requests.getByRole("article", {
    name: `F${String(third.number).padStart(2, "0")}: ${third.title}`,
  });
  await expect(firstCard).toBeVisible();
  await expect(secondCard).toBeVisible();
  await expect(thirdCard).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "First review message" }),
  ).not.toBeVisible();
  const cited = firstCard.getByRole("link", {
    name: "social-ad.png · version 1 · page 1",
  });
  await expect(cited).toHaveAttribute(
    "href",
    `/api/submissions/${receipt.token}/assets/${initial.components[0].assetId}#page=1`,
  );
  expect(
    (
      await page.request.get((await cited.getAttribute("href"))!.split("#")[0])
    ).ok(),
  ).toBeTruthy();

  await page
    .getByLabel("Your response", { exact: true })
    .fill("Here is the fee evidence requested in the first message.");
  await page
    .getByLabel("Supporting evidence")
    .setInputFiles(fixture("loan/v3/destination.pdf"));
  await firstCard.getByRole("button", { name: /^Respond to/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Your response", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Your response", exact: true }),
  ).toHaveValue("Here is the fee evidence requested in the first message.");
  await page
    .getByText("Link this response to feedback · 1 selected", { exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: new RegExp(first.title) }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: new RegExp(third.title) }),
  ).not.toBeChecked();
  const responded = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/submissions/${receipt.token}/responses`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send response to review" }).click();
  const external: SubmitterCase = await (await responded).json();
  const response = external.responses.at(-1)!;
  expect(response.findingIds).toEqual([first.id]);
  expect(response.assetIds).toHaveLength(1);
  await expect(
    firstCard.getByText("Response received · awaiting reviewer assessment", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    secondCard.getByText("Action requested", { exact: true }),
  ).toBeVisible();
  await expect(
    thirdCard.getByText("Advice available", { exact: true }),
  ).toBeVisible();

  await internalAction(page.request, review.id, {
    type: "assess_response",
    responseId: response.id,
    note: "PRIVATE_ASSESSMENT_NOTE",
    sharedMessage:
      "We have read the attachment and will confirm the request outcome separately.",
  });
  await internalAction(page.request, review.id, {
    type: "disposition",
    findingId: first.id,
    status: "resolved",
    reason: "PRIVATE_RESOLUTION_BASIS",
    responseIds: [response.id],
  });
  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(
    firstCard.getByText("Action requested", { exact: true }),
  ).toBeVisible();
  await expect(firstCard.getByText(/Accepted by reviewer/)).toHaveCount(0);
  await expect(
    page.getByText(
      "We have read the attachment and will confirm the request outcome separately.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page.getByText(/PRIVATE_/)).toHaveCount(0);

  await internalAction(page.request, review.id, {
    type: "disposition",
    findingId: first.id,
    status: "resolved",
    reason: "PRIVATE_EXPLICIT_ACCEPTANCE_BASIS",
    responseIds: [response.id],
    shareWithSubmitter: true,
  });
  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(
    firstCard.getByText("Accepted by reviewer · version 1", { exact: true }),
  ).toBeVisible();
  await expect(
    secondCard.getByText("Action requested", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/PRIVATE_/)).toHaveCount(0);

  await concurrentExternalRevision(
    page.request,
    receipt.token,
    "Version two changes the advertised fee.",
  );
  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(
    firstCard.getByText("Action requested", { exact: true }),
  ).toBeVisible();
  await expect(
    firstCard.getByText(
      "The earlier request update covered version 1. Version 2 still needs assessment.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(firstCard.getByText(/Accepted by reviewer/)).toHaveCount(0);
  await expect(cited).toHaveAttribute(
    "href",
    `/api/submissions/${receipt.token}/assets/${initial.components[0].assetId}#page=1`,
  );
});

test("an external submitter returns to shared feedback, supplies real revisions, and sees only a published scoped decision", async ({
  page,
}) => {
  await page.goto("/submit");
  await expect(page.getByRole("link", { name: "Review queue" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Record decision" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Campaign or submission name")
    .fill("Northstar external campaign");
  await page
    .getByLabel("Which offer are you promoting?")
    .fill("Standard personal loan from our September brief");
  await page
    .getByLabel("Where and how will the material be used?")
    .fill(
      "Northstar affiliate paid social in California, October 2026, with the supplied destination.",
    );
  await page.getByLabel("Target launch date").fill("2026-10-12");
  await page.getByLabel("Your name or team").fill("Nina at Northstar");
  await page.getByLabel("Contact email").fill("nina@example.com");
  await page
    .getByLabel("Accompanying advertising copy")
    .fill("No origination fee. Explore your ClearPath personal loan.");
  await page
    .locator('.partner-package-form input[type="file"]')
    .setInputFiles(fixture("loan/v1/social-ad.png"));
  const received = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/submissions") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Submit for review", exact: true })
    .click();
  const initialResponse = await received;
  expect(initialResponse.status()).toBe(201);
  const receipt: SubmitterReceipt = await initialResponse.json();
  await expect(
    page.getByRole("heading", {
      name: "Received. Your material is waiting for review.",
    }),
  ).toBeVisible();
  expect(page.url()).toContain(`/submit/${receipt.token}`);
  await expect(page.getByLabel("Your return link")).toHaveValue(
    new RegExp(receipt.token),
  );
  expect(receipt.submission).not.toHaveProperty("findings");
  expect(receipt.submission).not.toHaveProperty("notes");
  const cases: ReviewCase[] = await (
    await page.request.get("/api/cases")
  ).json();
  const review = cases.find(
    (c) => c.reference === receipt.submission.reference,
  )!;
  const offers: Offer[] = await (await page.request.get("/api/offers")).json();
  const offer = offers.find((o) => o.product === "personal_loan")!;
  await internalAction(page.request, review.id, {
    type: "confirm_intake",
    offerId: offer.id,
  });
  const addFinding = (
    title: string,
    audience: "internal" | "submitter",
    material: boolean,
  ) =>
    internalAction(page.request, review.id, {
      type: "add_finding",
      finding: {
        kind: "correction",
        title,
        detail: "Internal reviewer reasoning against offer reference",
        request: `Requested action: ${title}`,
        location: "Social image",
        assetId: receipt.submission.assets[0].id,
        owner: audience === "internal" ? "Priya Shah" : "Nina at Northstar",
        material,
        audience,
      },
    });
  await addFinding("Correct the fee claim", "submitter", true);
  await addFinding("Supply destination proof", "submitter", true);
  await addFinding("Consider a clearer caption", "submitter", false);
  const withFindings = await addFinding(
    "INTERNAL ONLY specialist question",
    "internal",
    false,
  );
  await internalAction(page.request, review.id, {
    type: "add_note",
    text: "INTERNAL ONLY note never shared",
  });
  const publicFindings = withFindings.findings.filter(
    (f) => f.audience === "submitter",
  );
  await internalAction(page.request, review.id, {
    type: "publish_feedback",
    findingIds: publicFindings.map((f) => f.id),
    subject: "Please update the submitted campaign",
    body: "The two required items need attention; the caption suggestion is advisory.",
  });
  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(
    page.getByRole("heading", { name: "Requests from the reviewer" }),
  ).toBeVisible();
  const currentRequests = page.getByRole("region", {
    name: "Requests from the reviewer",
  });
  await expect(
    currentRequests.getByText("Required change or evidence", { exact: true }),
  ).toHaveCount(2);
  await expect(
    currentRequests.getByText("Advice", { exact: true }),
  ).toHaveCount(1);
  await expect(page.getByText("INTERNAL ONLY", { exact: false })).toHaveCount(
    0,
  );

  await page
    .getByLabel("Your response", { exact: true })
    .fill(
      "Here is evidence for the destination; the image correction will follow separately.",
    );
  await page
    .getByLabel("Supporting evidence")
    .setInputFiles(fixture("loan/v3/destination.pdf"));
  const responded = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/submissions/${receipt.token}/responses`) &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send response to review" }).click();
  expect((await responded).ok()).toBeTruthy();
  await expect(
    page.getByRole("status").filter({ hasText: "Response received" }),
  ).toBeVisible();
  await expect(page.getByLabel("Your response", { exact: true })).toHaveValue(
    "",
  );
  let stored: ReviewCase = await (
    await page.request.get(`/api/cases/${review.id}`)
  ).json();
  expect(
    stored.findings.filter((f) => f.material).every((f) => f.status === "open"),
  ).toBeTruthy();

  await page
    .getByRole("button", { name: "Submit updated package", exact: true })
    .click();
  let revisionForm = page.locator(".partner-package-form");
  await revisionForm
    .getByLabel("Replace social-ad.png", { exact: true })
    .setInputFiles(fixture("loan/v2/social-ad.png"));
  await expect(
    revisionForm.getByText("Replaced by social-ad.png", { exact: true }),
  ).toBeVisible();
  await revisionForm
    .getByLabel("Accompanying advertising copy")
    .fill("An origination fee applies. Explore your ClearPath personal loan.");
  await revisionForm
    .getByLabel("What changed?")
    .fill(
      "Replaced the image and corrected the fee claim. Destination review is still outstanding.",
    );
  let revisionSaved = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/submissions/${receipt.token}/revisions`) &&
      r.request().method() === "POST",
  );
  await revisionForm
    .getByRole("button", { name: "Submit new version" })
    .click();
  const partial: SubmitterCase = await (await revisionSaved).json();
  expect(partial.revisions).toHaveLength(2);
  expect(partial.revisions[1].components).toHaveLength(1);
  expect(partial.revisions[1].components[0].replacesAssetId).toBe(
    receipt.submission.assets[0].id,
  );
  await expect(
    currentRequests.getByText(
      "Originally shared for version 1. No acceptance has been shared for version 2.",
      { exact: true },
    ),
  ).toHaveCount(3);
  await internalAction(page.request, review.id, {
    type: "confirm_intake",
    offerId: offer.id,
  });
  await internalAction(page.request, review.id, {
    type: "disposition",
    findingId: publicFindings[0].id,
    status: "resolved",
    reason: "Inspected the corrected image and caption against source facts.",
  });
  stored = await (await page.request.get(`/api/cases/${review.id}`)).json();
  const blocked = await page.request.post(`/api/cases/${review.id}/actions`, {
    data: {
      type: "decide",
      actorId: "maya",
      expectedVersion: stored.version,
      outcome: "approved",
      scope: "Version 2 campaign",
      rationale: "Still missing a package destination",
      reviewed: true,
    },
  });
  expect(blocked.status()).toBe(409);

  // Reopen after a successful revision: the new form must carry forward v2, not stale v1 state.
  await page.getByRole("button", { name: "Check for updates" }).click();
  await page
    .getByRole("button", { name: "Submit updated package", exact: true })
    .click();
  revisionForm = page.locator(".partner-package-form");
  await expect(revisionForm.getByLabel("What changed?")).toHaveValue("");
  await expect(
    revisionForm.getByLabel("Accompanying advertising copy"),
  ).toHaveValue(
    "An origination fee applies. Explore your ClearPath personal loan.",
  );
  await revisionForm
    .locator('input[type="file"][multiple]')
    .setInputFiles(fixture("loan/v3/destination.pdf"));
  await revisionForm
    .getByRole("combobox", { name: "Role for destination.pdf", exact: true })
    .selectOption("destination");
  await revisionForm
    .getByLabel("What changed?")
    .fill(
      "Added the destination rendition to the package. The revised image is unchanged.",
    );
  revisionSaved = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/submissions/${receipt.token}/revisions`) &&
      r.request().method() === "POST",
  );
  await revisionForm
    .getByRole("button", { name: "Submit new version" })
    .click();
  const complete: SubmitterCase = await (await revisionSaved).json();
  expect(complete.revisions).toHaveLength(3);
  expect(complete.revisions[2].components.map((c) => c.role)).toEqual([
    "creative",
    "destination",
  ]);
  await internalAction(page.request, review.id, {
    type: "confirm_intake",
    offerId: offer.id,
  });
  await internalAction(page.request, review.id, {
    type: "disposition",
    findingId: publicFindings[1].id,
    status: "resolved",
    reason: "Inspected both pages of the supplied destination.",
  });
  const scope =
    "Version 3 image, caption and two-page destination for Northstar California paid social, October 2026.";
  const approved = await internalAction(page.request, review.id, {
    type: "decide",
    outcome: "approved",
    scope,
    rationale: "INTERNAL ONLY decision rationale",
    reviewed: true,
  });
  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Approved for the stated use",
      exact: true,
    }),
  ).toHaveCount(0);
  await internalAction(page.request, review.id, {
    type: "publish_result",
    decisionId: approved.decisions.at(-1)!.id,
    message:
      "This package is approved for the stated placement. Submit any future changes for review.",
  });
  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Approved for the stated use",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(scope, { exact: true })).toBeVisible();
  await expect(page.getByText("INTERNAL ONLY", { exact: false })).toHaveCount(
    0,
  );
  await internalAction(page.request, review.id, {
    type: "withdraw_approval",
    decisionId: approved.decisions.at(-1)!.id,
    reason: "The offer is no longer available. Stop using this package.",
  });
  await page.getByRole("button", { name: "Check for updates" }).click();
  await expect(
    page.getByRole("heading", { name: "This approval has been withdrawn" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This approval has been withdrawn. Contact the review team before using this material.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("an unfinished external submission survives a refresh without pretending files were saved", async ({
  page,
}) => {
  await page.goto("/submit");
  await page.getByLabel("Campaign or submission name").fill("Saved local text");
  await page
    .getByLabel("Where and how will the material be used?")
    .fill("California social creative for the October offer.");
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByLabel("Campaign or submission name")).toHaveValue(
    "Saved local text",
  );
  await expect(
    page.getByText("Your unfinished text was restored", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Reselect any files before submitting.", { exact: false }),
  ).toBeVisible();
});

test("offer references preserve original sources and create separately cited immutable versions", async ({
  page,
}) => {
  await page.goto("/#references");
  await page
    .getByRole("button", { name: "New reference", exact: true })
    .click();
  await page
    .getByLabel("Reference name", { exact: true })
    .fill("Browser source-backed loan reference");
  await page.getByLabel("Version", { exact: true }).fill("BROWSER-PL/v1");
  await page.getByLabel("Valid from", { exact: true }).fill("2026-09-01");
  await page.getByLabel("Valid through", { exact: true }).fill("2026-11-30");
  await page
    .getByLabel("Who supplied this reference?")
    .fill("Fictional ClearPath product team · September source sheet");
  await page
    .getByLabel("Source files", { exact: false })
    .setInputFiles(fixture("offers/personal-loan.pdf"));
  await page.getByLabel("Fact label", { exact: true }).fill("Origination fee");
  await page
    .getByRole("textbox", { name: "Fact value", exact: true })
    .fill("5% of principal, deducted from proceeds");
  await page
    .getByRole("combobox", { name: "Source for this fact", exact: true })
    .selectOption("0");
  await page.getByLabel("Source page").fill("1");
  await page
    .getByLabel("Applicability and limitations", { exact: true })
    .fill(
      "Fictional personal loan offer. No zero-fee variant. No APR claim supplied.",
    );
  const createdEvent = page.waitForResponse(
    (r) => r.url().endsWith("/api/offers") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save reference version", exact: true })
    .click();
  const firstResponse = await createdEvent;
  expect(firstResponse.status()).toBe(201);
  const first: Offer = await firstResponse.json();
  await expect(
    page.getByRole("heading", { name: first.name, exact: true }),
  ).toBeVisible();
  expect(first.facts[0].citation?.page).toBe(1);
  expect(first.assets).toHaveLength(1);
  const original = await page.request.get(
    `/api/offers/${first.id}/assets/${first.assets![0].id}`,
  );
  expect(await original.body()).toEqual(
    readFileSync(fixture("offers/personal-loan.pdf")),
  );
  await page
    .getByRole("button", { name: /personal-loan\.pdf · p\. 1/ })
    .click();
  await expect(page.locator(".offer-source-preview iframe")).toHaveAttribute(
    "src",
    /#page=1$/,
  );

  await page
    .getByRole("button", { name: "Create new version", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Fact value", exact: true }),
  ).toHaveValue("5% of principal, deducted from proceeds");
  await expect(
    page.getByRole("combobox", { name: "Source for this fact", exact: true }),
  ).toHaveValue("");
  await page.getByLabel("Version", { exact: true }).fill("BROWSER-PL/v2");
  await page.getByLabel("Valid from", { exact: true }).fill("2026-12-01");
  await page.getByLabel("Valid through", { exact: true }).fill("2027-02-28");
  await page
    .getByLabel("Source files", { exact: false })
    .setInputFiles(fixture("offers/personal-loan.pdf"));
  await page
    .getByRole("combobox", { name: "Source for this fact", exact: true })
    .selectOption("0");
  await page.getByLabel("Source page").fill("1");
  const nextEvent = page.waitForResponse(
    (r) => r.url().endsWith("/api/offers") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save reference version", exact: true })
    .click();
  const next: Offer = await (await nextEvent).json();
  expect(next.supersedesId).toBe(first.id);
  expect(next.id).not.toBe(first.id);
  expect(next.assets![0].id).not.toBe(first.assets![0].id);
  const references: Offer[] = await (
    await page.request.get("/api/offers")
  ).json();
  expect(references.find((offer) => offer.id === first.id)).toEqual(first);
  await page
    .locator(".offer-list button")
    .filter({ hasText: "BROWSER-PL/v1" })
    .click();
  await expect(page.locator(".offer-detail-header")).toContainText(
    "BROWSER-PL/v1",
  );
  await page
    .getByRole("button", { name: "Withdraw this reference", exact: true })
    .click();
  await page
    .getByLabel("Reason for withdrawal", { exact: true })
    .fill("Superseded for new campaigns; retain for historical review.");
  const withdrawn = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/offers/${first.id}/withdraw`) &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Withdraw reference", exact: true })
    .click();
  expect((await withdrawn).ok()).toBeTruthy();
  await expect(
    page.getByText("Withdrawn from further use", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Superseded for new campaigns; retain for historical review.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("a recovered note-only revision draft keeps newer package text after explicit reconciliation", async ({
  page,
}) => {
  const receipt = await createExternalDraftCase(
    page.request,
    "Draft recovery without stale copy",
  );
  await page.goto(`/submit/${receipt.token}`);
  await page
    .getByRole("button", { name: "Submit updated package", exact: true })
    .click();
  const form = page.locator(".partner-package-form");
  await form.getByLabel("What changed?").fill("My only change is this note.");
  const saved = await page.evaluate(
    (token) => JSON.parse(sessionStorage.getItem(`clearpath:submit:${token}`)!),
    receipt.token,
  );
  expect(saved.baseRevisionId).toBe(receipt.submission.revisions[0].id);
  expect(saved.edits).toEqual({ summary: "My only change is this note." });
  const latest = await concurrentExternalRevision(
    page.request,
    receipt.token,
    "Corrected version-two copy that must survive.",
  );
  page.on("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page
    .getByRole("button", { name: "Submit updated package", exact: true })
    .click();
  await expect(
    form.getByRole("heading", { name: "The package has changed to version 2" }),
  ).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Submit new version" }),
  ).toBeDisabled();
  await form
    .getByRole("checkbox", { name: /I have checked the latest package/ })
    .check();
  await form
    .getByRole("button", { name: "Use latest package with reviewed edits" })
    .click();
  await expect(form.getByLabel("Accompanying advertising copy")).toHaveValue(
    "Corrected version-two copy that must survive.",
  );
  await expect(form.getByLabel("What changed?")).toHaveValue(
    "My only change is this note.",
  );
  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/submissions/${receipt.token}/revisions`) &&
      response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Submit new version" }).click();
  const next: SubmitterCase = await (await submitted).json();
  expect(next.revisions.at(-1)?.copy).toBe(
    "Corrected version-two copy that must survive.",
  );
  expect(next.revisions.at(-1)?.components).toEqual(
    latest.revisions.at(-1)?.components,
  );
});

test("an in-page package conflict requires a text choice and preserves the selected destination PDF", async ({
  page,
}) => {
  const receipt = await createExternalDraftCase(
    page.request,
    "Draft conflict with selected file",
  );
  await page.goto(`/submit/${receipt.token}`);
  await page
    .getByRole("button", { name: "Submit updated package", exact: true })
    .click();
  const form = page.locator(".partner-package-form");
  await form
    .getByLabel("Accompanying advertising copy")
    .fill("My deliberate replacement copy.");
  await form
    .getByLabel("What changed?")
    .fill("Changed copy and added destination proof.");
  await form
    .locator('input[type="file"][multiple]')
    .setInputFiles(fixture("loan/v3/destination.pdf"));
  await form
    .getByRole("combobox", { name: "Role for destination.pdf", exact: true })
    .selectOption("destination");
  await concurrentExternalRevision(
    page.request,
    receipt.token,
    "Another collaborator's corrected copy.",
  );
  const failed = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/submissions/${receipt.token}/revisions`) &&
      response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Submit new version" }).click();
  expect((await failed).status()).toBe(409);
  await expect(
    form.getByRole("heading", { name: "The package has changed to version 2" }),
  ).toBeVisible();
  await expect(
    form.getByRole("button", {
      name: "Use latest package with reviewed edits",
    }),
  ).toBeDisabled();
  await form.getByRole("radio", { name: /Keep my draft edit/ }).check();
  await form
    .getByRole("checkbox", { name: /I have checked the latest package/ })
    .check();
  await form
    .getByRole("button", { name: "Use latest package with reviewed edits" })
    .click();
  await expect(form.getByLabel("Accompanying advertising copy")).toHaveValue(
    "My deliberate replacement copy.",
  );
  await expect(
    form.getByRole("combobox", {
      name: "Role for destination.pdf",
      exact: true,
    }),
  ).toHaveValue("destination");
  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/submissions/${receipt.token}/revisions`) &&
      response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Submit new version" }).click();
  const next: SubmitterCase = await (await submitted).json();
  expect(next.revisions.at(-1)?.copy).toBe("My deliberate replacement copy.");
  expect(
    next.revisions.at(-1)?.components.map((component) => component.role),
  ).toEqual(["creative", "destination"]);
  expect(
    next.assets.some((asset) => asset.name === "destination.pdf"),
  ).toBeTruthy();
});
