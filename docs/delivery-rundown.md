# What we built and why

ClearPath Review is a workspace for reviewing marketing material, requesting corrections, and recording a human decision about a specific package. It replaces the coordination work we believe sits between an email thread and an Excel tracker: identifying the current material, locating evidence, remembering unresolved requests, and knowing who must act next.

That bottleneck is a hypothesis about fictional ClearPath, not measured company data. Published financial-marketing procedures support the submission–feedback–resubmission pattern. The interview call emphasized completing the consequential parts of that experience and explaining deliberate omissions, so we focused on a correction round that remains understandable even when only some issues are addressed.

## The working product

1. **Submit a package.** An affiliate uses a separate submission page and receives a case return link. An internal marketer or partner manager can submit through the workspace. The package contains creative, accompanying copy, destination information, and intended use; it can contain several files. PNG/JPEG and multipage PDF previews work. Other originals remain downloadable.
2. **Confirm what is being reviewed.** The reviewer selects a preserved offer reference and checks context and applicability. Manually entered offer facts link to original source documents and pages. A date mismatch requires an explanation; withdrawn references cannot support a new approval. The software does not establish that a supplied source is authoritative.
3. **Inspect and request.** Reviewers examine the material beside offer facts or supporting evidence. A finding records the concern, basis, location, requested action, audience, owner, and whether it must be addressed before approval. Required corrections and advice are distinct. Internal reasoning is separate from what can be shared with the submitter.
4. **Return and assess.** Selected feedback is deliberately shared to the return page. The affiliate sees current requests across feedback batches and can answer with evidence or supply a changed package. The reviewer sees returned answers as actionable work and can inspect their files beside the creative. A response is not an automatic resolution or a silent replacement of advertised material.
5. **Reconcile a revision.** Keep/Replace/Remove preserves originals and identifies replacements. Product, use, copy, destination, and offer context belong to the version. Findings survive partial corrections. A changed factual basis requires reconsidering earlier resolutions. The reviewer can record which returned responses supported a disposition and explicitly share the request's status without sharing internal reasons.
6. **Decide and communicate.** Approval requires confirmed intake, resolution or dismissal of required findings, a scope, rationale, and human review attestation. The decision retains the reviewed package and reference/finding snapshots. A decided case remains actionable until its result is deliberately shared or outside communication is recorded against an exact decision message. Sharing, copying, recorded communication, and verified delivery are different things; the last is not implemented.

Earlier decisions remain inspectable. Withdrawal preserves the historical decision and changes the shared approval notice. The internal ZIP export contains verified originals, source documents, and the review record. It is an internal evidence package, not a submitter reply or a certified audit archive.

## Whose work the design serves

The **affiliate or marketer** needs to provide usable material, understand the current request, and return only the necessary correction. The **reviewer** needs to inspect evidence and make defensible judgments without reconstructing correspondence. A **specialist** supplies an answer within a finding; the accountable reviewer still owns the case. A **partner manager or coordinator** needs visible next actions and communication tasks. The **offer owner** supplies current authoritative terms; broader reference-change impact management remains deferred. The **consumer** is the downstream stakeholder: the work should protect against misleading advertising, not merely move cards through a queue.

## What the audits changed

| Change | Product reason |
|---|---|
| Separate submission and return pages | An external affiliate should not need the internal review dashboard to send material or see feedback. |
| Adjacent creative, offer sources, and response evidence | Evaluating a claim requires its presentation and supporting facts; switching files or hunting through messages adds effort and invites mistakes. |
| Unassessed replies appear in the actionable queue | A case must not remain invisible while appearing to wait on a person who has already replied. Other dependencies remain open. |
| Neutral finding assessment before disposition | Reviewing a revision should not preselect Resolve or silently show only the earlier file. Current replacements, original concerns, and returned evidence belong together. |
| Current affiliate requests across every feedback batch | A new message must not make an earlier unanswered request impossible to address. Explicit shared acceptance remains different from overall approval. |
| Reference changes invalidate stale resolution assumptions | A conclusion based on one set of terms must be reconsidered when that basis changes. The system prompts review; it does not invent a violation. |
| Revision-aware draft recovery | Old drafts must not overwrite corrected text or combine old context with new files. Conflicts require explicit choices while retaining the person's work. |
| Pending decision communication and exact message versions | An approval hidden inside a completed case does not help the marketer. The communication record must describe the actual message, even if the draft was later edited. |
| Deliberate waiting and reviewer handoffs within the relevant action | Sharing requests can also record who acts next; recording a disposition can return the case to its reviewer. This removes a separate tracker update without assuming every dependency is complete. |
| Explicit inclusion of a response attachment in a new package | Evidence of an answer and advertising receiving approval are different records. Reusing the original file avoids re-uploading while preserving a fresh intake check. |
| Less prominent classification and more working space | Audience, basis, requested action, ownership, and blocking status affect decisions. A display-only classification and large headings deserve less attention. |

