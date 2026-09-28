# Completing the consequential parts of review

The assignment asks for greater review throughput; the call asks us to explain which interactions must be right. These follow-up changes address mistakes within the existing review loop, rather than adding more integrations or claiming automated legal review.

## Make the card example's unfinished review actionable

The card example had a note about disclosure review but no required finding. That made a known unanswered question easy to miss when recording approval. It now includes an authored finding, linked to the image, with a request for the missing offer terms and revised material. The same fee claim appears in the caption, so correcting only the image is insufficient.

[Regulation Z §1026.16(b)(1) and comment 1](https://www.consumerfinance.gov/rules-policy/regulations/1026/16/#b-1) explicitly address negative annual-membership-fee claims. For this fictional consumer credit card, calling the creative brand awareness does not finish disclosure review. We retain the incomplete source and original creative as evidence; we do not invent missing rates or present a corrected example as legally approved.

Fresh examples include this authored finding. Existing records are not silently reseeded or rewritten. The live sample received the same finding through the normal review action, preserving its original note, attachments, context, and history. Its older context description excludes a pricing claim, while the image and caption contain the fee claim; the new finding makes the actual content actionable without rewriting what was submitted. New user submissions still receive no automatic findings.

## Make the limits of approval easier to state

The scope field already travels with the decision and shared result. Its prompt now asks about placement, audience/geography, run period, exact material, and relevant product/entity assumptions. Intake asks for planned run dates as context. An example illustrates the level of specificity without filling in fictional coverage for the reviewer.

[Affirm's submission procedure](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm) requests campaign location, audience, medium, dates, and destination details. That supports these prompts, not a universal field checklist. The tradeoff is deliberate: retain flexible human scope instead of introducing mandatory jurisdiction questionnaires, campaign scheduling, or an expiry engine. A written end date does not stop an advertisement running.

The in-app guide now ends with the actual feedback and decision handoffs. It explains that receiving a response, resolving a finding, recording a decision, and communicating it are separate actions because each has a different consequence.

## What these changes do not establish

The workspace uses one fixed demonstration reviewer, and people supply the references and their claimed authority. The export helps retrieve evidence; it is not a tamper-resistant archive. Neither successful workflow tests nor a plausible bottleneck hypothesis establishes regulatory completeness or measured throughput improvement. [The research map](regulatory-design-basis.md) separates legal requirements, company procedures, and our design choices.

## Verification and the next useful corrections

The final build passed 33 API tests and 19 browser tests. The correction-round tests cover separate affiliate/reviewer actions, partial creative changes, remaining blockers, returned evidence, and an exact shared decision. The returned-file path deliberately requires inclusion in a new package when it becomes the reviewed destination; it reuses the stored attachment rather than requiring a second upload. This protects decision scope but still costs a review step. We have not measured whether that effort produces a net time saving with real reviewers.

Visual checks confirmed the withdrawal warning, recovery links, required card finding, and scope prompt. Deployment preserved the other three live cases, all three reference records, and all ten original files. The card received one new finding/history event through its ordinary API, with no retroactive edits.

The [follow-up audit](focused-follow-up-findings.md) put two corrections ahead of new features: require considering unassessed evidence at approval, and detect changed instructions that need to be re-shared. Both are now implemented and tested in the [readiness fixes](submission-readiness.md). Email integration and broader analysis remain separate directions.

## Remove the participant switcher

The selector changed action attribution while leaving almost the same screen visible. It looked like a stakeholder-view switch but did not provide one. We removed it and use Maya Chen as the fixed demonstration reviewer, ignoring any earlier session selection. Case ownership and historical authors remain separate records. Affiliates still use the submission page and their case return link; this change does not merge those experiences or add authentication.
