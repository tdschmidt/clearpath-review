# Remaining workflow gaps and V2 priorities

Audit of commit `4e68de1`, September 27, 2026. This is a recommendation, not a new implementation commitment. Application behavior and live review records were not changed.

**Subsequent implementation:** the user authorized the core corrections and a [focused guard before sharing approval on a withdrawn reference](approval-sharing-decision.md). The [delivery rundown](delivery-rundown.md) and linked decision records describe that work. This audit remains the original findings and prioritization; its V2 proposals are not claims of implemented features. [Later focused findings](focused-follow-up-findings.md) record additional proposed corrections.

The strongest next investment is completing the return loop: a person supplies an answer, the right reviewer notices it, inspects its evidence, and makes an explicit disposition. The product already preserves much of the record correctly, but still makes people coordinate and reconstruct too much of the work.

## Basis and limits

The supplied call emphasized getting the critical user experience right, understanding why it works, and deliberately cutting less important production scope. We assessed the current interface, source, and existing test scenarios against that standard. Three backend state scenarios were reproduced in an isolated temporary database: a response while waiting, changing a reference during re-intake, and publishing an existing approval after reference withdrawal. The stale external draft scenario below is code-confirmed, not browser-reproduced. No throughput study or new full test-suite run was performed.

ClearPath's actual volumes, review times, and division of responsibility remain assumptions. Published procedures support the workflow hypothesis: [Affirm's submission process](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm) asks for campaign context, legible assets, and relevant destinations, then returns feedback and receives revisions through email. It also asks for channel-specific details such as email subject and preheader. This is evidence of one company's operating process, not a universal requirement.

