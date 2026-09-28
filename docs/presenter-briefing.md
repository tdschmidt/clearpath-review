# ClearPath Review: briefing for the presentation

Read the [one-pager](product-one-pager.md) first. This is the background needed to explain the problem, demonstrate the work, and defend the choices without implying more than we built. Use the [sample-case guide](sample-cases.md) to jump into a particular stage.

## The explanation to start with

“The brief gave me a review bottleneck running through Excel and email. I treated that as a coordination problem to investigate, rather than assuming the answer was automatic compliance review. I reconstructed the likely process, researched what reviewers need to judge, and built the correction loop around exact material, evidence, ownership, and a scoped human decision. I can show that workflow working; I cannot yet claim it reduces review time by a measured percentage.”

The call's central question was what must be right for this user and problem. Its emphasis was a small, complete experience, with deliberate omissions in a 24-hour project. It did not require AI, a particular stack, or production infrastructure. The original recording excerpt is incomplete and its saved transcript is machine-generated; do not turn inferred priorities into a formal scoring rubric.

## What this team probably does

“Compliance marketing” was confirmed to mean the team reviewing marketing for compliance. It is not a separate marketing channel. The reviewer asks whether consumers could be misled, whether specific terms match what the company offers, whether claims have an adequate basis, and whether the relevant qualifications are communicated properly. The organization may also impose brand or internal-policy requirements. These are distinct questions.

A plausible current process looks like this:

1. An affiliate or internal marketer emails an image, PDF, copy, or URL with campaign details. A partner manager may forward it and supply missing context.
2. Someone creates an Excel row: campaign, submitter, product, date received, requested launch, assigned reviewer, status, next owner, and perhaps a link to the thread or files.
3. The reviewer checks completeness, identifies the applicable offer and intended use, opens the material, and consults sources or specialists. The spreadsheet tells them what to work on; the thread holds much of the substance.
4. The reviewer sends questions and corrections. Someone changes the row to “waiting on affiliate.” An answer about a fee may arrive separately from a revised image.
5. Revised files return. The reviewer identifies what changed and which original concerns remain. The tracker and the latest attachment can easily disagree.
6. The reviewer records a decision, communicates it, and retains the reviewed package and reasoning. Launching a different version or using it in a new context may need another review.

