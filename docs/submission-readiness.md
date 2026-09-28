# Submission readiness fixes

These changes close inconsistencies in the existing review loop. They do not expand into email integration or automated compliance judgment.

## Consider received evidence at the final action

Approval and approval sharing now require assessment of every pending response. A final action uses the current case version, so an answer arriving while the form is open causes a conflict instead of being skipped. Rejection remains possible. Assessment records a human action; it neither resolves findings nor rewrites an existing decision. If later evidence changes an approval, the reviewer must withdraw it and resume review. Courtesy replies can be assessed without a mandatory essay.

An earlier package's decision also cannot be newly published after a revision arrives. Its historical record and any previous communication remain available. Recording an outside communication retrospectively is still allowed because it records what happened, not permission to send.

Why spend time here: the queue already identifies returned evidence as work. The final action must honor that work. The [FTC substantiation policy](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation) informs the importance of evidence before dissemination; this exact gate is a product decision, not a prescribed regulatory mechanism.

Validation: an API regression first reproduced the bypass, then passed with the gate. A browser regression follows response → blocked approval → assessment → approval → late response → blocked sharing → assessment → shared scoped decision, including private-note exclusion. Existing tests verify that assessment alone cannot resolve a finding.

## Keep the recipient's instructions current

The unshared indicator now compares title, request, required/advisory status, location, and public file/page citations against the latest shared request. Reverting to an older instruction still requires sharing when it differs from the latest message. Internal analysis, ownership, and private evidence do not create communication work. A new package alone does not make unchanged instructions unsent.

The same public-field projection is used for publishing and comparison. Old messages remain immutable; a changed request is explicitly marked in the reply composer and reaches the submitter only after deliberate sharing. Received responses take priority over preparing another message. This supports the real correction-and-resubmission loop described in the [research](research.md), without adding email integration.

Validation covers advisory-to-required changes, location and PDF-page corrections, reverting to older wording, private-only edits, and unchanged instructions across revisions. The browser test checks the unsent warning, deliberate re-sharing, and the resulting submitter snapshot.

## Attribute internal revisions to their recorder

An internal revision now defaults “Updated by” to the active demo reviewer, rather than the original affiliate. The case contact remains unchanged. This prevents silently attributing the review team's package assembly to the person who supplied the material. Authenticated identity remains a production requirement; this fixes the demonstrator's misleading default.

## Keep evidence tied to the selected finding

Selecting another finding clears the previous source/evidence pane before opening that finding's original material, if any. An uncited request must not inherit an unrelated image from the previous assessment. This addresses a misleading visual context without changing preserved evidence or adding document analysis.

## Make source withdrawal actionable before sharing

The queue and case banner identify a withdrawn reference supporting the current approval, including a result already shared. The next action leads to a new revision with a current source; the old decision stays in history. Withdrawn sources cannot be newly selected in the submission picker, while an existing historical selection remains visible and labeled. Nothing silently substitutes a new reference or revokes a human decision.

Completed-case banners also distinguish a shared result, a recorded outside communication, and an uncommunicated decision. Only the latter asks for a handoff; recording an email does not claim verified delivery. These corrections keep next actions consistent with the record and avoid redundant work.
