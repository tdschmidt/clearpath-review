# ClearPath: research, product directions, and tradeoffs

**Research date:** September 27, 2026.

**Status:** research and decision history accompanying the implemented application. The build and bounded API/browser workflow tests pass, including the review-record download; public deployment verification is being completed. See the [README](../README.md) for implementation status. Research evidence and software tests establish different things.

**Selected direction:** an approval workspace with direct submissions and substantive human review. All three products share the workflow. V1 preserves original PNG/JPEG and PDF creative, findings, evidence requests, partial revisions, owners, scoped human decisions, and Prepared reply drafts. It includes no email import, live email, automated checks, AI, or OCR. The build budget is 8–12 focused hours within the original 24-hour assignment.

**Reading guide:** the [product story](product-story.md) is the concise account of the problem, people, and decisions. The [workspace plan](approval-workspace-plan.md) is the current scope, and [submission-format findings](submission-format-research.md) explain the input boundary. Section 5 preserves earlier alternatives as decision history, not simultaneous V1 commitments. Email integration is the first V2 candidate; bounded checking follows only if it proves useful.

## 1. Problem and decision criteria

ClearPath Financial is a fictional national consumer-finance company offering personal loans, credit cards, and mortgage prequalification online. It markets through internal channels and affiliate partners. The assignment identifies the compliance marketing team's Excel-and-email approval process as a bottleneck to growth.

The team reviews marketing materials for compliance. That interpretation was confirmed in the project discussion. Exact staffing, approval rules, volumes, and causes of delay were intentionally left open to research and reasonable assumptions.

The key question is therefore **which work inside approval should the product remove or make easier?** The existence of an approval bottleneck is given; its internal distribution of effort is not.

The project discussion establishes these design constraints:

- An interactive URL and GitHub repository are the eventual deliverables.
- The original assignment is a 24-hour prototype; the selected implementation budget is 8–12 hours, using free tools.
- Critical user interactions should work completely, and the implementation should be explainable.
- Less consequential production features can be deliberately omitted.
- AI, a particular stack, and coverage of every product or channel are not specified requirements.

These constraints favor a small complete workflow. They do not establish a preference for any of the product directions below. Local hosting through ngrok is acceptable. Deployment and verification status belong in the [README](../README.md); this research is not evidence of a live deployment.

## 2. Evidence and its limits

Public operating procedures provide concrete examples of the work that marketing approval involves. They are evidence of documented instructions, not direct observation of execution or measured performance.

