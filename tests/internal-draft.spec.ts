import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { ReviewCase } from "../shared/types";

async function createCase(request: APIRequestContext, title: string) {
  const response = await request.post("/api/cases", {
    multipart: {
      payload: JSON.stringify({
        title,
        product: "personal_loan",
        submitter: "Internal coordinator",
        submittedBy: "Internal coordinator",
        submitterEmail: "coordinator@example.com",
        channel: "Paid social",
        launchDate: "2026-10-12",
        summary: "Initial material",
        offerId: "offer-personal-loan-v3",
        intendedUse: "A named affiliate placement.",
        copy: "Original version-one caption.",
        destinationUrl: "",
        fileRoles: ["creative"],
      }),
      files: {
        name: "social-ad.png",
        mimeType: "image/png",
        buffer: readFileSync("public/fixtures/loan/v1/social-ad.png"),
      },
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ReviewCase;
}
async function concurrentRevision(request: APIRequestContext, id: string) {
  const c: ReviewCase = await (await request.get(`/api/cases/${id}`)).json();
  const revision = c.revisions.at(-1)!;
  const response = await request.post(`/api/cases/${id}/revisions`, {
    multipart: {
      payload: JSON.stringify({
        submittedBy: "Another coordinator",
        summary: "Concurrent update",
        offerId: revision.offerId,
        intendedUse: revision.intendedUse,
        copy: "Latest version-two caption.",
        destinationUrl: revision.destinationUrl,
        retainedComponents: revision.components.map(({ assetId, role }) => ({
          assetId,
          role,
        })),
        fileRoles: ["destination"],
        expectedVersion: c.version,
      }),
      files: {
        name: "new-destination.pdf",
        mimeType: "application/pdf",
        buffer: readFileSync("public/fixtures/loan/v3/destination.pdf"),
      },
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as ReviewCase;
}

test("internal stale revision keeps edits and uploads while adopting untouched current context and files", async ({
  page,
  request,
}) => {
  const c = await createCase(request, "Internal conflict recovery");
  await page.goto(`/#review/${c.id}`);
  await page.getByRole("button", { name: "Add revision", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Submit an updated package",
  });
  await dialog
    .getByRole("textbox", { name: "Revision note", exact: true })
    .fill("My actual revision note.");
  await dialog
    .locator("input[type=file][multiple]")
    .setInputFiles({
      name: "local-proof.pdf",
      mimeType: "application/pdf",
      buffer: readFileSync("public/fixtures/offers/personal-loan.pdf"),
    });
  await dialog
    .getByLabel("Role for local-proof.pdf", { exact: true })
    .selectOption("evidence");
  await concurrentRevision(request, c.id);
  await dialog
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", {
      name: "Review the latest package · version 2",
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Save new version", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("checkbox", { name: /I checked the latest package/ })
    .check();
  await dialog
    .getByRole("button", {
      name: "Use latest package with reviewed edits",
      exact: true,
    })
    .click();
  await expect(dialog.getByLabel(/^Accompanying copy · optional/)).toHaveValue(
    "Latest version-two caption.",
  );
  await expect(
    dialog.getByRole("textbox", { name: "Revision note", exact: true }),
  ).toHaveValue("My actual revision note.");
  await expect(
    dialog.getByLabel("Role for local-proof.pdf", { exact: true }),
  ).toHaveValue("evidence");
  await expect(
    dialog.getByLabel("Role for retained new-destination.pdf", { exact: true }),
  ).toHaveValue("destination");
  await dialog
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const saved: ReviewCase = await (
    await request.get(`/api/cases/${c.id}`)
  ).json();
  expect(saved.revisions).toHaveLength(3);
  expect(saved.revisions.at(-1)?.copy).toBe("Latest version-two caption.");
  expect(saved.revisions.at(-1)?.summary).toBe("My actual revision note.");
  expect(saved.revisions.at(-1)?.components).toHaveLength(3);
  expect(saved.assets).toHaveLength(3);
});

test("an attachment-only internal draft detects a newer package after closing and reopening", async ({
  page,
  request,
}) => {
  const c = await createCase(request, "Internal upload draft");
  await page.goto(`/#review/${c.id}`);
  await page.getByRole("button", { name: "Add revision", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "Submit an updated package" });
  await dialog
    .locator("input[type=file][multiple]")
    .setInputFiles({
      name: "kept-upload.pdf",
      mimeType: "application/pdf",
      buffer: readFileSync("public/fixtures/offers/personal-loan.pdf"),
    });
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await concurrentRevision(request, c.id);
  await page
    .getByRole("button", { name: "Refresh workspace", exact: true })
    .click();
  await expect(
    page.getByText("Version 2", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add revision", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "Submit an updated package" });
  await expect(
    dialog.getByRole("heading", {
      name: "Review the latest package · version 2",
    }),
  ).toBeVisible();
  await dialog
    .getByRole("checkbox", { name: /I checked the latest package/ })
    .check();
  await dialog
    .getByRole("button", {
      name: "Use latest package with reviewed edits",
      exact: true,
    })
    .click();
  await expect(dialog.getByLabel(/^Accompanying copy · optional/)).toHaveValue(
    "Latest version-two caption.",
  );
  await expect(
    dialog.getByLabel("Role for kept-upload.pdf", { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByLabel("Role for retained new-destination.pdf", { exact: true }),
  ).toHaveValue("destination");
});

test("conflicting internal copy requires an explicit choice instead of overwriting a collaborator", async ({
  page,
  request,
}) => {
  const c = await createCase(request, "Internal deliberate copy choice");
  await page.goto(`/#review/${c.id}`);
  await page.getByRole("button", { name: "Add revision", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Submit an updated package",
  });
  await dialog
    .getByRole("textbox", { name: "Revision note", exact: true })
    .fill("My copy update.");
  await dialog
    .getByLabel(/^Accompanying copy · optional/)
    .fill("My deliberately edited caption.");
  await concurrentRevision(request, c.id);
  await dialog
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await dialog
    .getByRole("checkbox", { name: /I checked the latest package/ })
    .check();
  await expect(
    dialog.getByRole("button", {
      name: "Use latest package with reviewed edits",
      exact: true,
    }),
  ).toBeDisabled();
  await dialog
    .getByRole("radio", { name: /Keep my draft accompanying copy/ })
    .check();
  await dialog
    .getByRole("button", {
      name: "Use latest package with reviewed edits",
      exact: true,
    })
    .click();
  await expect(dialog.getByLabel(/^Accompanying copy · optional/)).toHaveValue(
    "My deliberately edited caption.",
  );
  await dialog
    .getByRole("button", { name: "Save new version", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const saved: ReviewCase = await (
    await request.get(`/api/cases/${c.id}`)
  ).json();
  expect(saved.revisions.at(-1)?.copy).toBe("My deliberately edited caption.");
  expect(saved.revisions.at(-1)?.components).toHaveLength(2);
});
