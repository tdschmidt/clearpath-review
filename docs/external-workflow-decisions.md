# External workflow decisions

The submission page preserves an affiliate's work without letting old draft text silently replace a newer package. A saved draft records its base revision and only the fields the submitter actually edited. Unchanged copy, placement, and offer context come from the latest package when the draft is reconciled.

If the package changes, submitting pauses. The submitter sees what changed, explicitly chooses between conflicting text edits, and acknowledges the latest files before continuing. New files selected in the open page remain available. Keep/Replace/Remove choices must be rechecked against the latest package; a replacement whose original disappeared cannot silently become an extra creative. Drafts from the older storage format have no reliable base version, so each differing saved field needs an explicit choice.

This is recovery from ordinary concurrent work, not collaborative editing or an approval decision. An internal note can update the record without changing the package; after refreshing that unchanged package, the submitter can retry with their text and files intact. A browser reload restores text edits, but cannot restore file selections. Every submitted revision still requires human review.

Validation includes two concurrent-browser scenarios: a note-only draft must preserve another actor's corrected copy, and a conflicting copy edit requires an explicit choice while keeping a newly selected PDF.

The return page puts requests before message history. It combines every deliberately shared feedback batch, keeps required changes distinct from advice, links each citation to its preserved file and version, and lets the submitter respond directly to any request. A later caption suggestion must not make an earlier request for evidence disappear. Selecting a request keeps an already written response and attached files intact. The latest message remains visible for instructions that are not attached to a finding; original messages remain available in collapsed history.

The return link stays expanded on the initial receipt and collapses on later visits, keeping it available to copy while giving current requests priority on small screens.

Receipt, assessment, and acceptance have different meanings. A submitted response is awaiting assessment; a shared acknowledgment only says what the reviewer chose to communicate. A request shows acceptance or “no longer required” only after the reviewer explicitly shares that outcome. Internal reasoning and unshared dispositions stay internal. Acceptance is tied to a package version and does not carry forward automatically when the submitter changes the package. The scoped final decision remains above the request list so request updates cannot be mistaken for permission to run an ad.

The browser regression publishes requests A and B, then a separate request C. It replies to A with a real PDF after the later batch, verifies that private assessment and resolution text never appears, checks explicit acceptance, then changes the package and verifies that the earlier acceptance no longer applies. These changes repair the existing review loop; notifications and shared editing remain outside this increment.

## Make both sides discoverable

The submitter return page already supported shared requests, answers, revisions, and scoped results, but its link was buried in Case details. The review header now exposes **View submitter page** when a return link exists, and prepared cases offer separate **Review case** and **Submitter page** links. The latter opens in another tab so a tester can compare both sides without changing identity or giving an affiliate internal navigation. Opening the link publishes nothing: internal notes and findings remain private until deliberately shared. The live header and sample links were checked in the browser.

## Say who acts next on the submitter page

A new summary sits above the latest message and individual requests. It counts unresolved required requests, requests awaiting reviewer assessment, and addressed requests. A received answer remains unresolved until the reviewer shares an outcome. When all outstanding answers are awaiting assessment, the page says not to resend them. When requests are addressed, it still says the final decision is pending. Returning a newer package shows receipt and explains that earlier requests remain open until assessed; it does not infer that every correction was made.

An **Update submitted material** action beside the summary opens and focuses the revision form. The per-request **Respond** action still selects the relevant request and opens the answer/evidence flow. This separates changes to the advertising package from answers that support review without requiring the submitter to understand internal statuses. Affiliates and internal marketers use the same submission contract. Notifications are explicitly absent; future email should deliver these same shared requests and link back to their exact case, rather than establish a second source of instructions.

Validation covers multiple feedback batches, partial responses, shared acceptance, new versions, private-field exclusion, and focus on the updated-package form. A browser regression checks receipt → reviewer assessment → explicit acceptance → decision pending, so an answered request cannot be presented as final approval. The subsequent [readiness fixes](submission-readiness.md) also gate approval and sharing on response assessment and compare all recipient-visible request fields with the latest shared snapshot.
