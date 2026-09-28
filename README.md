# ClearPath Review

A workspace for marketing-compliance reviews. Marketers and affiliates submit material, reviewers request corrections, and both sides can follow the review through to a decision about a specific version.

**[Open the reviewer workspace](https://award-harrison-explore-messaging.trycloudflare.com)** · **[Submit material](https://award-harrison-explore-messaging.trycloudflare.com/submit)**

## The problem

When files and feedback live in email and status lives in a spreadsheet, reviewers have to reconstruct the case: which version is current, what changed, which questions remain open, and who needs to act next.

This product brings that work into one record. The working assumption is that coordination and incomplete correction rounds contribute to the approval bottleneck. That assumption still needs validation with a real review team; no throughput improvement has been measured.

## How it works

- **Submitters** use a separate submission form and return link. They can see shared requests, answer a specific question, upload supporting evidence, submit a revision, and view the shared decision and its scope.
- **Reviewers** work from a queue showing status and next actions. They inspect creative alongside supporting sources, record findings, assess responses, and deliberately share feedback or a decision. Internal reasoning stays out of the submitter view.
- **Offer references** hold product terms and source documents used to assess the advertising. They are separate from submitted ads and can be versioned or withdrawn without replacing the historical record.

## Five-minute tour: try both sides

Open **Sample materials → Try a prepared case**. Each case has **Review case** and **Submitter page** links; open both to follow the exchange. After changing one side, use **Refresh workspace** or **Check for updates** on the other.

| Prepared case | What to try |
| --- | --- |
| **Northstar · October loan launch** | Select the loan reference, confirm intake, and add a finding. A new submission starts without findings. |
| **Northstar · Fee correction returned** | Compare the original and revised images. Resolve the fee correction; the missing destination still blocks approval. Open the submitter page to see and respond to the shared requests. |
| **Northstar · Destination evidence received** | Assess the response and its two-page PDF beside the creative. Receiving evidence does not automatically resolve a request. |
| **ClearPath · October social handoff** | Open the saved decision message, check its scope, and share it. Confirm the result appears on the submitter page. |
| **Northstar · October campaign approved** | Inspect the approved files, scope, and correction history from either side. Download the internal record under **History & notes**. |
| **Northstar · Offer reference withdrawn** | See why an earlier approval cannot be newly shared and follow the route to review with a current reference. |

Changes persist in the shared demo, so a case may reflect a previous visitor's actions. The [full walkthrough](docs/demo-walkthrough.md) starts with a blank submission; the [flow index](docs/demo-flows.md) covers withdrawal, ownership, source versioning, draft recovery, and other paths.

## Key decisions

- **Keep compliance judgment with the reviewer.** The app organizes evidence and unresolved work; it does not determine whether an ad complies. Sample findings are authored examples, not automated detections.
- **Make corrections explicit.** A revised file or a new response does not clear a finding. Approval requires resolved required findings and assessment of pending responses, so a partial correction cannot silently finish the review.
- **Tie approval to what was reviewed.** Decisions preserve the package version, supporting reference, and intended use. Later revisions do not inherit approval. A withdrawn reference blocks sharing the earlier approval.
- **Separate recording from communicating.** Saving a draft or recording a decision does not publish it to the submitter. Sharing is deliberate, with private reasoning kept separate from actionable requests.
- **Complete the portal workflow first.** Email integration would help preserve affiliates' existing habits. This version focuses on making the submission, correction, and decision loop work before adding another intake channel.

The research informed the material and context a reviewer needs to inspect, including offer terms, disclosure presentation, and support for claims. The [regulatory design basis](docs/regulatory-design-basis.md) connects specific sources to these choices and distinguishes legal requirements from product decisions.

## Current limits

The demo has no sign-in or production permissions; use sample material only. Return links separate the submitter experience but are not a complete access-control model. Sharing updates the portal; it sends no email or notification.

PNG/JPEG and multipage PDFs have previews. Offer facts are entered manually. There is no automated compliance analysis, OCR, video review, or live-page capture. Campaign expiration, post-publication monitoring, and production backup and retention controls are also outside this version. The live demo runs through a temporary tunnel and depends on its host staying online.

## Run locally

Requires Node.js **24.14.0 or later within Node 24** and npm.

```sh
npm ci
npm run build
npm start
```

Open `http://localhost:3000`. With the server running, add the prepared cases from a second terminal:

```sh
npm run demo:populate
```

The script adds missing scenarios without resetting existing work. See the [sample guide](docs/sample-cases.md) for setup details. Records and uploads persist in the ignored `data/` directory; set `DATA_DIR` to use another location. For development, `npm run dev` runs Vite on port 5173 and Express on port 3000.

React/Vite provides the interface, Express handles the API, and SQLite stores the case records. Original files are stored separately with hashes. Start with [API routes](server/app.ts), [case state transitions](server/store.ts), [decision sharing](server/handoffs.ts), or the [submitter response model](server/submitter.ts).

## Tests

```sh
npm test
npm run build
npm run test:e2e
```

API and browser tests cover uploads, revisions, partial corrections, concurrent edits, submitter visibility, approval and sharing checks, source withdrawal, and record exports. They verify workflow behavior, not legal accuracy.

Browser tests use isolated data on port 3101. They use Playwright Chromium or system Chrome on macOS; install Chromium with `npx playwright install chromium` if needed.

## Further reading

- [Product rationale](docs/product-one-pager.md): assumptions, priorities, tradeoffs, and what to validate next.
- [Research](docs/research.md): the reconstructed review process, stakeholders, and alternative product directions.
- [Regulatory design basis](docs/regulatory-design-basis.md): how specific advertising requirements informed the workflow.
