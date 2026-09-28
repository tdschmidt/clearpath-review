# ClearPath Review

An internal marketing-approval workspace for a fictional consumer-finance company. It brings creative packages, findings, evidence requests, revisions, owners, and human decisions into one record.

**[Open the live demo](https://award-harrison-explore-messaging.trycloudflare.com)** · [Private GitHub repository](https://github.com/tdschmidt/clearpath-review)

The production build, 11 API tests, and 3 browser workflow tests pass. Public page, API, original previews, and ZIP download were verified on September 27, 2026. This temporary URL works while the Mac, server, and tunnel stay running; restarting the tunnel creates a new URL.

Start with [why this product](docs/product-story.md) for the process reconstruction, stakeholders, bottleneck hypothesis, and deliberate cuts. The [current scope](docs/approval-workspace-plan.md), [research and alternatives](docs/research.md), and [submission-format evidence](docs/submission-format-research.md) provide supporting detail.

## V1 scope

Direct submissions and human review for personal loans, credit cards, and mortgage prequalification. Preserve original PNG/JPEG and PDF creative, supporting copy and versioned context; record findings and evidence requests; handle partial revisions; approve an exact package version; prepare reply drafts labeled **Prepared**, never **Sent**. Other file types are retained for manual download, with no preview or analysis promised. Download an internal ZIP review record from **Activity & notes**; it includes reviewer reasoning and excludes note records and reply drafts, so it is not an external reply.

Uploads allow up to **10 new files**, **10 MB each**, and **25 MB total per submission or revision**. Email imports, live email, automated compliance checks, AI, and OCR are deferred.

This is an **unauthenticated, shared demonstration**: use fictional material only. Everyone with access shares the workspace and can change its records. Local records and uploads live under the ignored `data/` directory by default; they are not committed to Git.

## Run locally

Use Node.js **24.14.0** (the supported engine range is `>=24.14.0 <25`) and npm.

```sh
npm install
npm run dev
```

Development uses Vite at `http://localhost:5173` and Express at `http://localhost:3000`. The stack is React, Vite, Tailwind CSS, Express, TypeScript, and Node's built-in SQLite. Persistent local data uses `DATA_DIR`, defaulting to `./data`.

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

Open **Make room for what’s next**, inspect its two authored findings, prepare feedback, replace the original social image, and leave the missing destination open. Add the two-page destination proof in a later revision, resolve the remaining work, and record a scoped human decision. Follow the [short walkthrough](docs/demo-walkthrough.md) for exact files and actions.

Seeded findings are written examples, not automatically detected results. A fresh submission starts without findings. The goal is a complete review loop, not automatic legal clearance or measured time savings.

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

The build, **11 API tests**, and **3 browser tests** have passed. Coverage includes real image/PDF uploads, original bytes, partial revisions, unresolved-finding approval gates, internal-note/rationale exclusion from drafts, persisted decisions, version context, decision snapshots, ZIP contents and download, all-product intake, and stale-tab rejection. The three sample cases also survived an application-server restart. These are bounded workflow checks, not a claim of production completeness.

Browser tests use a separate server on port 3101 and temporary data. They use Playwright Chromium, falling back to system Chrome on macOS when available; otherwise run `npx playwright install chromium`. Build first so browser tests exercise the current frontend.