For covered closed-end credit, [Regulation Z §1026.24](https://www.consumerfinance.gov/rules-policy/regulations/1026/24/) connects advertised terms to actual availability and contains conditional disclosure and presentation requirements. That supports preserving the actual creative, applicable facts, and use context. It does not prescribe our workflow or establish that an automated scanner is needed. Both sources were checked during this audit.

## What is already worth defending

- Separate affiliate submission and return pages fit the outside participant's job. Internal reasoning and deliberately shared requests are separate.
- Original files, replacement relationships, earlier packages, and scoped human decisions are real persisted records. Partial corrections do not erase independent concerns.
- Creative and offer evidence can be inspected together. Exact PDF citations fail visibly when invalid instead of silently displaying another page.
- A saved draft, a shared portal result, and recorded outside communication have distinct meanings. The application does not claim delivery or legal clearance it has not established.
- Manual review remains a defensible scope choice. We have not established that claim analysis dominates delay or that a model would reduce total reviewer effort.

## Fix within the chosen core workflow

### 1. Received evidence must be usable and must create work for the reviewer

An affiliate can attach a requested PDF to a response. The server stores it, but the reviewer response card renders only text and finding numbers. The package viewer lists package components, so it does not expose these response-only files either. The file can be recovered through the record export/API, but not through the ordinary review interaction. See [response storage](../server/store.ts#L320) and [reviewer response rendering](../src/ReviewWorkspace.tsx#L2266).

The same response leaves the case `waiting` with its previous next owner. The default To review queue excludes waiting cases. Specialist answers have the same attention gap. The submitter has done their part, yet the coordinator must discover the response and resume the case manually. See [queue filtering](../src/App.tsx#L538) and [specialist response](../server/handoffs.ts#L102).

**Decision:** expose response attachments beside the answer and linked finding; provide preview/download and a citation. Surface unassessed responses in the actionable queue. Preserve other outstanding dependencies and require human assessment. A response must neither resolve a finding nor silently become replacement advertising. If an uploaded destination is intended to replace the reviewed page, explicitly add it to the next package with that role.

**Why first:** this is a broken handoff in the exact workflow the product promises to improve, not an optional integration.

### 2. Changing the review basis must require reconsidering earlier resolutions

Re-intake can change `revision.offerId` without marking resolved findings for recheck. Reproduction: resolve a material finding; submit an evidence-only revision that keeps creative/context unchanged; select a different offer during intake; the finding remains resolved without a recheck and approval succeeds. The normal revision path checks changed context, but the intake mutation does not. See [revision checks](../server/store.ts#L201), [intake mutation](../server/store.ts#L244), and [approval gate](../server/store.ts#L282).

**Decision:** record a changed reference as changed review context and require reconsideration of affected resolutions. Where dependencies are unknown, require explicit recheck rather than guessing relevance. Do not declare the new offer noncompliant. The error is carrying a judgment across a changed basis without acknowledgment.

**Why first:** preserving the relationship between evidence and decision is a consequential correctness requirement. The presence of a human approval button does not compensate for misleading resolution state.

### 3. Recover drafts against the package they were written for

External drafts are saved as a complete text-field snapshot after any edit, keyed only by the submission link. Suppose an affiliate edits only the revision note on v1, another participant submits corrected v2, and the affiliate reloads. Recovery overlays the v1 text snapshot on v2, while retaining v2's files and current version token. Old copy can be reintroduced even though the person only edited a note. See [draft recovery](../src/SubmitterApp.tsx#L92) and [revision initialization](../src/SubmitterApp.tsx#L487).

**Decision:** store the base revision and actual field edits; require reconciliation when the base changes. Preserve safe edits through unrelated case activity. This is not an automatic approval bypass—the new package still needs review—but it can create regressions and another correction round.

### 4. Track the communication that remains after the decision

An internal decision moves the case to Completed and clears the next owner. The affiliate correctly cannot see that decision until it is deliberately shared. Sharing is implemented, but the queue has no outstanding communication task; it simply says “Decision recorded.” See [decision transition](../server/store.ts#L291), [queue next action](../src/App.tsx#L725), and [external status](../server/submitter.ts#L12).

**Decision:** keep decision state separate from a task such as “Result not yet communicated,” with an accountable owner. Deliberate portal sharing or recorded outside communication can fulfill the appropriate handoff; neither should be confused with verified delivery. Do not force internal decisions to become externally visible immediately.

**Why it matters:** the marketer cannot act on an approval they do not know exists. Completed review and completed handoff are different milestones.

## The next design pass

**Make each finding the place to assess its answer.** Currently answers live in Feedback & replies, specialist entry lives in Case details, and version comparison lives elsewhere. “Review finding” in comparison opens a Resolve editor and jumps to its original citation, often v1, while the judgment concerns v2 ([interaction](../src/ReviewWorkspace.tsx#L665)). Show the original concern, current replacement, received evidence, relevant source, and neutral disposition choices together. Supporting PDFs should be openable beside creative, as offer sources already are. Keep history available without making reconstruction the default task.

**Give affiliates a current task list.** The return page shows frozen feedback messages, but no shared request-level acknowledgment/resolution. Only findings from the latest message appear in the response selector. If A and B remain outstanding and a later message introduces C, the affiliate cannot select A or B there, although the backend accepts them ([feedback display](../src/SubmitterApp.tsx#L915), [response selector](../src/SubmitterApp.tsx#L1069)). Put “Your next actions” above history, link each request to its cited file/page, and show response received / awaiting assessment / accepted as explicitly shared states. Do not expose internal reasoning or infer acceptance from an upload.

**Reduce bookkeeping and improve hierarchy.** Use a guided Request changes action to select shareable requests, preview the outgoing message, and confirm who acts next. Preserve distinct underlying events without requiring separate navigation to coordinate them. Give specialists a “Requests assigned to me” view derived from finding ownership; the current filter only matches case owners. Move the finding Type field to optional detail: it currently changes labels, not routing or validation. Audience, requested action, basis, owner, and required/advisory status deserve priority.

At a 1280×720 viewport, the queue spends most of its first screen on heading, counters, and filters; the case view initially shows little actual creative or finding content. Compress that space and prioritize the current task. Once scrolled into the review, the adjacent creative/finding layout works well. Visual density is a refinement after the functional handoffs above, not a reason for a redesign.

## V2 order and product justification

Complete the core fixes and reconciliation interaction before expanding the feature set. The earlier plan calls email integration the first conditional V2 candidate; this audit refines that recommendation into smaller steps.

| Order | Investment | Who benefits and why | Smallest useful scope / condition |
|---|---|---|---|
| 1 | Notifications and assigned action lists | Affiliates learn that feedback is ready; reviewers notice returned evidence; specialists know what needs their answer. Reduces idle time and coordinator chasing. | Event-triggered email with the correct case/request link, accountable owner, visible send failure and retry. Do not imply receipt from provider acceptance. Add reminders only where turnaround data justifies them. |
| 2 | Context-sensitive submission guidance | Affiliates and reviewers avoid clarification rounds before substantive work begins. | For marketing email, request subject/preheader and rendition; for linked social/display creative, prompt for destination proof where relevant. Permit unknown/not applicable. Describe package completeness, not legal compliance. |
| 3 | Reference-change impact review | Offer owners and reviewers can find decisions whose factual basis may have changed. | “Used by these reviews/approvals,” named owner, change reason/effective date, and reassessment task. Withdrawal currently blocks new approvals, but does not flag existing approvals or warn before sharing them. Preserve historical decisions; a person determines whether an approval should be withdrawn. |
| 4 | Email intake and replies attached to existing cases | Affiliates can retain their channel; coordinators stop moving attachments and correspondence manually. | Move ahead of #2–3 if observation shows transfer effort dominates. Start with a dedicated address and explicit case association. Ambiguous messages need a recovery queue, not guessed attachment/version associations. Notifications alone do not preserve the entire email workflow. |
| 5 | Reusable reviewer guidance and modest comparison tools | Reviewers spend less time recreating common evidence requests, locating policy, and inspecting changes. | Begin with reviewed request templates, company-guideline citations, text differences, and evidence comparison. Expand only where repeat work is observed. Suggested language must remain editable and scoped. |

Reference supersession and withdrawal do not automatically mean earlier approvals were invalid. The missing feature is an impact review, not automatic revocation. In a temporary reproduction, an already-recorded approval could still be published after its reference was withdrawn; that deserves a visible reassessment warning, with policy determined by the organization.

## Keep deferred

- **Automated substantive compliance checking:** potentially valuable, but needs representative cases, reliable extraction, maintained sources, and evidence of net time saved after reviewers handle false positives. Existing findings are human-authored. Empty findings are not clearance.
- **Broad OCR, native video/audio, website crawling, and all-format conversion:** choose the next format from actual submission frequency and delay. A complete supported-rendition workflow has more value than superficial format coverage.
- **Automatic approval reuse, campaign generation/publishing, and live-site monitoring:** different responsibilities and correctness requirements. Revisit approved templates only if repeated near-identical campaigns are a demonstrated source of demand.
- **Large analytics dashboards and enterprise administration:** capture useful events first. For a real-client pilot, authentication, authorization, verified identities, storage recovery, and retention ownership become prerequisites; they are not the strongest next take-home demonstration.

## Evidence that would change the ranking

Observe several real correction chains and ask where time actually goes: assembling the first complete package, waiting for an answer, finding the answer, substantive assessment, or communicating the result. Count coordinator and affiliate effort as well as reviewer minutes. Measure response-to-assessment time, preventable clarification rounds, active reviewer handling time, and decision-to-communication time. Do not claim throughput improvement from a working demo alone.

The next acceptance journey should start with a waiting case and two independent requests. An affiliate answers one with an evidence PDF; the reviewer notices it, opens it beside the relevant current material, obtains specialist input in that finding, and resolves only the answered concern. The other remains outstanding. After a scoped decision, the communication task remains visible until handled. Additional checks should exercise changing the offer after a resolution, successive partial feedback batches, and recovery of a v1 draft after v2 arrives. Existing happy-path coverage does not establish these behaviors.