This division between email and Excel is our reconstruction, not observed ClearPath behavior. [Affirm's published process](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm) supports the plausibility of context-rich submissions and email correction rounds. Its instructions include audience, medium, dates, and creative or linked-page material. One company's procedure does not prove ClearPath's volumes, format distribution, or cause of delay.

The spreadsheet therefore has a useful purpose: it is the team's index and work tracker. The problem is maintaining its relationship to the changing review record, not the mere existence of a spreadsheet.

## Stakeholders and competing needs

| Person | What they need | What a bad design would cost them |
| --- | --- | --- |
| Compliance reviewer | Current material, applicable facts, unresolved questions, and decision context in one place | Re-reading threads, inspecting the wrong version, missing returned evidence |
| Affiliate or internal marketer | Clear requests and a practical way to return material | Repeated clarification, guessing what changed, unnecessary portal administration |
| Partner manager | Who owes the next action and why | Chasing the wrong person or acting as a manual copying service |
| Product, pricing, credit, or operations specialist | A precise question about the relevant offer or process | Broad requests they cannot answer, repeated requests for the same information |
| Compliance manager | Which work is ready, blocked, or aging | Mistaking waiting time for reviewer underperformance |
| Consumer | Accurate, understandable claims and qualifications | Acting on a promise the product does not support |

These are responsibilities, not six mandatory accounts. A reviewer can remain accountable while the next action belongs to a submitter or specialist. The prototype's fixed reviewer identity is a demo constraint, not an adequate production identity model.

## The judgments reviewers actually make

The reviewer first determines what is being advertised, to whom, where, for which product, and during which period. “A loan ad” is not enough context. They then consider at least four different forms of evidence:

- **Product facts:** the fee, eligibility, APR, or other terms of the applicable offer.
- **Operational support:** what actually happens during funding, credit inquiry, or underwriting, and what substantiates a promised outcome.
- **Law and interpretations:** what requirements apply to this entity, product, communication, and medium.
- **Company policy:** the firm's chosen requirements or approval authority, which must not be presented as universal law.

Approved disclosure wording can help after those questions are understood. It cannot establish missing product facts or make a misleading headline harmless by itself.

Examples worth being able to explain:

**A factual contradiction:** the fictional image says “No origination fee,” while the matching offer says a mandatory 5% fee is deducted from proceeds. The concern is anchored to the exact image and source. If the source belonged to another product, the appropriate first step would be to establish applicability, not confidently declare a contradiction.

**Missing evidence:** a funding-speed promise needs support for the actual promise: when the clock starts, when funds become available, conditions, and the population described. Missing support in this case means the reviewer needs an answer. It does not prove the company has no evidence anywhere or that the claim is false. The [FTC substantiation policy](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation) explains the need for an appropriate reasonable basis for objective advertising claims before dissemination. The app preserves the question and answer; it does not determine evidentiary sufficiency automatically.

**Disclosure and presentation:** a statement can match the product facts while its advertisement still needs additional information. Relevant words also may be present but obscured, distant, or missing from a particular rendition. [FTC .com Disclosures](https://www.ftc.gov/system/files/documents/plain-language/bus41-dot-com-disclosures-information-about-online-advertising.pdf) discusses prominence, proximity, devices, and the consumer's experience. It is staff guidance, not a universal pixel-size test or safe harbor. This is why the original image/PDF matters alongside the text.

**Unresolved classification:** “prequalification,” “preapproval,” and “guaranteed approval” do not establish the lender's actual process. The reviewer needs to know what decision has occurred and what conditions remain. A reviewer can request process evidence without treating every use of a word as a violation.

## Specific regulatory details that changed the design

| Research detail | What it changed in the product | Boundary to say out loud |
| --- | --- | --- |
| Regulation Z §§1026.16(a) and 1026.24(a) require advertised specific credit terms to be actually available. | Offer references preserve product facts, source documents, versions, and applicability context. | The app does not establish that a source is authoritative or accurately entered. |
| Closed-end and open-end advertising have different conditional disclosure provisions. For open-end credit, the official interpretation of §1026.16(b)(1) explicitly includes negative annual-membership-fee claims. | The card sample has a required disclosure-review finding even though its $0 annual fee matches the product facts. “Brand awareness” does not settle that concern. | Three product labels are not three complete legal rule engines. |
| Certain dwelling-secured rate/payment advertising has specific presentation requirements in §1026.24(f). | Original renditions, file/page citations, and adjacent source inspection remain central. | Do not generalize those mortgage provisions to every personal-loan ad. |
| Regulation N §1014.3(q) addresses covered mortgage claims about obtaining a product, including preapproval and guarantees. | Mortgage review preserves the actual claim, context, and evidence rather than a keyword verdict. | Part 1014's scope is tied to FTC jurisdiction; it does not automatically govern every financial institution. |
| FTC Endorsement Guides §255.5 addresses unexpected material connections. | Affiliate context and the actual post belong in the package. | An affiliate placement is not automatically the same as an endorsement, and no single hashtag solves every situation. |

Sources: [Regulation Z §1026.16](https://www.consumerfinance.gov/rules-policy/regulations/1026/16/), [§1026.24](https://www.consumerfinance.gov/rules-policy/regulations/1026/24/), [Regulation N](https://www.ecfr.gov/current/title-12/chapter-X/part-1014), and [FTC Endorsement Guides §255.5](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255/section-255.5). The Guides are administrative interpretations. The UI choices are our product response to this research, not screens mandated by regulation.

A useful retention nuance: [Regulation Z §1026.25(a)](https://www.consumerfinance.gov/rules-policy/regulations/1026/25/) excludes its advertising provisions from the general two-year retention rule. Do not claim that every marketing record must be retained for two years under that section. Exportable originals and history are useful, but this application does not implement a verified legal retention program. The [detailed design basis](regulatory-design-basis.md) explains the separate scoped mortgage-retention research.

We have not implemented exhaustive federal or state-law coverage, privacy or fair-lending evaluation, targeting analysis, licensing checks, application disclosures, or legal-entity classification. National scope in the assignment does not establish which of those apply to a particular case.

## Why this product, and why these boundaries

The main alternatives addressed different possible bottlenecks. A scanner could reduce analysis effort, but needs representative material and evaluation of both missed issues and extra work from false flags. An approved-template library could reduce repeat demand, but assumes campaigns are sufficiently repetitive. The workspace most directly addresses the stated coordination tools and supports judgment without pretending to perform it.

The primary object is a **review package**, not an email, uploaded file, or campaign title. A package includes material and context. A caption change can matter even when an image is unchanged. A response attachment supplies evidence but does not silently become approved creative; the reviewer must explicitly include it in a new package if appropriate.

A **finding** records a concern, basis, location, owner, requested action, audience, and whether it blocks approval. It can be a correction or an evidence request. The reviewer records a disposition. A response does not automatically resolve it. A new revision does not automatically erase it.

An **offer reference** is the supporting product source, not a gallery of past submitted ads. Many reviews can use the same reference. Keeping it separately makes the factual basis inspectable and lets a withdrawal be distinguished from an ordinary newer version.

A **decision** applies to an exact revision and stated scope. A **shared result** is a separate deliberate handoff. Recording a decision privately does not mean the affiliate received it, and publishing on the return page does not mean an email was delivered. These distinctions prevent a tracker from calling a job complete while the next person is still uninformed.

The portal was a deliberate V1 tradeoff. It proves the submission/correction loop and supports external people without placing them in the internal interface. In a real rollout, email would likely remain important. Good email integration must associate messages and attachments with the correct case, handle duplicates, preserve originals, expose uncertainty, and track delivery. It is more than extracting text from a mailbox.

The implementation is intentionally small: React/Vite for the interface, Express for the API, SQLite for persisted records, and original-file storage. The server checks expected record versions and consequential transitions. Saved snapshots preserve what was reviewed or shared. PDF rendering happens in the app so it also works where native browser PDF embeds do not. These are inspectable implementation choices, not evidence of production hardening.

## What the demonstrations prove

The most useful story is a partial correction. Start with a wrong fee claim and missing destination. Return a corrected image. Resolve that concern, but keep the destination request open. The reviewer cannot approve merely because a new version exists. Then inspect the returned two-page PDF, explicitly assemble the package, resolve the remaining request, record a scoped decision, and share it.

A second story is a withdrawn reference. The original approval remains in history, but the system prevents sharing it after its supporting reference is withdrawn. Recovery requires a new revision, applicable source, intake, and fresh human review. This preserves history without treating yesterday's basis as current.

The new samples are prepared stages of fictional work, using the same teaching assets so the workflow differences are clear. Their timestamps reflect setup, not realistic elapsed turnaround. They are not scanner output, independent legal judgments, or a measured dataset. The usual app actions still work on them.

## Be candid about what remains

The [final audit](final-workflow-audit.md) distinguishes defects from scope exclusions. The two highest-value corrections are requiring assessment of newly arrived evidence before approval and detecting all meaningful changes to shared requests. Other gaps include internal revision authorship defaults, redundant re-sharing prompts, retained unrelated evidence, and a stale completed-case banner. Do not describe these as implemented controls.

Production needs authenticated permissions and trustworthy actors, notifications and communication delivery, durable hosting and backups, and governance of source changes and campaign dates. The Mac and tunnel must stay running. Human final judgment is intentional; open access and unreliable handoff cues are not principles to defend as desirable.

If asked what comes next, say: “First close the known evidence and instruction-consistency gaps. Then validate the workflow with actual reviewers and add notifications or email intake based on observed transfer work. I would not start with a broad AI checker before establishing its incremental value and error costs.”

If asked how to measure success, separate **active handling time** from **elapsed cycle time**. Watch a small set of real cases, identify time spent reconstructing material, count clarification/correction rounds, and separate waiting by owner. Compare similar work before and after, with reviewer quality checks. Fewer clicks or a faster scan is not enough if reviewers miss an issue or spend longer correcting the tool.

If asked what discovery could change the direction, name the uncertainty: actual format mix, who is authorized to approve, which sources are authoritative, most common missing inputs, repeated-template volume, and whether delay is analysis or waiting. Those were intentionally open in the brief. The defensible claim is that we made explicit, research-informed choices and tested the consequential interactions, not that we discovered the fictional company's true bottleneck.
