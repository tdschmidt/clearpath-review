# ClearPath Review

**A workspace for reviewing financial marketing, returning corrections, and recording exactly what was approved.**

## Problem and working hypothesis

ClearPath's brief identifies an Excel/email approval bottleneck, but not its cause. My reconstruction: email carries creative, questions, and revisions; Excel tracks status and ownership; reviewers manually reconcile both. The opportunity is to reduce that reconstruction and incomplete correction rounds. This is a hypothesis, not a finding from ClearPath customer interviews.

## Understanding the work

Reviewers assess a consumer-facing promise against the applicable product terms, supporting evidence, presentation, and intended use. One submission may include an image, caption, and destination. Affiliates need actionable feedback; partner managers need the next owner; compliance needs the exact version and basis for its decision. A revised file does not necessarily answer every request.

## Decision and priorities

I chose an approval workspace over a compliance scanner or template library because coordination most directly addresses the stated workflow. The call emphasized getting consequential interactions right within the take-home scope.

- **Keep the review together.** Material, cited sources, findings, and returned evidence can be inspected alongside one another. Original files and versions remain available.
- **Preserve unresolved work.** Corrections and evidence requests have explicit human dispositions. Required unresolved findings block approval; a partial revision does not clear the case.
- **Separate audiences and handoffs.** Affiliates use a submission/return page, not the internal workspace. Reviewers deliberately share instructions and decisions; private reasoning stays out of that external view.
- **Bound the decision.** Approval identifies a package, reference, and use scope. Changed material requires a new review. A withdrawn supporting reference blocks sharing an earlier approval.

## Research and assumptions

Regulation Z's actual-terms requirements informed versioned offer references; its conditional disclosure rules mean a factually correct claim can still need further disclosures. FTC substantiation policy informed requests for evidence, while digital-disclosure guidance made visual inspection essential. These sources shape what reviewers inspect; they do not mandate our UI or certify its decisions.[1-4]

Published partner procedures include campaign context, source files, and email revision rounds.[5] V1 deliberately uses a portal to complete that loop reliably. Email integration remains valuable; the portal is not evidence that affiliates prefer changing their workflow. PNG/JPEG and PDF are the bounded preview scope, not a claim that all incoming material uses those formats.

## Evidence, limits, and next decisions

The build, 33 API tests, and 19 browser tests passed, with a manual submission-to-shared-decision walkthrough. Authored samples demonstrate workflow, not automated detection or legal accuracy. No throughput gain has been measured.

Known gaps remain: new responses do not gate approval, and changed request obligations can be missed by the re-sharing indicator. Those come before broader features. Production also needs authenticated access, notifications, durable operations, and approval lifecycle controls. Automated legal decisions, exhaustive rule coverage, and post-publication monitoring are outside V1.

With a real team, I would observe completed cases and measure active reviewer time, correction rounds, waiting by owner, and missed handoffs. That would test whether coordination is actually the limiting step.

[1: Regulation Z §§1026.16](https://www.consumerfinance.gov/rules-policy/regulations/1026/16/) / [1026.24](https://www.consumerfinance.gov/rules-policy/regulations/1026/24/) · [2: Design basis](regulatory-design-basis.md) · [3: FTC substantiation](https://www.ftc.gov/legal-library/browse/ftc-policy-statement-regarding-advertising-substantiation) · [4: FTC digital disclosures](https://www.ftc.gov/system/files/documents/plain-language/bus41-dot-com-disclosures-information-about-online-advertising.pdf) · [5: Affirm submission process](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm)
