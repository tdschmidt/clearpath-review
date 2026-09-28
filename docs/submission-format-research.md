# What the approval workspace should receive and show

Research checked September 27, 2026. This informs the [workspace plan](approval-workspace-plan.md); the [product story](product-story.md) explains the broader decision. Format choices follow actual marketing workflows rather than the easiest input to analyze.

**Implemented core:** direct submission with PNG/JPEG and PDF previews, accompanying copy, and versioned context, across personal loans, credit cards, and mortgage prequalification. Other formats are retained for manual download. Review is human; email import, live email, AI, OCR, and automatic checks are deferred. The build and core workflow tests pass. The source inventory below describes industry submission objects; it does not promise native preview or analysis for every listed format.

## Finding: preserve a creative package

The evidence supports mixed submissions: rendered creative, accompanying copy, destination material, campaign context, and supporting facts. It does not support treating pasted landing-page copy as the natural default. It also does not establish which file type dominates an actual lender's queue; public instructions are not volume data.

| Primary evidence | Documented submission objects | Scope and limit |
|---|---|---|
| [Affirm submission instructions](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm), updated February 24, 2026, approval steps 2–3 | Legible image, PDF, Office and presentation files; campaign context; subject/preheader for email creative; destination URL or attachment. | Merchant/platform financing, adjacent to independent affiliates. Accepted file types do not prove submission frequency. |
| [QuinStreet Publisher Service Orders](https://www.quinstreet.com/publisher-service-orders/), IV.4 | Publisher-created creative and test emails covering sender, subject, header and footer variants. Changes return for approval. | Direct publisher-network evidence, subject to the applicable service order. No universal file extension or interface is specified. |
| [Coast2Coast advertising policy](https://support.coast2coastml.com/support/solutions/articles/158000444056-policy-advertising-marketing-compliance-policy), revised April 6, 2026, sections 2, 6–7, 11 | Review includes websites, banners, email, social material, print and scripts; context extends beyond an isolated sentence. | A mortgage company's operating policy, not a universal legal checklist or a measured channel distribution. |
| [Castle Rock compliance manual](https://mortgagesbycastlerock.com/wp-content/uploads/2024/02/Compliance-Manual-2024.pdf#page=25), revised February 2, 2024, printed p.25 | The advertisement, relevant supporting material and an explanation of how/where it will be used. | Historical company-hosted instructions. Only the operating pattern is summarized; the source is not a current national legal template. |

Email has two roles. A partner's submission email transports the review package. A promotional email can itself be the creative, including its subject, sender presentation, body, imagery and destination. A forwarding note or request signature must not be mistaken for part of the consumer-facing advertisement.

## Why the original rendition matters

Text extraction cannot answer whether a qualification is visible, whether a caption is collapsed, or whether a disclosure appears only after interaction.

- In its historical [LendingClub complaint, paragraphs 19–23](https://www.ftc.gov/system/files/documents/cases/lending_club_complaint.pdf#page=8), the FTC reproduced desktop/mobile screens and alleged problems involving a fee claim and disclosure through an APR tooltip. The matter later [settled in 2021](https://www.ftc.gov/news-events/news/press-releases/2021/07/lendingclub-agrees-pay-18-million-settle-ftc-charges). This illustrates why the displayed state matters; it is not a claim about current LendingClub material.
- The [FTC's endorsement Q&A](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking) discusses disclosures in images and truncated captions. Image text and full caption text should not be concatenated as though consumers necessarily see both together.
- For relevant dwelling-secured ads, [Reg Z §1026.24(f)](https://www.consumerfinance.gov/rules-policy/regulations/1026/24/#f) has conditional prominence/proximity requirements. This reinforces the need to preserve presentation even if mortgage-specific automation is outside the initial product scope.

The implication is to preserve originals and inspect the appropriate context. It is not a requirement to build every renderer or certify every responsive state in 24 hours.

## Selected V1 support

**Build a review package around real files. Limit automation breadth before forcing people to reconstruct their creative as plain text.** The selected scope preserves static promotions for all three products in a shared human workflow. One package can contain an image, accompanying copy and a destination-page proof. Independent variants are separate review cases; related components remain together.

| Input | First-version treatment | What it must not imply |
|---|---|---|
| PNG/JPEG creative or screenshots | Preserve the original and show a legible, zoomable preview. Findings identify the image and passage/region involved. | A screenshot establishes all interactive/responsive states. |
| PDF proof | Preserve the original, show page count and every page through a dependable viewer, and attach findings to the relevant page. | Page one or extracted text alone represents the entire document. |
| Accompanying copy/caption | Enter consumer-facing copy alongside the visual and distinguish it from internal context. Ask for the intended rendered state when visibility matters. | Context supplied by a coordinator is necessarily part of the ad. |
| Destination links | Preserve the URL and its relationship to the creative. Use a supplied rendition/capture for the reviewed evidence; missing or inaccessible material gets a specific follow-up. | A mutable URL permanently identifies what was approved. |
| Consumer-facing test email | Native email/HTML intake is deferred. A supplied PNG/JPEG/PDF proof can enter the supported visual workflow with its sender/subject/body context recorded explicitly. | A screenshot proves every email-client rendering, or V1 parses an imported email. |
| DOC/DOCX, spreadsheets, slides and other files | Preserve the original for manual download. Show that preview/analysis is unavailable and request a supported rendition when needed; native conversion is deferred. | Successful receipt or download means the file was inspected, understood, or approved. |

Accepting, previewing, extracting and checking are separate capabilities. V1 preserves uploaded originals and displays supported formats for human review; it does not extract text or run automatic checks. Successful upload is not approval. Each submission/revision allows 10 new files, 10 MB each, and 25 MB total new uploads/payload; unchanged components can be retained without another upload. The reviewer should not have to retype an image-based ad to submit it. Future extraction needs reliable source locations and honest failure states before supporting an automated finding.

V1 need not include precise canvas annotations. A finding can identify a filename, page and quoted claim, with enough context to locate it quickly. Preserve the original rendition rather than generating a supposedly equivalent ad with a new layout.

## A representative demonstration

Use an authored affiliate package containing a PNG social/display proof, its caption, a PDF destination-page proof and a URL. An internal coordinator submits these directly in V1. The case connects those components to one offer and intended placement. Supporting pricing information remains distinct from the creative.

The human reviewer records one offer-fact concern and asks for missing presentation/context evidence. A directly submitted revision changes the caption while preserving the image. The product identifies the changed component, retains the remaining issue, and eventually records a decision for the reviewed package. Prepared feedback and decision drafts remain separate from communication outside the app.

This is an authored representative case, not a claim that it is the most common industry submission. Email remains relevant research for V2, but there is no V1 email fixture parser or automated rule set. Unrelated variants are submitted separately; automated approval rollups across a whole campaign are deferred.

## Deferrals and their cost

Defer email import and integrations, arbitrary Office/HTML conversion fidelity, dynamic-site crawling, authenticated preview capture, video/audio timing analysis, every email client, OCR, and automatic visual-compliance verdicts. Keeping other-format originals available for manual download does not implement these capabilities.

Deferral must be visible. A link-only request or unsupported creative may need a supplied proof or manual inspection, which adds work. Count that effort when evaluating throughput. If those submissions dominate the assumed workflow, this boundary would need revisiting; no source here establishes that distribution.

The first build should therefore prove a mixed visual package and a correction loop, then expand supported formats based on observed friction. It should not start by redefining all marketing submissions as pasted text.
