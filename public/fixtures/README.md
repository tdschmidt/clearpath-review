# ClearPath fictional sample materials

These are authored take-home fixtures for a fictional company. They are not real offers, applications, financial advice, or results of automated compliance analysis. The app labels seeded cases as samples. Existing review findings and notes are attributed to the fictional human reviewer Maya Chen.

## Main revision demonstration

The seeded **Make room for what’s next** case (CP-1042, key `personal-loan`) starts **In review**, with intake confirmed and two open material findings. It has the v1 image plus its internal offer reference, but no rendered destination. Prepare feedback, assign the next action, and then work through these submissions:

| Submission | Files | What changes |
| --- | --- | --- |
| v1 / original | `loan/v1/social-ad.png` + `offers/personal-loan.pdf` | The image incorrectly says “No origination fee.” The internal reference requires a 5% origination fee. The destination rendition is missing. |
| v2 / partial correction | `loan/v2/social-ad.png`; retain the original offer reference | The new image says “Origination fee applies” and explains deduction from proceeds. Resolve the fee finding only after visually checking it. The missing-destination finding remains open. |
| v3 / complete proposed package | `loan/v3/social-ad.png` + `loan/v3/destination.pdf`; retain the offer reference | The image bytes are intentionally identical to v2. The two-page rendered destination is now supplied. Human review can resolve the destination finding after checking both pages and the intended use; no automatic approval is implied. |

The image filename is **social-ad.png in every version**. The v1 and v2 file bytes differ. Versions v2 and v3 deliberately share the same image bytes: a package can change because a destination was added even when its creative did not. If a browser renames downloads, restore `social-ad.png` before testing same-name revisions. Keep the correct existing components when submitting a revision; the old v1 creative should not remain an active component of v2/v3.

Destination context: `https://clearpath.example/personal-loans` (reserved example domain; not a live webpage). Use `creative` for the image, `destination` for destination.pdf, and `evidence` for the internal offer reference. The offer reference is not consumer creative and cannot fill the missing-destination requirement.

Suggested revision summaries:

- v2: “Corrected fee claim and proceeds disclosure. Destination rendition is still being prepared.”
- v3: “Added the complete two-page destination rendition. Social image is unchanged from v2.”

## Other scenarios

| Key / title | Files | Starting state |
| --- | --- | --- |
| `credit-card` / Everyday, simply | `card/social-ad.png` + `offers/credit-card.pdf` | In review. A limited brand-awareness image and caption, without an application CTA or destination. No authored open finding; a human decision is still required. |
| `mortgage` / A clearer first step home | `mortgage/social-ad.jpg` + `offers/mortgage.pdf` | Waiting for Jordan Wells at Harbor Home to supply the prequalification destination. The JPEG and reference do not complete that scope. |
| Optional manual evidence | `unsupported-evidence.txt` | A note about a missing landing page. Demonstrates unsupported preview/manual handling; it is not a destination rendition. |

All three offer references are valid **September 1 through November 30, 2026** and have distinct immutable fixture version IDs. Dates are fictional campaign facts. No rates, APRs, payments, or rewards are invented in the creative. The $10,000 principal / $500 fee / $9,500 proceeds example appears only in the internal loan reference.

Originals are available under `/fixtures/` for download. The server copies seeded files into its case storage and binds decisions to package revisions. Download availability is not approval or a substitute for authenticated access to actual submissions.
