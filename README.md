# ClearPath Review

A marketing-approval workspace for a fictional consumer-finance company, with a separate submission and correction journey for affiliates. Creative, references, findings, revisions, and human decisions stay in one record.

**[Reviewer workspace](https://award-harrison-explore-messaging.trycloudflare.com)** · **[Submit material](https://award-harrison-explore-messaging.trycloudflare.com/submit)** · [Private GitHub repository](https://github.com/tdschmidt/clearpath-review)

The production build, **31 API tests**, and **18 browser workflow tests** pass. The updated public workspace, submission page, source preview, API, originals, and ZIP download were verified on September 27, 2026. This temporary URL works while the Mac, server, and tunnel stay running; restarting the tunnel creates a new URL.

Start with [what we built and why](docs/delivery-rundown.md) for the working product, audit changes, stakeholders, and deliberate limits. The [regulatory design basis](docs/regulatory-design-basis.md) maps specific sources to implemented choices and distinguishes legal requirements from product judgment. The [original product story](docs/product-story.md) reconstructs the process and bottleneck hypothesis; [research and alternatives](docs/research.md) and [submission-format evidence](docs/submission-format-research.md) provide supporting detail.

The [automated-review decision](docs/research.md#decision-defer-automated-substantive-review) explains why rules, Jev, and LLM assistance were investigated and left outside this project. The [detailed research](docs/jev-ad-review-research.md) preserves their potential uses and a conditional evaluation plan.

The [audit resolution](docs/audit-resolution.md) separates working features from remaining demo boundaries. The [first implementation decisions](docs/implementation-decisions.md), [core workflow decisions](docs/core-workflow-decisions.md), [reviewer decisions](docs/reviewer-workflow-decisions.md), and [affiliate decisions](docs/external-workflow-decisions.md) connect focused commits to observed problems.

## Current scope

Affiliates submit through `/submit` and keep a case return link. Reviewers choose a preserved offer reference, inspect material beside facts and findings, share selected feedback, and reconcile partial revisions. Returned evidence creates review attention and can be inspected beside the creative. Responses never close findings automatically. Decisions identify an exact package and scope; outstanding communication remains actionable until the result is deliberately shared or outside communication of an exact decision message is recorded. Old decisions and withdrawals remain inspectable.

PNG/JPEG and multipage PDF previews work, including selectable embedded PDF text. Other formats remain downloadable. References have manually entered facts and page citations. **History & notes → Download internal record** exports verified original files, source documents, review snapshots, and handoffs. It includes internal reasoning; it is not an external reply.

Uploads allow up to **10 new files**, **10 MB each**, and **25 MB total per submission or revision**. Email imports, live email, automated compliance checks, AI, and OCR are deferred.

This is an **unauthenticated, shared demonstration**: use fictional material only. Anyone can open the reviewer dashboard and change records as a simulated participant. Return pages and APIs expose only submitted or deliberately shared material, but they do not secure the separate open reviewer dashboard. Local records and uploads live under the ignored `data/` directory by default; they are not committed to Git.

## Run locally

Use Node.js **24.14.0** (the supported engine range is `>=24.14.0 <25`) and npm.

```sh
npm install
npm run dev
```

Development uses Vite at `http://localhost:5173` and Express at `http://localhost:3000`. The stack is React, Vite, Tailwind CSS, Express, TypeScript, and Node's built-in SQLite. Persistent local data uses `DATA_DIR`, defaulting to `./data`. Upgrading the original schema creates a `workflow-before-v2-*.sqlite` backup before migration. Existing cases and file IDs are preserved; old findings stay internal until explicitly shared.

For the built application:

```sh
npm run build
npm start
```

Open `http://localhost:3000`. For temporary public access, Cloudflare Quick Tunnel is the current fallback because ngrok is not configured. With `cloudflared` installed separately:

```sh
cloudflared tunnel --url http://localhost:3000
```

The locally downloaded binary is `data/tools/cloudflared`; it is ignored by Git and is not part of a fresh clone. The Mac must remain awake and the application server and tunnel process must remain running. An installed and configured ngrok can also expose port 3000. The temporary link has no uptime guarantee; reopen it before sending it to a reviewer.

## Try the review loop

Follow the [short walkthrough](docs/demo-walkthrough.md): submit an image, share two requests, return a partial correction, supply the destination PDF, and record and publish a scoped decision. To start with authored material, open **Make room for what’s next**; legacy findings begin Internal, so choose their audience before sharing.

Seeded findings are written examples, not automatically detected results. A fresh submission starts without findings. The goal is a complete review loop, not automatic legal clearance or measured time savings.

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

The final build and **31 API / 18 browser tests** passed on September 27, 2026. Checks cover actual image/PDF uploads, exact source-page citations, partial corrections, server approval gates, private-field exclusion, frozen shared feedback, draft recovery, stale decision acknowledgment, reference versioning, withdrawal, and ZIP contents/download. Added regressions exercise returned evidence in a waiting case, request lists across feedback batches, changed-reference rechecks, internal and external draft conflicts, explicit inclusion of response files, and decision communication bound to an exact message version.

A migration rehearsal preserved all four existing live cases and verified all seven original files by SHA-256. The subsequent core-fix deployment left all four case records byte-for-byte unchanged and verified all seven submitted originals plus three reference originals against their stored hashes. The public queue, submission form, adjacent source preview, current build, API, originals, references, and ZIP download were checked again. These are workflow checks, not legal-accuracy measurements, authenticated access controls, or proof of time savings.

Browser tests use a separate server on port 3101 and temporary data. They use Playwright Chromium, falling back to system Chrome on macOS when available; otherwise run `npx playwright install chromium`. Build first so browser tests exercise the current frontend.
