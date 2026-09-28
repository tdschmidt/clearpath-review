# Further gaps worth addressing

September 27, 2026. Read alongside the [implemented approval-sharing check](approval-sharing-decision.md). This document preserves the original findings and recommendations. **Items 1–3 are now implemented**; see the [readiness decisions](submission-readiness.md) for final behavior and tests. Item 4 remains a later direction. The priorities follow the assignment's throughput goal and the call's emphasis on completing consequential interactions within a 24-hour project.

The first two behaviors were reproduced using fictional records in an isolated database. The source paths identify the relevant implementation. No live review records were changed. Published procedures support the workflow assumptions; they do not establish ClearPath's frequency or measured time savings.

## 1. Bring unassessed evidence into the approval decision

**Observed:** a required evidence finding was resolved. The submitter then replied that the earlier evidence concerned a different offer and should not be relied on. The response was correctly marked unassessed and surfaced in the queue, but a new approval still succeeded. The isolated result was one pending response, an approval recorded, and no response assessment. The [decision form](../src/forms.tsx) checks intake and unresolved findings; the [server approval action](../server/store.ts) does the same. Neither requires considering pending responses.

**Why this matters:** the product already promises that returned evidence creates review work. Letting the final action bypass that work weakens the promise. A person may have read the answer, so this is not proof of an erroneous legal judgment; the record and interface fail to establish how it was considered.

**Smallest defensible change:** show the unassessed answers in the decision form with a route to their evidence. Require explicit assessment before approval; existing assessment can record that an answer changes nothing. Use exact response IDs and the current case version so an arriving answer cannot be silently missed. Keep rejection available with a reason. Apply the same point-of-action warning to evidence arriving between a recorded approval and its publication, without automatically revoking the historical approval.

**Avoid:** language-model inference that an answer is dangerous, automatic finding resolution/reopening, or a lengthy mandatory explanation for an irrelevant courtesy reply. Human acknowledgment should be quick; substantive findings remain separate. Acceptance test: a corrected evidence response interrupts approval until assessed, while assessment alone cannot close another unresolved finding.

**Research connection:** the [FTC substantiation policy](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation) explains the need for an appropriate basis for objective claims before dissemination. It does not prescribe a response-assessment gate; this is our product response to potentially changed evidence.

## 2. Detect every meaningful change to already-shared requests

**Observed:** an advisory request was shared, then changed internally to required without changing its title or requested wording. The internal finding now blocked approval, the external snapshot still called it advice, and the workspace's unshared-request indicator remained zero. The [comparison in the review workspace](../src/ReviewWorkspace.tsx) checks title and request text, but not required/advisory status, location, or material citations.

**Why this matters:** preserving a shared snapshot is correct. Failing to show that the recipient has different instructions creates avoidable chasing and incomplete responses. The affiliate cannot act on a changed obligation they have not been told about.

**Smallest defensible change:** compare the complete recipient-visible request with the latest shared snapshot and show “Updated request not yet shared.” Include required/advisory status, location, and file/page citations; exclude purely internal edits. Require deliberate re-sharing, retain the old message, and keep the recipient's current task list accurate. Acceptance tests should cover advice becoming required, a corrected citation, and an internal-basis-only edit that does not create unnecessary communication work.

**Research connection:** [Affirm's published submission process](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm) describes recipients incorporating feedback and returning revised assets. Keeping their current instructions accurate supports that loop; the source does not mandate our snapshot design.

## 3. Make withdrawn references recognizable during intake

**Code-confirmed, also encountered during browser testing:** the internal submission/revision form lists withdrawn references like current ones. Intake later prevents their use. The safety gate works, but a coordinator can unknowingly select a reference that cannot support the next step. The [offer picker](../src/forms.tsx) filters by product only.

**Smallest useful change:** exclude withdrawn references from new selections, while visibly retaining an already-selected historical reference with an explanation and replacement path. Do not silently substitute a new source. This is a small consistency fix, not reference governance or a legal determination. It has lower consequence than the first two findings because the existing intake gate catches the problem.

## 4. Capture the intended run period for limited promotions

**Research-backed opportunity, not a reproduced approval bug:** structured context contains a launch date but no campaign end date. The reference-date check compares only that launch date. A campaign can start during an offer's valid period and continue afterward; its duration can currently be recorded only in free text and decision scope.

The subsequent [scope refinement](compliance-review-follow-up.md) explicitly prompts for run dates in those existing fields. A structured run period, mismatch handling, or expiration control is still unimplemented.

[Affirm requests an expected end date and promotion start/end details](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm). [Regulation Z §1026.24(a)](https://www.consumerfinance.gov/rules-policy/regulations/1026/24/) requires covered advertised terms to be actually available and recognizes limited-period offers. These support asking about timing, not automatically treating a date mismatch as a violation.

**Smallest useful change:** for a limited promotion, capture intended end date or explicitly unknown/open-ended use, preserve it with the package and decision, and surface a mismatch with the recorded offer period for human consideration. Do not imply that the application stops campaigns or certifies offer availability. This is a more defensible later addition than generic mandatory fields for every submission.

## Recommendation

The unassessed-evidence and changed-request gaps were addressed first because they closed inconsistencies inside the workflow already built. The reference picker followed as a small companion refinement. Structured promotion duration can wait unless demonstrating time-limited offers becomes central. Notifications, email ingestion, broad format support, and automatic substantive analysis remain separate directions; this audit does not reopen their implementation scope.
