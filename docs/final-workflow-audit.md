# Final workflow audit

September 27, 2026. The core review loop works, but passing tests do not mean every consequential edge case is covered. This audit used a separate temporary database and fictional affiliate material; it did not alter the live demo's cases or send email.

## What was tested

The production build, all **33 API tests**, and all **19 browser tests** passed. After the reference-preview correction below, the build and focused reference-version browser test passed again. Existing tests cover original-file preservation, citations, partial revisions, approval gates, private-field exclusion, draft recovery and conflicts, exact decision-message versions, withdrawn-reference recovery, and record export.

In the in-app browser, I completed a fresh affiliate submission with a real PNG, reviewed it internally, shared two requests, and returned a partial correction with a replacement PNG. Resolving only the fee concern left approval disabled while the destination request remained open. The affiliate then supplied a two-page PDF; both pages rendered beside the creative. The reviewer incorporated that existing attachment into a new package without uploading it again, assessed the response through the finding disposition, recorded a scoped approval, and deliberately shared it. The return page showed the approved version and files without internal reasoning. History and the downloaded ZIP contained the resulting record. Empty-form validation and the reference-library citation flow were also checked.

**Fixed during the audit:** the reference-library PDF was blank in the in-app browser because it used a native iframe. It now uses the same working document viewer as the review workspace. The updated browser test verifies rendered PDF content, and manual inspection confirmed the document appears beside its facts. This is a source-inspection fix, not an additional compliance feature.

## Remaining workflow defects

These are observed gaps in the existing experience, not production features deliberately excluded from scope.

| Priority | Finding | Consequence and next correction |
| --- | --- | --- |
| High | An affiliate can supply new evidence after a required finding is resolved; approval can still be recorded while that response is unassessed. Reproduced in an isolated store. | A final action can bypass review work already surfaced elsewhere. Require explicit human assessment of pending responses at approval, including a concurrency check. Consider the same warning when new evidence arrives before sharing a recorded approval. |
| High | Changing a shared request from advisory to required leaves the affiliate's old snapshot unchanged and the unshared indicator at zero. Reproduced in an isolated store. | The affiliate may not know that the obligation changed. Compare all recipient-visible fields with the latest shared snapshot and offer deliberate re-sharing; retain the old record. |
| Medium | An internal revision's “Updated by” field defaults to the original affiliate. Observed while the reviewer assembled the returned PDF into version 3. | Leaving the default attributes the assembly action to someone who did not perform it. Separate the person supplying material from the person recording the revision; production actors must come from authenticated identity. |
| Medium | An unchanged request is considered unshared again after a new revision. Observed after the partial correction. | “Prepare feedback” can compete with assessing what the affiliate just returned and encourage redundant messages. Track which instructions actually changed and prioritize assessment of returned work. |
| Medium | Switching from a cited finding to an uncited finding can leave the previous finding's original image in the evidence pane. Observed before opening the destination response PDF. | The pane can suggest irrelevant context. Clear or explicitly label retained evidence when the selected finding changes. The persisted files themselves remain correct. |
| Lower | A withdrawn reference still appears like a normal option in the internal submission/revision picker. Existing intake validation prevents its use. | Prevent avoidable selection mistakes while preserving historical references; do not silently choose a replacement. |
| Lower | The completed-case banner still says “Share the result” after the decision has been shared. Observed on the approved manual case. | Make this banner reflect the recorded handoff, as the queue already does. |

The first two are the strongest next fixes because they affect whether the reviewer and affiliate act on the same, current information. Detailed reproductions and product reasoning are in [Further gaps worth addressing](focused-follow-up-findings.md). They remain unimplemented after this audit.

## Full-product limitations worth discussing

- **Access and accountable identity:** the reviewer workspace is an open demonstration with a fixed simulated reviewer. External return links expose a restricted view but do not secure the separate internal dashboard. Real deployment needs authenticated roles, partner isolation, revocable access, and reliable authorship.
- **Communication:** sharing updates the return page; it does not send email or prove receipt. Email notifications and then email intake are high-value extensions because affiliates should not have to continually check a new portal or abandon their existing channel. Delivery, failures, duplicate imports, and replies need explicit handling.
- **Approval scope over time:** run dates are prompted in free text, with only the launch date structured. The application does not stop an expired campaign, monitor published ads, or proactively coordinate every prior approval affected by a withdrawn reference. Preserve approval history while creating new human review work when its basis changes.
- **Evidence and regulatory coverage:** PNG/JPEG and PDF are inspectable; other formats require manual download. There is no OCR, video review, live-page capture, automated legal analysis, or maintained exhaustive rule library. References and findings are human-entered. A complete workflow is not a claim of complete regulatory coverage or legal accuracy.
- **Operational durability:** local SQLite, preserved originals, and ZIP exports demonstrate persistence and portability, not tested disaster recovery, immutable retention, legal holds, or a managed service. The temporary tunnel also depends on the Mac remaining awake.
- **Evidence of usefulness:** the walkthrough establishes functional behavior, not measured throughput improvement. Real reviewers should validate time spent reconstructing packages, avoidable correction rounds, missed handoffs, and whether the source/creative layout helps them make decisions.

The audit did not constitute a security assessment, load test, exhaustive browser/device or accessibility audit, or legal review. Human compliance decisions are an intentional boundary; making current evidence, instructions, ownership, and scope reliable is the product's responsibility.
