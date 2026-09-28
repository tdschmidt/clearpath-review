# Decisions made after the audit

The [audit](ux-product-audit.md) examined the first working build. Its findings changed the implementation, not the core hypothesis: the supplied problem names coordination through Excel and email as the bottleneck. We are making that review loop easier to complete and inspect. We have not measured ClearPath's process or proved a reduction in review time.

This log accompanies small implementation commits. It records the reason for each choice; the [product story](product-story.md) provides the original process reconstruction and research.

| Decision | Evidence and reason | Boundary |
|---|---|---|
| Require a basis for findings and a rationale for decisions on the server. | The audit reproduced requests that bypassed required form fields. A preserved approval is difficult to defend without its reason. | These are record requirements, not tests of legal correctness. |
| Give submitters a separate form and case return link. | The first build placed affiliate submission inside the internal reviewer workspace. Submission, corrections, and responses must form a complete external journey. | The reviewer dashboard stays an open demonstration. Scoped return pages are a workflow boundary, not production confidentiality or authenticated identity. |
| Attribute actions to explicitly simulated participants. | Ownership and internal specialist dependencies matter to queue coordination. One hard-coded reviewer obscured that. | No accounts, enterprise roles, invitations, or notification delivery. |
| Preserve references and select their applicability deliberately. | A hard-coded offer catalog cannot accommodate another campaign. A submitter's uploaded claims do not establish authoritative terms. | Human-entered facts and citations; no extraction, legal checklist, or automatic compliance judgment. |
| Put material, applicable facts, and finding edits together. | The audit showed that the modal hid the evidence being reviewed and new findings defaulted to the wrong file. | File/version/page references before drawing annotations or semantic comparison. |
| Separate audience, owner, and blocking status. | The previous draft generator could turn an internal question or advisory comment into a mandatory affiliate correction. | Only explicitly shared snapshots appear on the return page. Preparing, sharing, and recording outside communication are separate actions. |
| Preserve revisions, decision snapshots, and withdrawals. | The research emphasizes reviewing corrected material; a later file must not inherit an earlier approval. | A withdrawal records a changed decision. It does not prove that an advertisement was removed. |
| Keep drafts and recover from conflicting saves. | Losing rationale or uploads during an ordinary close or stale save creates more work and discourages careful records. | Local draft recovery is not server collaboration or a promise that uploads survive browser restart. |

The user explicitly chose a working submission portal before email integration. This still costs affiliates an extra step. Email intake remains a conditional next step if transfer effort proves material; automatic analysis stays deferred under the [research decision](research.md#decision-defer-automated-substantive-review).

## Verification

The first audit follow-through passed 21 API tests, 7 browser tests, and the production build. Tests used actual files and separate sessions: submit, share feedback, return a partial correction, resolve individually, and record an exact decision. They also covered internal-data exclusion, historical file/page citations, reference versions, and preserved input after a stale approval attempt. A migration rehearsal retained all four live cases and verified all seven originals; the live upgrade and public entry points were then checked. The [delivery rundown](delivery-rundown.md) covers the subsequent core fixes; the [README](../README.md#verification) records the latest test results. The [resolution table](audit-resolution.md) and [walkthrough](demo-walkthrough.md) state the remaining boundaries.

Browser review produced two further decisions: an unavailable citation must show an error rather than silently substituting another page/file, and a reopened finding draft must retain the context version it was written against. Both prevent plausible-looking evidence from being mistaken for the evidence actually reviewed. The sample card narrative was also corrected for future seeds: matching a no-annual-fee fact does not complete advertising review. Existing historical records were left intact.
