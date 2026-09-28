import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  CaseAction,
  Offer,
  ReviewCase,
  SubmitterCase,
  SubmitterReceipt,
} from "../shared/types";

const fixture = (path: string) => resolve("public/fixtures", path);
type Action = CaseAction extends infer A
  ? A extends { expectedVersion: number }
    ? Omit<A, "expectedVersion">
    : never
  : never;

async function getReview(request: APIRequestContext, id: string) {
  const response = await request.get(`/api/cases/${id}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as ReviewCase;
}

async function internalAction(
  request: APIRequestContext,
  id: string,
  input: Action,
) {
  const latest = await getReview(request, id);
  const response = await request.post(`/api/cases/${id}/actions`, {
    data: { ...input, actorId: "maya", expectedVersion: latest.version },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as ReviewCase;
}

async function browserAction(
  page: Page,
  id: string,
  click: () => Promise<unknown>,
) {
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/cases/${id}/actions`) &&
      response.request().method() === "POST",
  );
  await click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as ReviewCase;
}

async function createReview(request: APIRequestContext, title: string) {
  const offers: Offer[] = await (await request.get("/api/offers")).json();
  const offer = offers.find(
    (item) => item.product === "personal_loan" && !item.withdrawnAt,
  )!;
  const response = await request.post("/api/submissions", {
    multipart: {
      payload: JSON.stringify({
        title,
        product: "personal_loan",
        submitter: "Morgan Affiliate",
        submittedBy: "Morgan Affiliate",
        submitterEmail: "morgan@example.com",
        channel: "Paid social",
        launchDate: offer.validFrom,
        advertisedOffer: "Standard personal loan",
        intendedUse: "Named affiliate paid social placement in California.",
        copy: "Explore the ClearPath personal loan.",
        destinationUrl: "https://clearpath.example/personal-loans",
        summary: "Initial material for review",
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
  const receipt: SubmitterReceipt = await response.json();
  const cases: ReviewCase[] = await (await request.get("/api/cases")).json();
  const created = cases.find(
    (item) => item.reference === receipt.submission.reference,
  )!;
  const review = await internalAction(request, created.id, {
    type: "confirm_intake",
    offerId: offer.id,
  });
  return { review, token: receipt.token };
}

test("returned evidence brings a waiting case back to review and resolves only the assessed request", async ({
  page,
}) => {
  const title = "Returned evidence · separate open correction";
  const { review, token } = await createReview(page.request, title);
  for (const [findingTitle, kind, requestedAction] of [
    [
      "Supply destination proof",
      "evidence",
      "Provide the destination rendition supporting this placement.",
    ],
    [
      "Correct the fee claim",
      "correction",
      "Correct the fee wording in the image and return updated creative.",
    ],
  ] as const) {
    await internalAction(page.request, review.id, {
      type: "add_finding",
      finding: {
        kind,
        title: findingTitle,
        detail:
          "Human review against the preserved fictional offer and campaign context.",
        request: requestedAction,
        location: "Submitted social creative and destination",
        assetId: review.assets[0].id,
        owner: review.submitter,
        material: true,
        audience: "submitter",
      },
    });
  }
  const findings = (await getReview(page.request, review.id)).findings;
  const evidenceFinding = findings[0];
  const correctionFinding = findings[1];
  await internalAction(page.request, review.id, {
    type: "publish_feedback",
    findingIds: findings.map((finding) => finding.id),
    subject: "Destination evidence and fee correction",
    body: "Please answer both requests before approval can be considered.",
  });
  await internalAction(page.request, review.id, {
    type: "set_waiting",
    nextOwner: review.submitter,
    reason: "Waiting for destination evidence and corrected creative.",
  });
  await page.goto("/#queue");
  await expect(
    page.getByRole("button", { name: "To review", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toHaveCount(0);

  const external: SubmitterCase = await (
    await page.request.get(`/api/submissions/${token}`)
  ).json();
  const answer =
    "The attached destination is the supporting rendition. The fee correction is still outstanding.";
  const received = await page.request.post(
    `/api/submissions/${token}/responses`,
    {
      multipart: {
        payload: JSON.stringify({
          expectedVersion: external.version,
          submittedBy: review.submitter,
          text: answer,
          findingIds: [evidenceFinding.id],
        }),
        files: {
          name: "destination.pdf",
          mimeType: "application/pdf",
          buffer: readFileSync(fixture("loan/v3/destination.pdf")),
        },
      },
    },
  );
  expect(received.ok(), await received.text()).toBeTruthy();
  const withResponse = await getReview(page.request, review.id);
  expect(withResponse.revisions).toHaveLength(1);
  expect(withResponse.revisions[0].components).toEqual(
    review.revisions[0].components,
  );
  expect(
    withResponse.findings.every((finding) => finding.status === "open"),
  ).toBeTruthy();

  await page.reload();
  const queueRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });
  await expect(queueRow).toContainText(/response.*assess|assess.*response/i);
  await queueRow.getByRole("link", { name: title, exact: true }).click();
  await page
    .getByRole("button", { name: "Assess responses", exact: true })
    .click();
  const assessment = page.locator(".rw-assessment");
  await expect(assessment).toContainText(evidenceFinding.title);
  await expect(assessment).toContainText(answer);
  await assessment
    .getByRole("button", {
      name: "Open destination.pdf beside material",
      exact: true,
    })
    .click();
  const evidence = page.getByRole("region", {
    name: "Supporting evidence",
    exact: true,
  });
  await expect(evidence).toBeVisible();
  await expect(
    page
      .locator(".rw-material")
      .getByRole("combobox", { name: "File", exact: true }),
  ).toHaveValue(review.assets[0].id);
  await evidence
    .getByRole("button", { name: "Next page", exact: true })
    .click();
  await expect(
    evidence.getByText("Page 2 of 2", { exact: true }),
  ).toBeVisible();
  await expect(evidence.locator(".pdf-text-layer")).toContainText(
    "Before you borrow",
  );

  await assessment
    .getByRole("button", { name: "Resolve finding", exact: true })
    .click();
  const editor = page.locator(".rw-editor");
  const reason =
    "INTERNAL: inspected the two-page destination against the supplied placement; image correction remains open.";
  await editor.getByLabel("What evidence addresses this finding?").fill(reason);
  await editor
    .getByRole("checkbox", { name: /Use Morgan Affiliate's response/ })
    .check();
  await editor
    .getByRole("checkbox", {
      name: /Share this request's status with the submitter/,
    })
    .check();
  const resolved = await browserAction(page, review.id, () =>
    editor.getByRole("button", { name: "Save", exact: true }).click(),
  );
  expect(
    resolved.findings.find((finding) => finding.id === evidenceFinding.id),
  ).toMatchObject({
    status: "resolved",
    disposition: { reason, responseIds: [withResponse.responses![0].id] },
  });
  expect(
    resolved.findings.find((finding) => finding.id === correctionFinding.id)
      ?.status,
  ).toBe("open");
  expect(resolved.responses![0].assessment).toBeDefined();
  expect(resolved.decisions).toEqual([]);
  await expect(
    page.getByRole("heading", { name: correctionFinding.title, exact: true }),
  ).toBeVisible();
  const sharedResponse = await page.request.get(`/api/submissions/${token}`);
  const shared: SubmitterCase = await sharedResponse.json();
  expect(
    shared.sharedRequests.find(
      (request) => request.findingId === evidenceFinding.id,
    )?.status,
  ).toBe("accepted");
  expect(
    shared.sharedRequests.find(
      (request) => request.findingId === correctionFinding.id,
    )?.status,
  ).toBe("open");
  expect(shared.results).toEqual([]);
  expect(await sharedResponse.text()).not.toContain(reason);
});

test("a recorded approval stays actionable until its exact saved decision message is communicated", async ({
  page,
}) => {
  const title = "Approval awaiting communication";
  const { review, token } = await createReview(page.request, title);
  await page.goto(`/#review/${review.id}`);
  await page
    .getByRole("button", { name: "Record decision", exact: true })
    .click();
  const decisionForm = page.getByRole("dialog", {
    name: "Record your decision",
    exact: true,
  });
  const scope =
    "Version 1 image and caption for the named California paid social placement.";
  await decisionForm.getByLabel("Scope of this decision").fill(scope);
  await decisionForm
    .getByLabel("Decision rationale")
    .fill(
      "Human review of the preserved fictional package and applicable reference completed.",
    );
  await decisionForm
    .getByRole("checkbox", {
      name: "I have reviewed this package and the applicable requirements.",
    })
    .check();
  const approved = await browserAction(page, review.id, () =>
    decisionForm
      .getByRole("button", { name: "Record approval", exact: true })
      .click(),
  );
  const decision = approved.decisions.at(-1)!;
  expect(approved.publishedResults || []).toEqual([]);

  await page.goto("/#queue");
  const queueRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });
  await expect(queueRow).toBeVisible();
  await expect(queueRow).toContainText(/communicat|share.*decision/i);
  await queueRow.getByRole("link", { name: title, exact: true }).click();
  await page
    .getByRole("tab", { name: "Feedback & replies", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepare reply", exact: true })
    .click();
  const reply = page.getByRole("dialog", {
    name: "Prepare a reply",
    exact: true,
  });
  await reply
    .getByLabel("Subject", { exact: true })
    .fill("Approval for the reviewed version");
  const message = `The material is approved only for this scope: ${scope} Return changes for review.`;
  await reply.getByLabel("Message", { exact: true }).fill(message);
  await reply
    .getByRole("checkbox", {
      name: /^This message communicates the recorded decision/,
    })
    .check();
  const saved = await browserAction(page, review.id, () =>
    reply.getByRole("button", { name: "Save draft", exact: true }).click(),
  );
  const draft = saved.drafts.at(-1)!;
  expect(draft).toMatchObject({
    decisionId: decision.id,
    revisionId: decision.revisionId,
    body: message,
  });
  expect(saved.communications || []).toEqual([]);
  expect(saved.publishedResults || []).toEqual([]);

  // Merely preparing the right message must not remove the unfinished handoff.
  await page.goto("/#queue");
  await expect(queueRow).toBeVisible();
  await queueRow.getByRole("link", { name: title, exact: true }).click();
  await page
    .getByRole("tab", { name: "Feedback & replies", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record communication", exact: true })
    .click();
  const communication = page.getByRole("dialog", {
    name: "Record outside communication",
    exact: true,
  });
  await communication
    .getByRole("combobox", { name: "Message", exact: true })
    .selectOption(draft.id);
  await communication
    .getByLabel("Recipient", { exact: true })
    .fill("morgan@example.com");
  await communication
    .getByLabel("Record note · optional")
    .fill(
      "Recorded for the isolated workflow test; no message was sent by the application.",
    );
  const communicated = await browserAction(page, review.id, () =>
    communication
      .getByRole("button", { name: "Record communication", exact: true })
      .click(),
  );
  expect(communicated.communications?.at(-1)).toMatchObject({
    messageId: draft.id,
    messageVersion: draft.version || 1,
    recipient: "morgan@example.com",
  });
  expect(communicated.decisions).toEqual(approved.decisions);
  expect(communicated.publishedResults || []).toEqual([]);
  const external: SubmitterCase = await (
    await page.request.get(`/api/submissions/${token}`)
  ).json();
  expect(external.results).toEqual([]);

  await page.goto("/#queue");
  await expect(
    page.getByRole("button", { name: "To review", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Completed", exact: true }).click();
  await expect(
    page.getByRole("link", { name: title, exact: true }),
  ).toBeVisible();
});
