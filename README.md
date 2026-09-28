# ClearPath Review

A working review loop for a fictional consumer-finance company: submit marketing, inspect material and supporting facts, request corrections, review the response, and record and share a decision about an exact version.

**[Open the reviewer workspace](https://award-harrison-explore-messaging.trycloudflare.com)** · **[Submit material](https://award-harrison-explore-messaging.trycloudflare.com/submit)** · [Private repository](https://github.com/tdschmidt/clearpath-review)

**Start here:** [one-page product rationale (PDF)](output/pdf/clearpath-product-one-pager.pdf) · [Why these regulatory details shaped the design](docs/regulatory-design-basis.md)

This is an unauthenticated demonstration. Use fictional material only. The Mac, server, and tunnel must remain running; restarting the tunnel changes the temporary URL. The GitHub repository is private, so the reviewer needs access separately.

## Five-minute tour: try both sides

Open **Sample materials → Try a prepared case**. Each case has **Review case** and **Submitter page** links; keep the two tabs open together. The review header also has **View submitter page**. After an action in the other tab, use **Refresh workspace** or **Check for updates**.

| What to explore | Prepared case and shortest route | What to notice |
| --- | --- | --- |
| Intake | **Northstar · October loan launch** → Review case | Select the applicable loan reference and confirm the package. New submissions have no automatically generated findings. |
| Partial corrections | **Northstar · Fee correction returned** → Review case → Versions | Compare the original and corrected image. Resolve the fee finding; the missing destination still blocks approval. |
| The submitter's action items | Open the same case's **Submitter page** | See shared requests, reply to a specific request, or update the submitted material. Internal reasoning is absent from this view. |
| Returned evidence | **Northstar · Destination evidence received** → Assess responses | Read the answer and both PDF pages beside the creative. Including this existing attachment in a new package is explicit; receiving it does not resolve the finding. |
| A decision awaiting communication | **ClearPath · October social handoff** → Prepare decision message | Inspect the saved reply and scope, then deliberately share. Saving a draft alone does not communicate the decision. |
| A completed review | **Northstar · October campaign approved** → either side | Inspect the shared approval, exact files, scope, accepted requests, and preserved earlier versions. |
| A source withdrawn after approval | **Northstar · Offer reference withdrawn** → Review with current reference | The queue surfaces the withdrawal. Sharing the old approval is blocked; a replacement source and fresh review are required. |
| Retrieve the evidence record | Any case → **History & notes → Download internal record** | Download original files, reference documents, revisions, decisions, and handoffs. The ZIP contains internal reasoning; it is not an affiliate reply. |

For the full loop from a blank submission, follow the [walkthrough](docs/demo-walkthrough.md). For rejection, approval withdrawal, source versioning, waiting/ownership, draft recovery, and other paths, use the [flow index](docs/demo-flows.md). [Sample details and repeatable setup](docs/sample-cases.md) explain the prepared stages.

The ten live cases include six added workflow stages, the original loan/card/mortgage examples, and an existing user-created case. They are editable fictional records; another tester may change their state. The card example **Everyday, simply** deliberately leaves a disclosure question unresolved even though the advertised fee matches its reference. The mortgage example **A clearer first step home** is waiting on its destination.

## Product boundaries and known gaps

The core workflow persists real records and files. PNG/JPEG and multipage PDF previews, citations, revisions, feedback, responses, human dispositions, scoped decisions, and ZIP exports are implemented. Offer references contain manually entered facts with preserved sources. Seeded findings are authored examples, not scanner output.

The [final audit's workflow defects](docs/final-workflow-audit.md) are corrected: pending responses interrupt approval and approval sharing; changed recipient instructions are flagged for deliberate re-sharing; revision attribution, evidence context, and handoff prompts are consistent. The [readiness decisions](docs/submission-readiness.md) explain each change and its validation. No further submission-blocking defect was found in the final checks; this is a bounded audit, not a guarantee of production readiness.

Email intake and notifications, authentication and partner permissions, automated compliance analysis, OCR/video/live-page capture, campaign expiration/monitoring, and production retention/backup operations are outside this version. Portal sharing is not email delivery. A saved approval is a human decision, not legal certification. No throughput improvement or detection accuracy has been measured.

## Design and implementation

The [presenter briefing](docs/presenter-briefing.md) explains the reconstructed Excel/email process, stakeholder needs, reviewer judgments, assumptions, and alternatives. The [product story](docs/product-story.md) and [research](docs/research.md) retain the reasoning behind the chosen scope. The private call transcript is not in the repository.

For concrete implementation choices, read the [core workflow decisions](docs/core-workflow-decisions.md), [reviewer decisions](docs/reviewer-workflow-decisions.md), and [submitter decisions](docs/external-workflow-decisions.md). Research informed the information and evidence a reviewer needs; it is not implemented as an exhaustive legal rule engine.

React/Vite provides the interface; Express validates requests; Node's SQLite stores versioned case records; original files are stored separately with hashes. Useful entry points are [API routes](server/app.ts), [state transitions](server/store.ts), [sharing and communication](server/handoffs.ts), and the deliberately separate [submitter response model](server/submitter.ts). Large UI modules and duplicated internal/external form concerns are maintenance work for a later iteration, not a reason to rewrite working flows before submission.

## Run locally

Use Node.js **24.14.0** (supported: `>=24.14.0 <25`) and npm.

```sh
npm install
npm run build
npm start
```

Open `http://localhost:3000`. In a second terminal, add the prepared stages with:

```sh
npm run demo:populate
```

The script is additive: it skips completed scenarios and never resets work a tester has changed. Local records and uploads use the ignored `data/` directory, or a separate directory selected through `DATA_DIR`. Development uses `npm run dev` (Vite on port 5173, Express on 3000).

For temporary access, with Cloudflare Tunnel installed separately:

```sh
cloudflared tunnel --url http://localhost:3000
```

The current local binary is `data/tools/cloudflared`; it is ignored and not part of a fresh clone. An installed/configured ngrok can also expose port 3000.

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

The latest full verification passed **35 API tests and 23 browser tests**. Coverage includes actual uploads, file/page citations, partial corrections, stale saves, draft reconciliation, privacy boundaries, exact decision-message versions, late evidence at approval/sharing, changed request obligations, source withdrawal recovery, and export contents. The [manual audit](docs/final-workflow-audit.md) records the browser walkthrough and its limits. These checks do not establish legal accuracy, security readiness, or measured time savings.

Browser tests use an isolated server on port 3101 and temporary data. They use Playwright Chromium, falling back to system Chrome on macOS; otherwise install Chromium with `npx playwright install chromium`. Build first so they exercise the current frontend. Type checking also rejects unused imports, locals, and parameters.

Adding prepared cases preserved the four existing case records, three original references, and all ten existing files. The setup was run twice to verify it did not duplicate or reset cases. These preservation checks and the live sample links were verified separately.
