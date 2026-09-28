# ClearPath: UX, product completeness, and demo boundaries

Read-only audit of commit `f5452e1`, September 27, 2026. No application code or shared review records were changed. This document records recommendations, not an approved implementation plan.

The application contains a working internal review loop. It is not a static mockup: uploads, previews, findings, revisions, decisions, history, and exports operate on stored data. However, it is currently a shared demonstration of one reviewer/coordinator’s work. It is not yet an affiliate-facing service or a multi-reviewer system.

The most important correction to our earlier description is that **“direct submission” did not become a distinct submitter experience**. We built submission inside the internal workspace. That is defensible only if an internal coordinator enters affiliate material. An affiliate who submits directly should not enter that workspace. This distinction was insufficiently resolved in the build.

I inspected the deployed queue, case review, offer/context panel, finding editor, decision blockers, revision submission, comparison, reply preparation, waiting form, new submission, and review guide. I checked the implementation and existing test coverage with three independent code/product reviews. A separate temporary database reproduced the validation discrepancies below; it did not touch the demo. Existing passing tests demonstrate a bounded workflow, not all of the usability and organizational requirements identified here.

**What deserves attention first**

| Priority | Finding | Why it matters |
|---|---|---|
| Before inviting actual affiliates | Separate external submission/revision from internal review, with server-enforced access. | A separate page alone would still expose all cases and allow review actions through today’s API. |
| Before handling real campaigns | Replace the fixed offer catalog with a small, accountable reference workflow. | A new offer PDF cannot currently become an eligible reference without changing code. |
| Core reviewer experience | Keep the material and supporting facts visible while writing or resolving a finding. | The current editor hides the very evidence the reviewer must use. |
| Core correctness | Make required decision/finding evidence consistent between UI and server. | Approval without rationale and findings without supporting basis currently pass server validation. |
| Core reviewer experience | Preserve unfinished work and support recovery after a stale save. | A reviewer should not have to recreate reasoning, uploads, or carefully edited feedback. |
| Core handoff | Separate internal questions from affiliate feedback, and distinguish required corrections from advice. | Current generated wording combines audiences and can overstate what blocks approval. |
| Core coordination | Surface actionable work, dates, dependencies, and what remains before a decision. | The queue records state, but only weakly answers “what should I do next?” |

“Before real use” is a different threshold from “must build every production feature in a take-home.” We should fix the minimum behavior needed for the operating model we demonstrate, and keep the remaining cuts explicit.

**1. The affiliate experience is missing, independently of email integration**

Two coherent operating models are possible:

| Model | What the participant actually does | What we can currently claim |
|---|---|---|
| Internal coordinator | Receives email, enters the package, relays feedback, and records revisions. | Much of the internal loop works. Transfer and correspondence tracking remain manual. |
| Affiliate self-service | Opens a submission link, uploads material, receives feedback, and returns corrections. | Not implemented. Today submission leads straight into the reviewer’s case view. |

The recommended extension is a separate external submission and return path, without requiring every affiliate to create a ClearPath account. The path needs to cover the whole correction round, not just the first upload:

1. Open a submission-only link. Supply contact information, creative, intended placement/use, and relevant context. A campaign-specific invitation could prefill the offer instead of expecting an affiliate to understand internal offer IDs.
2. Receive a clear receipt and case reference. Distinguish “received for review” from “approved.”
3. Use a private, case-specific return link to see only their submitted material, intentionally shared feedback, and the decision’s exact scope.
4. Respond to particular requests and upload replacements or supporting evidence in that same case.
5. See confirmation that the revision was received and is awaiting review.

The internal entry point retains findings, internal evidence, notes, decisions, and the cross-case queue. External links must not permit approval, finding dismissal, access to other cases, or internal-record export. This requires separate server permissions and response shapes, not a hidden sidebar or a client-side role toggle. Scoped, revocable links and a basic internal session are a possible take-home implementation; expiry, forwarding, lost links, and identity still need deliberate treatment before a real pilot.

