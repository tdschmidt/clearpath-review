# What changed after the audit

The original [audit](ux-product-audit.md) describes the first build. The [decision log](implementation-decisions.md) explains why we changed it. This is the current boundary, not a claim that the demonstration is ready for real financial campaigns.

| Audit concern | Implemented response | Remaining boundary |
|---|---|---|
| Affiliates entered the internal workspace. | Separate `/submit` form and random case return link; scoped API response, file access, revisions, and responses. Links can be replaced. | Reviewer dashboard is deliberately open. Anyone can assume a demo participant. Production authentication, authorization, link expiry, and identity verification are deferred. |
| Findings hid the material and lacked exact locations. | Adjacent editor; preserved file/version/page citations; offer facts and source preview; selectable PDF text. | No OCR, region annotations, or automatic issue detection. Scanned PDFs still require visual inspection. |
| Queue did not identify useful next work. | To review, Waiting, Completed, and All; reviewer filter, stable sorting, launch/received timing, pending owners; new-work notice. | No inferred risk score, automatic assignment, notifications, or measured service levels. |
| Intake requirements and references were unclear. | Visible missing context, deliberate offer selection, persisted source files/facts, cited pages, reference dates and reasoned applicability. | Facts are manually entered. Reference governance and legal applicability still require responsible people. |
| Internal requests and advice leaked into required affiliate work. | Explicit audience independent of owner and blocking status; selected external requests, required/advice groups, immutable shared snapshots. | The sender must inspect manually written messages. The software does not determine whether their text is appropriate. |
| Replies were one-shot drafts without a return path. | Reopen/edit draft versions; explicit message refresh; share feedback/result to the return page; responses tied to requests; separately record outside communication. | No email integration or delivery/read verification. Copy/download does not mark a message sent. |
| Replacement and revision context were ambiguous. | Keep/Replace/Remove, role changes, explicit replacement links, versioned product/placement/date/copy/context, predecessor comparison. | No pixel or semantic diff. A filename is never treated as evidence of a match. |
| Edits and stale saves lost reviewer work. | Session text drafts, in-memory uploads, explicit discard, preserved input on version conflict, renewed decision attestation. | Files do not survive browser restart. This is local recovery, not concurrent document editing. |
| Important corrections required recreating records. | Logged title/contact corrections, named ownership, finding amendments, specialist responses, withdrawal and cancellation. | A recorded withdrawal does not remove an ad from its channel or notify anyone by email. |
| Accessibility and validation were uneven. | Keyboard-operable tabs, focus handling, larger working controls, full dates, selectable PDF text, native field validation, and field-named server errors. | No accessibility certification; some server errors remain at form level rather than beside the field. |
| Historical approval data existed but was hard to inspect. | Dedicated decision link with exact package, scope, actor, rationale, offer and finding snapshots; expanded internal ZIP with verified originals. | No tamper-proof audit trail or production retention policy. Missing legacy snapshots are not fabricated. |

The biggest remaining simulation is access control, not storage: uploads, revisions, references, sharing, and decisions persist in SQLite and original-file storage. Seeded findings and offer facts are authored fictional examples. An empty findings list never means that the software cleared the advertising.

The card example illustrates that last distinction. Its “No annual fee” statement can match a product fact and still require a reviewer to consider applicable advertising disclosures. The future seed's context was corrected to say that explicitly; existing historical submissions and decisions were not rewritten.

## Verification to read with the demo

API tests cover state transitions, private-field exclusion, frozen sharing, source integrity, migration, and stale actions. Browser tests exercise real uploads, PDF pages, corrections, preserved drafts, decisions, and the separate submitter journey. The README records the final run and the walkthrough gives a short path through the product. These checks verify the implemented workflow; they do not measure legal accuracy or demonstrate net time savings.
