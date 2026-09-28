# Try the prepared review cases

Open **Sample materials → Try a prepared case** from the reviewer workspace. Each entry offers **Review case** and **Submitter page** links, so you can inspect both sides in separate tabs. These are working, fictional records at useful stages, not screenshots. Actions persist. The names below describe their prepared starting states; they may change as people use them. Inside a case, **View submitter page** is also available in the header; link management remains under Case details.

| Prepared case | What is already there | What to try |
| --- | --- | --- |
| **Northstar · October loan launch** | An external submission with an image, caption, intended use, and destination URL; no findings or selected internal reference | Select the Standard personal-loan reference, confirm intake, inspect the original, and add a finding. |
| **Northstar · Fee correction returned** | Shared fee and destination requests; a revised image in version 2; both requests still need a reviewer decision | Compare the old and new images, resolve just the fee correction, then try approval. The missing destination remains a blocker. |
| **Northstar · Destination evidence received** | Fee correction accepted; a response to the remaining request includes a two-page destination PDF | Assess the response beside the creative. Add a revision and select the existing response file as destination material; no second upload is needed. Confirm intake and explicitly resolve the finding using the response. |
| **ClearPath · October social handoff** | Version 3 approved for its stated scope; both findings resolved; saved decision-message draft; result not yet shared | Open the saved reply, inspect its scope, and share it on the submission page. Or inspect how an actual outside communication would be recorded. No email is sent by this app. |
| **Northstar · October campaign approved** | The full correction history, assessed evidence, three versions, a scoped approval, and a shared result | Compare the return page with the internal record. Inspect the exact approved files, scope, accepted requests, historical versions, and ZIP export. This case appears under Completed and Decision record. |
| **Northstar · Offer reference withdrawn** | A completed approval whose separate supporting reference was subsequently withdrawn before sharing | Open the decision-sharing flow and inspect the block. Recovery requires a new revision with the available Standard reference and fresh review; the original approval stays historical. |

The original personal-loan, credit-card, and mortgage examples also remain. **Everyday, simply** shows why a factually accurate no-annual-fee claim still needs disclosure review. **A clearer first step home** shows waiting on a destination. **Make room for what's next** starts with the original loan concerns. Existing user-created cases are preserved.

## How the samples were prepared

Six additional cases were created through the normal submission, revision, response, finding, decision, and sharing APIs. They reuse authored loan images and a PDF to make changes easy to compare. They preserve real original bytes, version relationships, private reasoning, shared instructions, and history. The internal marketer and affiliate use different submitter identities. The internal assembly step names the reviewer explicitly.

All names, campaigns, product facts, findings, and decisions are fictional. There is no automatic detection or real legal clearance. Timestamps reflect setup, not measured turnaround. A separate copied reference is withdrawn for the last scenario; the Standard reference and existing cases are not altered.

To prepare the same stages in a fresh checkout, start the app and then run:

```sh
npm run demo:populate
```

The command defaults to `http://127.0.0.1:3000`; use `DEMO_BASE_URL` for another local port. It accepts only localhost destinations, skips previously completed scenarios, and never resets a case someone has used. If creation is interrupted, it stops on that incomplete case instead of overwriting it. Inspect that case or use a new disposable `DATA_DIR`; do not delete the shared database to reset a demo.

## Why this is part of the product demonstration

A tester should not need to recreate three correction rounds just to inspect a final decision or returned evidence. Prepared stages expose the important interactions while the original files still support a walkthrough from scratch. Putting them in the existing Sample materials dialog keeps demonstration controls out of the everyday review workflow.

Validation covered all six states, their restricted return views, stored-original hashes, the withdrawal sharing gate, and a duplicate run without added cases. Sample setup does not fix the workflow gaps described in the [final audit](final-workflow-audit.md).
