# Approval workspace: V1 scope and correctness

Updated September 27, 2026. The application builds and passes API and browser workflow tests, including the ZIP download and internal-rationale exclusion from prepared replies. The temporary public demo is verified; the [README](../README.md) has its URL and running requirements. Read the [product story](product-story.md) for the concise rationale, [research and alternatives](research.md) for evidence and decision history, and [submission-format research](submission-format-research.md) for the visual-package boundary.

**Settled V1:** 8–12 focused implementation hours; a TypeScript application with direct submissions, human findings and evidence requests, original PNG/JPEG and PDF creative, partial revisions, explicit ownership, exact-version human decisions, and outgoing drafts labeled Prepared. Personal loans, credit cards, and mortgage prequalification share this workflow. No email import, live email, automatic compliance checks, AI, or OCR is included. Email integration is the first V2 candidate; narrowly scoped checking follows only if useful.

## 1. Working direction and decision standard

Build an internal marketing-compliance workspace where submitted creative becomes a review case, revisions stay connected to findings, and a reviewer can make and retrieve a supported decision. For the work it supports, this becomes the internal queue and approval record that previously lived in Excel. A marketer submits directly; a partner manager can enter material received from an affiliate outside the tool.

The longer-term operating model preserves affiliates' email workflow. V1 deliberately tests the internal review loop first. It does not import email, synchronize a mailbox, or transmit replies. Count the work of entering received material and transferring prepared replies when assessing its benefit. Earlier live-email proposals have been superseded.

**Updated scope principle:** choose creative handling from evidence about actual submissions, not because pasted text is easier to analyze. Prioritize correct product behavior over elaborate code organization. A simple implementation is acceptable; disappearing evidence, misleading status, and incomplete review interactions are not.

The project discussion prioritizes knowing what must be right, completing those interactions, and understanding how they work. It allows deliberate production omissions within the original 24-hour assignment; the selected build budget is 8–12 hours. Apply that standard to each feature:

1. What work does it remove for a real participant?
2. What failure would make that participant distrust or abandon the workflow?
3. What is the smallest behavior that prevents or visibly recovers from that failure?
4. What example can demonstrate it?
5. What breadth can be omitted without undermining the chosen result?

This is a product decision framework, not a claimed evaluator scoring rubric. Research supports relevant failure patterns; it does not measure their frequency at fictional ClearPath.

## 2. Goals and evidence of value

| Goal | Why it matters | What to observe |
|---|---|---|
| Reduce reconstruction before review and re-review | Current creative, comments, offer facts and ownership can be scattered across email and Excel. | Time and actions needed to identify the current material and outstanding work. |
| Make corrections specific enough to act on | Vague or fragmented comments create another incomplete round. | Whether a submitter can make the requested correction from the response alone. |
| Preserve the quality and meaning of decisions | Fast review is useless if it clears the wrong version or overlooks an unresolved issue. | Seeded material concerns retained, correct version/context, and retrievable decision evidence. |
| Avoid requiring external partner adoption | Affiliates may work with multiple lenders and have little incentive to adopt another portal. | A coordinator can enter their material and prepare a useful reply without an affiliate account. V1 does not remove that transfer work. The adoption concern is an assumption, not a measured study. |
| Reduce total effort for supported work | A new dashboard can simply become a third system. | Reviewer plus coordinator effort, including intake and reply transfer; no parallel manual Excel maintenance. |

Count unique requests reaching supported decisions. Do not count scans, comments, or every revision as extra throughput. Separate active reviewer time from waiting for someone else. No numerical improvement is assumed, and passing authored examples does not establish production legal accuracy.

## 3. People and the object being reviewed

The reviewer owns the decision. The partner manager coordinates the relationship and may handle correspondence. The marketer or affiliate supplies creative and revisions. An offer owner supplies missing pricing or operational facts. One person may perform several roles in a demo; their actions still mean different things.