| Evidence | What it establishes | What it does not establish |
|---|---|---|
| [Affirm custom marketing submissions](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm), updated February 24, 2026 | Partners provide campaign context and assets by email, receive feedback, and reply with revised material. | ClearPath's internal tracking, actual review time, or independent affiliate publishers' universal behavior. |
| [GreenSky Marketing Compliance Guide](https://cms.greensky.com/docs/core/guidelines/marketing-compliance-guide.pdf#page=4), April 8, 2026, p. 4 | Requested edits are followed by resubmission for final approval. | That implementing comments alone grants permission to publish. |
| [Coast2Coast Mortgage advertising policy](https://coast2coastml-help.freshdesk.com/support/solutions/articles/158000458970-marketing-advertising-and-marketing-policy), revised April 6, 2026, sections 11–12 | Email submission, documented approval, reapproval after changes, and retention of final material and context are specified company procedures. | A universal national approval workflow or disclosure checklist. |
| [Credible partner code](https://www.credible.com/legal-pages/code-of-conduct), “Pre-approval” | Covered partner content requires written preapproval, with an editorial exception. | That all editorial mentions are controlled creative, or that written approval necessarily uses email. |
| [Affirm marketing-email guidance](https://docs.affirm.com/developers/docs/email-marketing), “Overview” | Its verbatim-template path differs from custom-campaign submission. | Permission for ClearPath to exempt arbitrary remixes or altered contexts from review. |
| [OCC UDAP/UDAAP handbook](https://www.occ.gov/publications-and-resources/publications/comptrollers-handbook/files/unfair-deceptive-act/pub-ch-udap-udaap.pdf#page=18), December 2024, printed p. 16 | Supervisory guidance discusses reviewing marketing for accuracy and consistency with actual products and operations. | A per-ad statutory signoff mandate or automatic applicability to an independent nonbank company. |

Merchant financing, lender advertising, and affiliate publishing are different relationships. Their procedures inform a plausible reconstruction; they are not interchangeable policies. The sources do not establish ClearPath's queue size, error rate, or expected return on investment.

## 3. Reconstructing the status quo

A plausible baseline is that **email carries the work, Excel summarizes its state, and people keep the two aligned**. The tools are specified by the assignment. Their exact division of labor is an assumption.

| Stage | Likely work | Potential friction |
|---|---|---|
| Submit | Internal marketing or an affiliate supplies copy, files, links, context, and intended dates; a partner manager may forward it. | Missing context, fragmented assets, unclear unit of review. |
| Triage | Identify the offer, current version, review owner, and relevant requirements. | Reconstructing context and searching prior approvals. |
| Review | Compare claims with current offer facts, rules, policies, and the actual presentation. | Evidence lookup, recurring checks, specialist questions. |
| Request changes or information | Explain the concern and what would resolve it. | Fragmented comments, unclear ownership, incomplete answers. |
| Re-review | Compare the new version, verify corrections, inspect other changes, and retain unresolved issues. | Rereading, mismatched attachments, lost findings. |
| Decide and communicate | Record a decision for identified material and use, then communicate it. | Ambiguous approval scope or uncertainty about whether a decision was communicated. |
| Preserve | Retain the reviewed asset, factual basis, and decision history. | A tracker row that no longer agrees with the email thread or files. |

Excel might contain a request ID, requester, product, received date, launch date, reviewer, status, next owner, current file, and decision reference. These are illustrative fields, not recovered columns from an actual lender's workbook.

An illustrative case makes the distinction between analysis and coordination concrete. An affiliate submits a personal-loan page with a fee claim that conflicts with the selected offer and a funding promise lacking support. The next revision corrects the fee wording but does not answer the funding question. The reviewer must recognize one resolved issue, retain the other, identify who owes evidence, and withhold a final decision until the review is complete. A single “pending” cell conceals those different states.

## 4. The reviewer's judgments and the role of guidelines

“Check against guidelines” contains several separate jobs. A useful system needs to distinguish legal requirements, company policy, authoritative product facts, and professional judgment.

| Question | Example | Proposed product treatment |
|---|---|---|
| Which offer and context apply? | Creative refers to a promotion with different dates or fees from the standard offer. | Require or confirm the matching offer/version and intended usage. |
| Does the claim match the facts? | An explicit “no origination fee” claim conflicts with a mandatory fee. | Show the exact claim and authoritative fact; missing facts remain unknown. |
| Does this statement trigger further disclosures? | A covered closed-end ad states a repayment period or payment amount. | Let the reviewer record the relevant rule and evidence question; do not apply one automatic checklist to every product. |
| Does the promise match the customer journey? | Wording implies final approval or unconditional same-day funding. | Compare with the actual operational process and request evidence where needed. |
| Is the evidence adequate? | A savings or performance claim needs support. | Record the evidence question and its owner; an assertion is not its own proof. |
| Does the presentation communicate the qualification? | A disclosure exists in text but is cropped or obscured in the rendered creative. | Inspect the actual rendition; extracted text alone cannot settle this. |
| Is this revision ready for a decision? | A corrected phrase coexists with another unresolved concern. | Reconcile findings individually and bind the decision to the reviewed version. |

For covered closed-end credit, [Regulation Z §1026.24](https://www.consumerfinance.gov/rules-policy/regulations/1026/24/) addresses available terms, rate statements, conditional disclosure triggers, and presentation. Open-end advertising uses a different provision, [§1026.16](https://www.consumerfinance.gov/rules-policy/regulations/1026/16/). This is why product classification matters before running a check. The [FTC substantiation policy](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation) provides a basis for examining support for objective claims.

V1 assists these judgments by keeping creative, context, human findings, and evidence together. It performs no automatic legal checks. Any later automation should not invent financial terms, calculate APR without a defined model, infer that every ad needs the same disclosure, or treat “no automated findings” as legal clearance. A reviewer should be able to inspect the claim, supporting fact, source, and requested action in the same record. Legal and supervisory sources inform these design choices; they do not mandate this software workflow.

### Small refinements carried into implementation

The Intended use prompt explicitly invites relevant geography, affiliate, targeting, and compensation context, including what remains unknown. These details can affect a human review; they are not a mandatory national field list. The resulting context is versioned with the package so later changes do not silently alter the basis of earlier decisions.

The interface retains general review prompts. Expansion into a product-specific legal guide is deferred until primary sources, applicability, and current status have been checked. We did not adopt the external sample's unverified “80%” keyword-coverage claim, outdated consent assertions, or incorrect blanket APR formulations. None became an automated rule or a product accuracy claim.

A portable review-record export was added after the core passed its workflow tests; its download now has browser coverage. The ZIP contains original files, version/context records, findings, decisions, timestamps, and captured decision snapshots where available. It excludes note records and reply drafts but includes internal reviewer reasoning, so it is not an external response. Missing historical snapshots are not reconstructed from current values. Portability helps retrieve reviewed material; it does not establish production audit controls, legal retention compliance, or tamper resistance.

## 5. Three candidate directions — decision history

These alternatives were explored before the current V1 was fixed. Their example prototypes include capabilities that are now deferred. They explain the choice of workflow focus, not the current implementation checklist.

### A. Compliance Review Desk

**Primary user:** internal compliance reviewer.

**Hypothesis:** recurring substantive checks, evidence lookup, and correction writing consume substantial reviewer effort.

**Product:** centralized submission and a review screen pairing the creative with matching offer facts and evidence-linked findings. A reviewer confirms or dismisses findings, requests information or corrections, checks a revision, and saves a final decision.

**Complete prototype:** submit a personal-loan draft; surface an explicit fee contradiction and a separate missing-evidence concern; record feedback; submit a partial correction; resolve the remaining work; approve or reject the exact revision. Test the same claim against different factual contexts.

**Goals:** reduce active review time, evidence searching, and avoidable correction rounds.

**Non-goals:** autonomous legal approval, broad media support, every product, a fifty-state engine, or a full email client.

**Must be right:** matching facts and version; verifiable findings; honest uncertainty and failure states; reviewer authority; persistent, scoped decisions.

**Tradeoff:** this directly assists domain analysis, but does not necessarily remove email coordination. Central intake may add manual copying. Unsupported or low-quality findings can cost more time to verify than they save.

**Best fit if:** representative cases show that first-pass checking and evidence retrieval dominate active effort. It was the initial recommendation when emphasizing a demonstration of substantive compliance analysis.

### B. Revision and Approval Inbox

**Primary users:** compliance reviewer and partner manager.

**Hypothesis:** a substantial part of approval work is reconstructing current material, prior feedback, unanswered questions, and the next action across messages and spreadsheets.

**Product:** a case-based internal workspace that becomes the review queue and decision record for supported work. It joins submissions, creative versions, offer evidence, findings, revisions, and communication drafts. Its central view explains what changed and what remains unresolved.

**Complete prototype:** import a submission and identify its creative/offer; review a fee contradiction and a missing-evidence concern; prepare feedback; import a revision that fixes only one concern; preserve the remaining blocker and owner; review the final correction; record and retrieve an exact-version decision and corresponding reply draft.

**Goals:** reduce re-review effort, status chasing, and reconstruction; improve correction clarity and decision retrieval.

**Non-goals:** a general legal scanner, a complete mailbox client, autonomous approval, a template builder, or post-publication monitoring.

**Must be right:** source/case association, immutable revision history, honest finding states, explicit next ownership, exact decision scope, and separation of internal notes from external drafts. Duplicate imports and stale-version decisions need recoverable behavior.

**Tradeoff:** the product can degenerate into a generic tracker unless it helps verify actual corrections. A small compliance layer and visible source evidence keep it connected to the substantive job. Manual import remains work if mailbox integration is deferred.

**Best fit if:** revision reconciliation, handoffs, and fragmented review evidence are material sources of the stated Excel/email friction. This is the most direct fit to the way the assignment describes the current process.

### C. Approved Campaign Kit

**Primary users:** internal marketers and partner managers; compliance governs permissions and exceptions.

**Hypothesis:** enough campaigns repeat previously reviewed material that controlled preparation can remove avoidable review demand.

**Product:** a small library of complete approved templates tied to current offers and explicit permitted uses. Eligible unchanged use proceeds under an existing authorization; consequential edits or changed context create a review request.

**Complete prototype:** select an authorized offer/template/context and export the matching artifact; edit a consumer-facing claim and complete exception review; attempt reuse outside permitted dates or after authorization withdrawal and receive a concrete blocker.

**Goals:** reduce redundant reviews and avoidable drafting defects; prevent stale material from being reused.

**Non-goals:** arbitrary remixing, automatic approval of novel claims, a full design editor, campaign publishing, or broad partner onboarding.

**Must be right:** reuse permission is explicit and scoped; the exported artifact matches the authorized version; changed content and context are reassessed; expired or withdrawn permissions block future reuse without rewriting history.

**Tradeoff:** this needs a maintained library, marketer adoption, meaningful eligible volume, and authority to permit reuse. It is an explicit company-policy assumption, not a legal exemption. It is less useful for predominantly original affiliate content.

**Best fit if:** repeated eligible work occupies a large share of capacity and ClearPath can credibly authorize that reuse.

## 6. Which most directly addresses Excel plus email?

**Direction B, the Revision and Approval Inbox.** Its unit of work is the approval conversation: current creative, findings, replies, outstanding evidence, next owner, and final decision. It replaces the manual effort of keeping an Excel row consistent with a changing email thread.

| Criterion | Review Desk | Revision and Approval Inbox | Campaign Kit |
|---|---|---|---|
| Direct fit to fragmented Excel/email approval | Partial: consolidates review inputs and checks | Strongest: manages the conversation through to a decision | Indirect: reduces some incoming requests |
| Main capacity mechanism | Fewer expert minutes per substantive review | Less repeated work and coordination per completed case | Less demand for individual review |
| Additional assumption | Repeated checks are a major source of effort | Revisions/handoffs are a major source of effort | Eligible repeat work is common and reuse is authorized |
| Main failure mode | Noisy or unsupported flags | A third tracking system with no substantive assistance | Restrictive templates with low usage or stale approvals |
| Evidence that would change the ranking | Analysis dominates and coordination is already efficient | Import overhead exceeds reconciliation savings | High eligible volume and low maintenance cost |

This ranking concerns **fit to the stated operating problem**, not proven ROI or the evaluator's preferred answer. The earlier Review Desk recommendation emphasized substantive analysis and demonstrable legal reasoning. Focusing explicitly on the Excel/email clue shifts the recommendation to the Inbox.

The selected direction is **workflow as the product, supporting substantive human review**. It does not combine all three full products. Human findings tied to claims and evidence, partial correction handling, and explicit decisions distinguish the workspace from a generic tracker. A broad scanner and campaign builder remain out of scope; even narrow automatic checks are deferred until their usefulness is established.

## 7. Selected prototype boundary

Support one shared human workflow for personal loans, credit cards, and mortgage prequalification. Preserve original PNG/JPEG and multipage PDF creative, accompanying copy, destination proof, and fictional offer context. Other formats are retained for manual download; a supported rendition may still be needed for review. There are no automated compliance checks, AI, or OCR. Supporting all three product categories in a workflow does not imply automated coverage of their obligations or national legal certification.

Core workflow:

1. An internal marketer submits directly, or a partner manager enters context and uploads creative received outside the app. Email messages are not imported.
2. The reviewer confirms the case, offer, and current version; missing context receives a named next action.
3. The reviewer creates findings and evidence requests grounded in the creative. A supported concern stays distinct from a question awaiting evidence.
4. The reviewer prepares an editable correction request from confirmed findings.
5. A partial revision preserves the prior package and unchanged components. The reviewer inspects the changed material and explicitly disposes of outstanding concerns; no semantic or visual diff is promised.
6. The reviewer makes a saved decision on the intended version and context. A reply draft identifies the material in terms the submitter can recognize. Its status is Prepared, never Sent.

The workspace should replace Excel for these supported cases. Requiring staff to update Excel as well would risk introducing a third system. The review-record export supports retrieval, not duplicate manual status entry or a separate reporting dashboard.

### Why email is deferred, not dismissed

| Choice | What it demonstrates | Cost or limitation |
|---|---|---|
| Direct submission — selected V1 | Structured intake, original creative, complete human review and draft preparation | Partner managers still enter material received elsewhere and transfer replies. Count that work. |
| Email import — deferred | Could preserve correspondence and assist revision association | Does not provide automatic capture, mailbox synchronization, or delivery. |
| Live email integration — first V2 candidate | Could remove manual transport and preserve affiliates' existing channel | Adds provider setup, deduplication, attachment acquisition, association recovery, and honest communication states. |

The settled V1 has neither email import nor live inbound/outbound integration. This narrows the efficiency claim. Count direct-entry and reply-transfer effort when evaluating it. A saved decision is not a sent response, and even a future provider acceptance would not establish receipt. Affiliates are not required to adopt a portal; an internal coordinator can submit on their behalf.

### What to cut first

Cut broad format support, advanced routing, extensive dashboards, email integration, all automatic checking, open-ended rewriting, enterprise identity, and continuous affiliate monitoring before cutting persistence, original creative, exact-version decisions, actionable findings, or the correction loop. V1 uses no AI or OCR. After email, narrow fee comparison, APR-location assistance, and repayment-disclosure lookup are possible follow-ups only if they reduce a demonstrated task and remain grounded in reliable evidence.

## 8. Consequential acceptance cases

These cases define the proposed product's quality bar; they are not claims of completed implementation.

| Case | Required behavior |
|---|---|
| Concern versus evidence request | The reviewer can distinguish a supported concern from a question awaiting information, with its owner and basis. |
| Partial correction | One finding can be resolved while another stays open with an owner and next action. |
| Reused filename | New content becomes a separate revision; filename equality is not content identity. |
| Changed offer/context | Unchanged words do not inherit an approval whose factual basis no longer matches. |
| Failed upload or unsupported preview | Identify failures; preserve other-format originals for manual download without implying they were inspected or approved. |
| Stale action | An action against an older revision cannot silently approve the latest one. |
| Missing evidence | Record the unresolved dependency and next action rather than manufacturing a favorable finding. |
| External communication | Internal notes stay out of Prepared drafts; saving a reply cannot imply that it was sent. |
| Reload | Findings, versions, dispositions, and the saved decision remain retrievable. |

For the selected 8–12-hour build, preserve realistic visual input within an explicit envelope and provide visible recovery beyond it. Comprehensive support for every communication or legal edge case is not required to make the chosen human review path dependable.

## 9. Measuring whether the product helps

Compare matched fictional cases in the reconstructed email/Excel process and the prototype. Include at least a straightforward review, a missing-information case, and a multi-round revision. Use comparable unfamiliar cases where possible to reduce rehearsal effects.

Measure separately:

- Active reviewer minutes and evidence lookups per supported decision.
- Coordinator entry/reply-transfer effort and submitter effort.
- Waiting on reviewers versus waiting on other people.
- Correction rounds and time spent reconstructing prior work.
- Missed seeded concerns, unsupported findings, and incorrect-version decisions.
- Ability to retrieve the exact approved material and decision basis.

Count unique submissions reaching supported decisions; do not count every scan or revision as additional throughput. For the Campaign Kit, count reuse separately and include library-maintenance effort. Faster results with missed material issues are not success.

No numeric improvement is assumed. Authored fixtures can demonstrate bounded behavior, not production legal accuracy or a causal real-world throughput claim.

## 10. Assumptions to validate after the selected scope

1. Revision reconstruction and coordination consume enough effort to justify the workspace.
2. Staff can replace the supported Excel queue instead of maintaining both systems.
3. The benefit exceeds direct-entry and reply-transfer effort before email integration exists.
4. PNG/JPEG and PDF proofs cover enough realistic work to make the chosen input boundary useful.
5. Human findings and scoped decisions are valuable before any automatic checks are introduced.

The highest-value real-company validation would be a completed review chain, a revision-heavy chain, their tracker rows, the product facts used, and the applicable approval policy. ClearPath is fictional, so implementation proceeds with these stated assumptions. Public research supports a realistic process; it does not substitute for measurements that do not exist. Current implementation and test status are recorded separately in the [README](../README.md).