The short implementation records explain the details: [core state controls](core-workflow-decisions.md), [reviewer interactions](reviewer-workflow-decisions.md), and [affiliate interactions](external-workflow-decisions.md). Commits separate coherent changes rather than grouping the entire audit into one patch.

## How regulation informed the design

The [source-to-design map](regulatory-design-basis.md) distinguishes regulatory requirements, agency guidance, company procedures, and our own inferences. Three concrete examples explain the connection:

- **Personal-loan fee claim:** Regulation Z §1026.24(a) requires covered advertised terms to be actually available. The product lets the reviewer compare the exact fee claim with the applicable offer source and retain that basis. It does not scan the image or automatically decide whether the claim is wrong.
- **Credit-card “no annual fee” claim:** Matching an offer fact does not finish the review. Regulation Z §1026.16 and its interpretation contain conditional additional-disclosure requirements, including for a no-annual-membership-fee statement. Preserving the actual rendition and context lets a reviewer assess more than factual consistency. The app does not apply those rules automatically.
- **Mortgage prequalification promise:** Regulation N §1014.3(q), where applicable, addresses material misrepresentations about the consumer's ability or likelihood to obtain mortgage credit, including preapproval representations. The product supports an evidence request about the promise and process; the product label alone does not establish applicability or legal sufficiency.

Presentation requirements are why we retain original material and exact pages rather than treating extracted text as the whole advertisement. Substantiation principles are why a missing answer stays an evidence request rather than becoming proof of a false claim. Real Affirm and GreenSky procedures informed the complete resubmission loop and exact reviewed version.

Research did **not** mandate our queue, portal, statuses, or a human-only system. Those are product decisions about the stated coordination bottleneck, the cost of errors, and the take-home time limit. The research provides no basis for claiming universal compliance coverage or measured legal accuracy. Retention also varies: the export does not implement every applicable retention obligation, dissemination-date trigger, or legal hold.

## Deliberate limits

Email intake, email notifications, specialist action lists, channel-specific intake prompts, automatic substantive checks, OCR, broad format conversion, reference-change impact queues, campaign publishing, and live-ad monitoring remain outside this iteration. The portal completes a useful round trip but leaves email transfer and notification effort visible. A withdrawn reference blocks new approval and sharing of an earlier approval on the portal; current evidence requires a fresh review and decision. It does not initiate a broader impact review. Automated assistance could be valuable; this project has no representative evaluation demonstrating that it reduces total reviewer work without consequential misses or excessive false positives.

The publicly accessible reviewer area is a shared demonstration with simulated identities. Authentication, authorization, verified identities, recovery operations, and retention ownership are prerequisites for real-client use. SQLite persistence and original-file storage are working software; the fictional source facts, sample findings, and fixed reviewer identity are demonstration material.

Tests establish that the implemented state transitions and interactions work. They do not establish time savings. A real pilot should measure active reviewer time, preventable clarification rounds, response-to-assessment delay, and decision-to-communication delay, including work transferred to affiliates and coordinators.

## Verification

The core fixes passed **31 API tests and 18 browser tests** on September 27, 2026. Browser tests use real image/PDF uploads and separate actor sessions, including partial responses, two feedback batches, stale internal and external drafts, explicit response-file inclusion, and exact decision/message-version communication. The API tests check the corresponding server gates and records. Desktop and phone-width inspection verified the main evidence and assessment interactions; an off-screen assessment action found during that inspection was corrected and rechecked.

The production build passed and the update is running at the existing public URL. Deployment preserved all four live case records byte-for-byte and verified the seven submitted originals plus three reference originals against their stored SHA-256 hashes. Read-only public checks confirmed the current build, queue, submission page, adjacent source preview, original downloads, and valid ZIP export. Test submissions stayed in isolated temporary databases.

The first [withdrawn-reference sharing check](approval-sharing-decision.md) passed **32 API tests and 19 browser tests**. It was then tightened to require current evidence and a fresh review rather than an explanation override; see that decision record for the policy and regression coverage. The [additional findings](focused-follow-up-findings.md) led to the implemented [readiness fixes](submission-readiness.md): unassessed evidence now gates approval and sharing, and changed shared-request requirements are flagged for deliberate re-sharing.

The [latest refinement](compliance-review-follow-up.md) passed **33 API tests and 19 browser tests**, added the card's missing required disclosure finding, clarified decision scope, and verified fresh-review recovery after source withdrawal. The live card's earlier material and history remain intact, with one new finding; the other three cases, all references, and all ten original files were preserved. These checks establish implemented behavior, not regulatory coverage or throughput gains.