**Proposed unit of review:** one submitted placement or closely related creative package, its necessary supporting material, and its intended offer/date context. A social image, its caption, and a destination-page rendition can belong to one review package; “one case” does not mean “one file.” Independent campaigns or unrelated variants in one message need intake clarification or manual separation. No attachment is silently discarded or implicitly cleared. A case-level approval identifies the required components reviewed together; partial approval of arbitrary bundles is outside the initial design.

[Affirm's submission instructions](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm) ask for campaign context and linked destinations as well as assets. That supports treating a submission as a package. It does not prescribe this exact case model.

Direct publisher evidence reinforces this: [QuinStreet's Publisher Service Orders](https://www.quinstreet.com/publisher-service-orders/), section IV.4, require creative and test-email variants including sender/subject/header/footer elements. A correspondence thread or isolated extracted paragraph is not the complete consumer-facing object. These sources establish realistic submission types, not their relative frequency at ClearPath.

Keep these concepts distinct:

- **Submission:** supplied creative, supporting evidence, and context; an email message is not a V1 object.
- **Case:** the work to reach a decision about identified material and use.
- **Creative version:** a particular submitted rendition/content; a supporting answer is not necessarily a new creative.
- **Finding:** a concern or evidence request and its disposition.
- **Decision:** an explicit reviewer action attached to a version and context.
- **Reply:** the external communication about that work, with its own status.

These distinctions belong in the implementation, but the primary interface can use ordinary labels such as “Current draft,” “Waiting on pricing,” and “Approval for landing-page-v3.” The reviewer does not need database terminology to do the job.

## 4. Details that must work in the prototype

### A. Submitted work must be visible and recoverable

**Scenario:** a file upload fails, required context is missing, or the submitter supplies an unsupported file type.

**Decision:** make direct intake explicit: choose the product, identify the intended use and offer context, upload supported creative, and add accompanying copy or evidence. Distinguish a saved submission from an incomplete or failed upload. Validation explains how to recover without implying that absent material was reviewed. Keep submitted text as data, not executable markup.

V1 previews PNG/JPEG and PDF files. Other types are preserved for manual download, with their preview and assessment limits visible; request a supported rendition when needed. A destination URL is useful context but does not stand in for the reviewed page proof. Each submission or revision permits at most 10 new files, 10 MB per file, and 25 MB total new upload/payload size. Retained components need not be uploaded again.

**Cut:** email import, message threading, mailbox connections, automatic case association, and provider delivery retries. Future email work must handle these explicitly. Salesforce's [threading documentation](https://help.salesforce.com/s/articleView?id=sf.support_email_to_case_threading.htm&language=en_US&type=5) and Zendesk's [incoming-email documentation](https://support.zendesk.com/hc/en-us/articles/4408887388058-A-complete-guide-to-understanding-email-in-Zendesk-Part-2-Incoming-email-requests-and-notifications) remain useful V2 design evidence, not V1 acceptance requirements.

### B. The reviewer must know which material is current

**Scenario:** two files have the same name; only a caption changes; a submission contains creative and a supporting pricing record.

**Decision:** preserve contents and history rather than overwriting by filename. Distinguish creative from supporting evidence. Identify the component versions comprising the current package; a changed caption matters even if the image is unchanged. The submitter explicitly identifies replaced components and unchanged material. A supporting factual answer alone is not necessarily a creative revision. Unrelated variants should be submitted as separate cases.

Keep the offer, planned dates, placement and rendition with the review. Identical copy under an expired fee waiver is a different review context. A linked page is not a permanent snapshot. For supported linked evidence, retain the supplied rendition and its context; if unavailable, keep the dependency visible.

The Intended use prompt now asks for relevant geography, affiliate, audience/targeting, and compensation context, while allowing the submitter to state what is unknown. These are contextual prompts, not universally mandatory legal fields or an automated eligibility screen. Intended use, offer reference, copy, and destination are preserved in package revisions; changed context must not silently rewrite the version underlying an earlier decision.

[Coast2Coast's advertising policy](https://coast2coastml-help.freshdesk.com/support/solutions/articles/158000458970-marketing-advertising-and-marketing-policy), sections 11–12, documents version-specific approval, reapproval after changes, and retained use context. Its policy is an operating example, not a universal legal mandate.

**Cut:** automatic tracking of every live affiliate page and complex campaign rollups. Do not cut exact artifact/context identification.

### C. Findings must reduce work instead of creating accusations

**Scenario:** “No origination fee” conflicts with a current approved fee record in one case, but the fee record is simply missing in another.

**Decision:** the human reviewer records a correction or evidence request, identifies the affected creative and claim, and supplies the reason and requested next action. Distinguish a concern supported by evidence from a question awaiting evidence. The reviewer resolves or dismisses findings explicitly, retaining the recorded basis. No automatic pass, risk score, or legal verdict is produced.

The same human workflow serves all three products. Financial terms come from supplied authoritative fictional offer evidence, not an inference from the ad. Objective funding/approval promises can prompt an evidence request; missing evidence in the case does not prove that no substantiation exists elsewhere. V1 includes no automatic checking or OCR. A reviewer can inspect the preserved original without transcribing the whole advertisement.

[Reg Z §1026.24](https://www.consumerfinance.gov/rules-policy/regulations/1026/24/) supplies conditional requirements for covered closed-end advertising. [FTC substantiation policy](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation) supports examining the basis for objective claims. Evidence missing from this inbox does not establish that the advertiser possesses no evidence anywhere.

**Cut:** a global compliance score, a large generic flag list, autonomous legal clearance, invented APR calculations, and automatic rewriting. Missing context needs a question, not a plausible answer.

### D. A request needs an owner and a next action

**Scenario:** the reviewer has finished their current work, but pricing owes a fact and the affiliate owes a revision.

**Decision:** keep the assigned reviewer distinct from the person who must act next. “Waiting” needs a reason and responsible party. The queue should separate work ready for review from work waiting on someone else. Start with straightforward filters and known dates; urgency inferred from “ASAP” is not a risk model.

A correction request should identify the asset, quote or point to the issue, explain the requested change or evidence, and say what happens next. The recipient should not need access to the internal tool to understand it. Offer reusable wording, but let the reviewer edit and consolidate the response.

**Cut:** full CRM contact enrichment, sales pipelines, configurable SLA engines, automated escalation chains, and executive dashboards. A clear next action is more valuable initially than a chart of ambiguous statuses.

### E. Re-review must handle partial fixes and new problems

**Scenario:** v2 fixes the fee statement but leaves a funding question unanswered and introduces another claim elsewhere. The affiliate says “all fixed.”

**Decision:** preserve previous and current packages beside the findings and offer evidence. Identify replaced and unchanged components, and let the reviewer confirm one fix while retaining another concern. The reviewer inspects the full changed material; there is no promised semantic or visual diff. Removing an old phrase, resolving a comment, or asserting “all fixed” is not sufficient to complete the whole review.

The reviewer should be able to reach the affected passage directly and preserve their place while moving between findings. Avoid requiring long explanations for routine actions; consequential dismissals or exceptions need a concise recorded basis. Save visible work reliably and disclose save failures.

[GreenSky's guide](https://cms.greensky.com/docs/core/guidelines/marketing-compliance-guide.pdf#page=4) requires corrected assets to return for final approval. This makes a complete revision loop a stronger demonstration than initial detection alone.

**Cut:** semantic comparison across arbitrary videos, images and languages. Preserve a dependable comparison and disposition path for the selected format.

### F. Approval must have an unambiguous meaning

**Scenario:** a user clicks approve on an old browser tab, a partner writes “approved by us,” or someone expects “approved with changes” to allow immediate use.

**Decision:** an explicit internal reviewer action identifies the exact creative version, offer/context, and decision basis. The backend must reject or require reconfirmation of a stale action. History survives later versions and ordinary reloads. An old approval remains a historical fact; it does not silently become approval of newly received material.

For the prototype, offer clear decisions: request information/changes, approve, or reject. Do not include conditional “approved with changes” unless its usage and verification policy is defined. Adobe Workfront's [general approval workflow](https://experienceleague.adobe.com/en/docs/workfront/using/review-and-approve-work/document-reviews-and-approvals/manage-asset-review-and-approval/doc-approvals-and-proofing) permits a no-further-approval interpretation of that option; financing-company procedures can instead require resubmission. Our simpler policy is a proposed ClearPath choice, not a legal assertion.

An unresolved material finding or evidence request prevents approval under the proposed ClearPath policy. A reviewer can dismiss an inapplicable concern with a recorded reason. The absence of findings is not an automated clearance: final approval remains an explicit human decision with its basis. This workflow does not certify complete national legal coverage.

**Cut:** multiple approval hierarchies, delegated authority administration, and approval by parsing email words. A named demo reviewer is sufficient to demonstrate the distinction; it is not production identity management.

### G. A decision and its communication must stay separate

**Scenario:** approval saves, but a response has only been prepared. An internal note must not become external reply content.

**Decision:** keep decision state separate from reply state. An outgoing draft is **Prepared**, never **Sent**. Keep internal notes separate from external reply content and show the intended recipient. Include a recognizable artifact/version and intended use in the response; an internal case ID alone is insufficient.

The reviewer inspects and edits outgoing drafts; transmission happens outside V1. This completes the internal decision and handoff preparation, but does not demonstrate actual notification or a fully automated round trip.

Zendesk's distinction between [external CCs and internal followers](https://support.zendesk.com/hc/en-us/articles/5179445630234-Understanding-CCs-and-followers) illustrates that conversation participation and visibility are product decisions. It does not establish ClearPath's exact roles.

**Cut:** autonomous external replies, delivery/read tracking, and email recall. If a manual withdrawal is later added, preserve the old decision and create a clear communication task; changing status cannot retract an email or prove takedown.

## 5. A small interface with a complete job

Three working areas should be sufficient:

1. **Review queue:** current status, assigned reviewer, next actor/reason, and requested launch. This replaces the supported Excel queue.
2. **Case workspace:** current creative and rendition, offer/context, actionable findings, revision history, and a readable decision record. The current package and current next action should be immediately visible.
3. **Reply and decision area:** explicit internal note versus external draft, scoped decision, intended recipient, and honest Prepared status.

Use text labels as well as color, readable contrast, clear destructive/terminal actions, and normal keyboard access. Preserve entered work through recoverable errors. These basic usability requirements matter; a bespoke component library, extensive animation, dense charts, and an elaborate dashboard do not determine whether the core job succeeds.

Do not place one overloaded status on every concept. The case may be waiting on pricing while one finding is resolved, another is open, and a reply is still a draft. The interface can summarize these states while preserving their different meanings.

## 6. Selected boundaries

| Priority | Include or preserve | Deliberate boundary |
|---|---|---|
| Core | Direct submission, visible upload/validation outcomes, original-file preservation | No email import, mailbox integration, or automatic case association. |
| Core | One defined review package plus evidence/context; actual renditions available for human inspection | Not automatic approval of unrelated campaign variants or arbitrary-format extraction. |
| Core | Human findings and evidence requests grounded in the actual creative | No automated checks, AI, OCR, or machine compliance guarantee. |
| Core | Clear next actor, actionable feedback, partial revision handling, explicit durable decisions | Not enterprise routing and permission administration. |
| Core | Prepared reply drafts and safe separation of internal/external content | No sending or claim that anyone has been notified. |
| Added after core verification | Portable ZIP review record with original files, version/context records, findings, decisions, timestamps, and captured decision snapshots | Browser download verified. Excludes note records and reply drafts but includes internal reasoning; not an external response or production audit system. |
| Later if useful | Small search/filter improvements, manual withdrawal and communication task | Add only if they materially support the demonstration. |
| Deferred | Email integration, live-web monitoring, campaign publishing, broad templates, extensive analytics, automated product/state rules | These add breadth before the selected job is reliable. All three products already share the human workflow. |

The initial workflow covers personal loans, credit cards, and mortgage prequalification with fictional material and human judgment. Following the [format research](submission-format-research.md), original PNG/JPEG and multipage PDF proofs are the supported visual previews, with accompanying copy, URLs and destination evidence in the same package. Other file types are retained for manual download; a supported rendition may still be needed for review. Do not force a submitter to retype the creative into a text box. This is a representative supported envelope, not a claim about the most frequent industry format.

Distinguish accepting/preserving a file, previewing it, and reviewing it. Successful upload does not mean successful inspection or approval. V1 leaves extraction and automatic analysis out so the reviewer can inspect and decide on actual supported material within the time budget.

This is an unauthenticated shared demonstration, so use fictional creative and context only. Everyone with access can view and change the shared records. Submitted content remains data and cannot execute as application code or alter review authority. Demo identities demonstrate ownership; they do not constitute production authentication or permission administration. Local records and original files are under the Git-ignored data directory by default.

### V2 order, conditional on observed usefulness

Email integration comes first if direct-entry and reply-transfer effort is material. It must preserve message and attachment evidence, support human recovery from ambiguous association, and distinguish received, saved, prepared, and transmitted states. No provider or sending capability is promised by V1.

Only afterward consider a narrow fee comparison, APR-location assistance, or repayment-disclosure lookup. Each needs explicit product/context scope, reliable source evidence, and a demonstrated reduction in work. No finding becomes legal clearance. This ordering replaces earlier proposals to start with live intake and automatic checks.

The interface currently contains general human-review prompts only. A product-specific legal guide is deferred until its sources, applicability, and current status have been verified; it must not become a misleading checklist assembled from external sample claims.

## 7. Demonstration and implementation order

Start with one thin complete path: submit a supported mixed package directly, preserve it, create a case, inspect the actual images/PDF and accompanying copy, and save/retrieve an explicit decision. Then add findings, specific feedback and one revision round. Extend the path with the consequential failure cases below before adding extra surfaces. Prefer a straightforward implementation to generalized abstractions; test the user-visible promises rather than maximizing test count or architectural polish.

| Demonstration | What it proves |
|---|---|
| Directly submit a mixed image/caption/PDF package | Original material and context remain available for review. |
| Upload fails or a file has no supported preview | Failure is visible; preserved other-format files have a manual-download path without implying completed review. |
| Record a correction and a separate evidence request | Human findings retain their distinct basis and requested next action. |
| A revision fixes one issue and leaves another open | Progress is preserved without premature completion. |
| Changed filename/content or an old tab | A decision remains attached to the intended version; stale actions cannot silently approve new material. |
| Required rendition or evidence is missing | Incomplete work stays visibly incomplete with a next action. |
| Save, reload, and inspect a reply | Decision history survives, the partner can recognize the material, and communication status is honest. |

Use a small authored evidence pack with explicit expected workflow outcomes. Include a straightforward review and missing-evidence cases, not just obvious problems. The evaluator should be able to change supported inputs and observe real behavior. Label seeded data; do not imply the app independently discovered human-authored findings. Exact percentage time savings require an actual comparison.

## 8. Implementation and remaining validation

The implementation uses React/Vite/Tailwind, Express, and Node's built-in SQLite on Node 24.14.0. Case data and original files persist locally; browser tests verify that decisions survive reload. The [README](../README.md) records commands and current verification status. Cloudflare Quick Tunnel is the current deployment fallback because ngrok is not configured. The Mac must stay awake, and the app server and tunnel must remain running.

The core loop, export download, and public demo have passed bounded checks. Further product validation should assess whether the result reduces total effort once manual transfer is counted. If Office/HTML/video or link-only submissions dominate real work, revisit the preview boundary using observed evidence. That uncertainty does not require implementing every format in V1.