Also distinguish **creator/contact**, **person who uploaded**, and **reviewer**. New submissions currently set the recorded uploader to the submitter’s name. A coordinator uploading on someone else’s behalf loses that distinction. External affiliates also should not necessarily see the internal offer facts or substantiation used by reviewers.

Evidence: [submission redirect](../src/App.tsx#L139), [unrestricted routes](../server/app.ts#L43), [submitter/uploader conflation](../src/forms.tsx#L189), [fixed reviewer](../shared/types.ts#L26).

**2. The reviewer’s most important information is present, but not always usable together**

The strongest screen is the creative beside an authored finding: observation, requested action, owner, and blocking status are clearly separated. The offer panel contains concrete facts rather than an invented compliance score. Those are good decisions.

The actual task, however, is to compare **the claim → the applicable fact or requirement → its source → the requested action**. Today:

- Findings and offer/context occupy mutually exclusive tabs.
- Adding or resolving a finding opens a modal over a blurred workspace. The source is no longer readable while reasoning is being entered.
- New findings default to the first creative file, even if the reviewer was inspecting a different PDF.
- A location such as “Page 2, disclosure” is text, not a page-level reference. Clicking it selects the file, or opens generic Versions when the cited asset is older or absent. It does not select the original revision and exact location.
- Supporting documents can replace the creative in the same viewer, but there is no simple simultaneous creative/source-document comparison.
- The offer’s source is a text label. Individual facts are not linked to a preserved source page.

The smallest useful improvement is a finding editor beside the material, with the relevant facts or source easily available and the current file/page already selected. Keep the current claim and requested action visible together. Exact file/version/page navigation matters before sophisticated annotations or automatic extraction.

At the observed 1280×720 viewport, the case header, status area, tabs, and package toolbar consume much of the first screen. The sample’s substantive claim is below the fold. The quiet styling is coherent, but reviewer work should receive more space than promotional headings or sample navigation. Several metadata labels are also very small. Increase working-text readability and preserve useful context while scrolling; do not merely squeeze more information into tiny text.

Evidence: [right-side tabs](../src/App.tsx#L1076), [finding default](../src/forms.tsx#L580), [location behavior](../src/App.tsx#L1138), [modal behavior](../src/components.tsx#L108).

**3. The workflow should explain the next action before offering the final action**

The current page gives “Record decision” prominent placement even when intake is unconfirmed or material findings remain open. The decision dialog correctly explains blockers and the server correctly blocks unresolved material findings, but the reviewer first enters an unavailable path to learn this.

A more useful hierarchy would be:

| Current situation | Information to surface first | Primary next action |
|---|---|---|
| New, incomplete submission | Exactly which context or material is missing | Request context or complete intake |
| Ready for review | Current package, offer, intended use, and any unanswered requests | Inspect material and record findings |
| Changes needed | Required external changes, separate internal dependencies | Prepare the appropriate request |
| Waiting | Who owes what, when requested, and whether communication is recorded | Follow up or inspect a received response |
| Revision received | What changed and which findings need reconciliation | Compare and re-review |
| Ready for a decision | Reviewed version, unresolved concerns, scope, and evidence | Record decision |
| Decision recorded | Exact result/scope and outstanding communication | Prepare/share the result |

This hierarchy does not determine compliance. It makes recorded workflow state understandable. Rejection should remain accessible where appropriate, and absence of findings must never become an automated “pass.”

Intake currently discovers missing offer/intended-use requirements through a failed confirmation request. Show that missing context before the click. “Ready for intake” also counts packages that may still be incomplete; the label should mean “needs intake,” not imply readiness has been established.

The queue needs similar attention. It defaults to all submissions, including completed ones. It omits target launch, age, and waiting duration. Long next-action text is truncated. Initial/reloaded order is newest-created first; after a local update the frontend sorts by last update. Neither expresses a deliberate work priority, and their inconsistency changes the list on refresh. A new revision to an old case is not predictably surfaced after reload.

Start with active/actionable work, a clear waiting group, visible launch/age, and a simple stable sort. Keep one accountable reviewer, but summarize multiple outstanding owners when pricing and an affiliate owe different things. Do not invent a risk score or assume the nearest launch must always win. New-work visibility also needs a lightweight refresh indicator or polling once other people can submit; today updates require load/manual refresh.

Evidence: [queue filters/columns](../src/App.tsx#L395), [initial ordering](../server/store.ts#L48), [post-update ordering](../src/App.tsx#L132), [confirmation requirements](../server/store.ts#L194), [waiting state](../server/store.ts#L216).

**4. Offer facts and campaign context are more constrained than the interface suggests**

The offer panel is useful, but the three offers come directly from fixtures. There is no internal flow to create a reference, attach its source, establish validity, or supersede it. A reviewer cannot upload a real offer PDF and use it as the selected reference: intake requires one of the catalog IDs. This is a real demo dependency, not merely missing administration polish.

A small working alternative would let an internal person record a versioned reference with product, source material, applicable dates, and provenance; a reviewer confirms applicability. Automatic extraction and a large policy-management system are unnecessary. The product must distinguish submitter assertions from authoritative internal facts.

Other ordinary changes are not supported. Product, title, placement, target launch, submitter, and contact email cannot be corrected after initial submission. Revisions preserve offer, intended use, copy, URL, and files, but not a separately versioned launch/placement. A contact typo should be an accountable metadata correction; a changed placement or use period may require re-review. These are normal campaign events.

Offer validity is displayed but never compared with target launch. The scratch check confirmed that a December launch with an offer ending in November can be confirmed and approved without a mismatch prompt. The right improvement is to expose the factual conflict and ask for updated evidence or a human explanation, not automatically declare a legal violation.

Evidence: [fixture offers](../fixtures/examples.ts#L5), [offer validation](../server/store.ts#L80), [revision schema](../server/validation.ts#L26), [hidden revision metadata](../src/forms.tsx#L302).

**5. Revisions and decisions have strong foundations, with several incomplete interactions**

| What works | What remains awkward or missing |
|---|---|
| Original bytes are retained, even under identical filenames. | Replacement means unchecking the old file and separately uploading the new one. Forgetting one step leaves both in the current package. Provide an explicit Replace action. |
| Unchanged material can be carried forward. | Retained roles cannot be corrected in the UI. A misclassified destination requires removal/reupload even though the model supports role changes. |
| Open findings survive new submissions; changed creative/context prompts rechecks. | Findings cannot be amended or reassigned. Typos or clarified instructions require dismissal/recreation. Preserve history through an amendment instead. |
| Earlier and current originals can be compared. | The views default independently to their first files, omit findings during comparison, and count added/removed IDs rather than explicit replacements. They do not automatically pair corresponding material. |
| Decisions refer to an exact revision and scope. | A historical decision link opens general activity under the current case header, rather than the exact decision and approved package. |
| Finding and offer snapshots are captured at decision time. | The snapshots are available in storage/export, but the decision UI shows only scope, rationale, actor, and date. Expose the recorded basis directly. |

Smaller comparison problems: the first version is shown beside itself as an “Earlier package”; selecting the current version can likewise imply a comparison without an earlier package. Excluded-material and role changes are not clearly called out. A simple changes list and correct version/file pairing should precede pixel-level or semantic diffing.

There is also no withdrawal/cancellation/correction path for a final decision. Creating a new creative revision is not equivalent to saying “the approval was withdrawn because its basis changed.” Preserve the original decision, add an explicit superseding event with reason, and make any required communication visible. This would not prove that an affiliate stopped a live campaign; takedown/monitoring remains a separate process.

One verified correctness mismatch warrants a focused fix: the UI requires finding basis and decision rationale, while server validation accepts empty finding detail and empty rationale for approval. The scratch store accepted both through the same schemas/store methods used by the API. Decide which fields are truly required and enforce that consistently. The existing server gates for current intake, scope, attestation, and material blockers remain real; this is a gap in the recorded basis, not proof that all gates are absent.

Evidence: [revision behavior](../server/store.ts#L141), [replacement UI](../src/forms.tsx#L350), [finding actions](../src/App.tsx#L1179), [decision snapshots](../server/store.ts#L228), [comparison](../src/App.tsx#L1503), [validation](../server/validation.ts#L31).

**6. Feedback is a working draft feature, but the audience and return journey are unfinished**

The distinction between Prepared and Sent is correct. Saving a decision does not claim to notify anyone. Default external wording excludes internal notes and decision rationale. These should remain.

However, every pending finding is preselected into one draft addressed to the original submitter. This includes a “Specialist question” assigned to an internal person. Advisory findings also inherit wording asking the recipient to address them before review can be completed, despite not blocking approval. Audience and requiredness are separate dimensions; type and owner alone do not safely determine either.

Recommended behavior: select an audience/recipient, include deliberately external requested actions, and separate required corrections from optional advice. Internal specialist questions should not default into an affiliate response. The creator of a finding should know which fields can be shared.

Other concrete gaps:

- With no findings, “Prepare feedback” creates an empty list of requests. Use a suitable blank-message state or another next action.
- Changing selected findings regenerates the body and overwrites manual edits. A small warning sentence is weaker than preserving work or explicitly asking to regenerate.
- Saved drafts can be downloaded but not reopened for editing; starting again generates a new draft from current state.
- Old drafts remain downloadable after later revisions. Version labels help, but an earlier approval message needs a clear historical/stale indicator before reuse.
- The message lists all non-excluded filenames, including supporting evidence. That can confuse the approved creative with internal reference material. An external result should identify only the applicable deliverables and explicitly stated scope.
- Copying/downloading does not record that correspondence happened. Mark waiting is a separate manual action and initially defaults to Maya Chen in the observed case despite external requests being open.
- Rejection replies omit the internal rationale, correctly, but default to a generic “contact us” next step. Allow deliberately shareable reasons rather than automatically exposing the internal basis.

A coordinator-operated V1 can use a manual “communicated externally” record, tied to the feedback version, recipient, actor, and time. Label it as a user-entered record, not verified delivery. An affiliate return link can then attach the correction to the right case. Neither requires live email integration. The internal ZIP is not an affiliate-safe approval packet: it intentionally includes internal reasoning and all preserved originals, including earlier/excluded material.

Evidence: [draft generation](../src/forms.tsx#L992), [regeneration](../src/forms.tsx#L1035), [saved drafts](../src/App.tsx#L1433), [ZIP audience](../server/export.ts#L46).

**7. Ordinary recovery and accessibility need attention**

These are working-software requirements, rather than new product breadth:

| Finding | Consequence | Smallest useful response |
|---|---|---|
| Escape/backdrop/navigation can discard unfinished forms. Browser inspection reproduced a lost finding title after Escape and reopen. | Lost reasoning, file selections, or edited feedback. | Dirty-state protection and retained drafts; avoid making accidental dismissal destructive. |
| Stale writes are rejected, but the dialog offers no reconciliation path. | Closing/reloading to fetch current state loses the work that was preserved after the error. | Retain entered text, load the latest record, show what changed, and require a fresh decision on the correct version. |
| Some Cancel/Back buttons remain available during saving. | A late success/error can arrive after the form disappears. | Consistent in-flight behavior and visible result/error recovery. |
| Errors appear near the bottom of long forms. | The user may not see what failed or which field to fix. | Field-level errors and focus/scroll to the relevant problem. |
| PDF preview is canvas-only. | No accessible text layer, browser text search, or copy from the preview. | Keep download fallback; assess a text layer/native viewer before claiming accessible in-app review. |
| Tabs have visual styling without complete tab/selected semantics; small labels/controls persist. | Keyboard and assistive-technology usability is not established. | Proper semantics, readable working text, and practical control sizes. |
| Dates omit years. | Historical decisions become ambiguous across years. | Full dates in historical records and material validity. |

The PDF document also reloads when changing pages; this may be costly for large documents. It is lower priority than correct context and recovery. A complete accessibility audit and large-file performance test were not performed; do not infer certification from this inspection.

Evidence: [modal dismissal](../src/components.tsx#L108), [API error handling](../src/api.ts#L9), [PDF rendering](../src/components.tsx#L174), [date formatting](../src/components.tsx#L22).

**What is a placeholder, what is real, and what was deliberately omitted**

| Area | Actual status | Implication |
|---|---|---|
| Reviewer identity / authority | Fixed Maya Chen; no authentication or per-user permissions | Demo substitution. Cannot establish who actually reviewed or approved. |
| Internal privacy | Notes omitted from generated replies, but exposed to every workspace visitor/API caller | Partial separation, not access-controlled privacy. “Internal notes stay private” overstates current behavior. |
| Offer catalog / source authority | Three hard-coded fictional references | Demo dependency requiring code changes for new offers. |
| Worked cases | Authored findings/history, fictional contacts and `.example` destinations | Legitimate labeled examples; the linked consumer destinations are not live sites. |
| Assignment / specialist collaboration | Stored names and finding types, no actual delegation or specialist response surface | Partial workflow, not implemented team routing. |
| External intake / receipt / revision link | Absent | Missing stakeholder experience if affiliates are intended users. |
| Uploads and previews | Real stored PNG/JPEG/PDF, multipage navigation, originals download | Working, with format and accessibility limits. |
| Other file types | Preserved for manual download | Working fallback; no promise of preview, inspection, or safety scanning. |
| Findings and evidence requests | Real human-created records and dispositions | Working; editing, exact source navigation, audience, and reassignment are incomplete. |
| Compliance checks | No automated checks; fresh submissions have no findings | Deliberate boundary, not a hidden nonworking scanner. Seeded missing-destination findings do not imply automatic missing-destination detection. |
| Three product types | Shared human review workflow | Real workflow support; not three implemented regulatory rule engines. |
| Versions / comparison | Preserved packages and two actual viewers | Working but limited comparison; no automatic content diff or replacement pairing. |
| Approval | Persisted exact-version human decision with backend gates and snapshots | Working; actor authority, rationale validation, withdrawal, and historical UI need work. |
| Replies | Real editable, copyable, downloadable, savable drafts | Partial communication workflow; no send, receipt, delivery status, or external response capture. |
| Review guide | Static workflow instructions | Useful orientation, not a product-specific legal rulebook. |
| Review export | Real ZIP with originals, metadata, history, decisions, and snapshots | Working internal record, not an external handoff or tamper-evident production archive. |
| Queue counts/search | Derived from real records | Working basic functions; neither team analytics nor evidence of improved throughput. |
| Hosting/storage | Temporary public tunnel to local app/SQLite/files | Real persistence and public demo, but availability depends on Mac/processes; no managed backup/recovery or production service commitment. |

There is no need to replace every simple feature with a large system. No AI, no live inbox integration, no autonomous clearance, no broad legal-rule library, no arbitrary-format semantic diff, and no enterprise analytics remain defensible cuts. Basic audience separation, evidence access, truthful ownership, and recovery are harder to dismiss because they affect the chosen core job.

**The narrative we can already defend**

“I treated the email/Excel problem as a hypothesis about coordination and reconstruction: finding the current material, understanding the offer, preserving unanswered questions, and deciding who acts next. I built the review around a package of creative, copy, destination, and supporting evidence. The reviewer makes the substantive judgment. Revisions retain the originals and unresolved concerns; an approval refers to a specific version and intended use. A prepared reply never means an email was sent.”

That description is supported by implemented behavior. We can also defend durable storage, conflict protection, real uploads, and the choice to finish a correction/re-review/decision loop before adding automated checks. We cannot yet claim affiliate self-service, real team accountability, governed offer sources, complete regulatory coverage, or measured throughput improvement.

The next iteration should demonstrate one complete stakeholder journey with less reconstruction: an affiliate submits through a restricted link; an identified reviewer sees the material and basis together; relevant feedback reaches the right audience; the affiliate returns a partial correction; the reviewer resolves only what was addressed and records a scoped decision. If we instead retain a coordinator-only V1, its interface and presentation must say so, and include manual transfer effort in any benefit assessment.

After the high-consequence gaps, validate the product by observing a reviewer and submitter complete that journey without coaching. Measure time to identify the correct material, time to produce actionable feedback, and total effort through a partial correction and final decision. Do not use seeded success, number of findings, or a passing automated test as a substitute for that evidence.
