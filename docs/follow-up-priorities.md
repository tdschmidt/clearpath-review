# Improvements worth another iteration

Reviewed against `8c9784b` on September 27, 2026. These are proposed follow-ups, not implemented features or a requirement to delay submission.

The assignment asks for greater review throughput. The saved call emphasizes a complete experience for the consequential work and an understandable backend; it explicitly accepts local hosting and incomplete production infrastructure. The transcript is machine-generated and incomplete. This ranking applies that guidance rather than inventing an evaluation rubric.

**Best next evidence:** watch someone unfamiliar with the app complete a correction round. **Best demonstration improvement:** let visitors start a fresh prepared case. **Best focused workflow improvement:** include returned destination material in a revision directly from its assessment. A new compliance scanner would address a less-established bottleneck.

## What was checked

Read the existing call transcript, assignment synthesis, current code, sample-generation script, and workflow tests. Inspected the deployed queue, the returned-evidence case, its two-page PDF, its submitter page, and the submission form. Selecting Marketing email changed the placement but left the same generic intake fields. No review records were changed. This was targeted inspection, not another full regression run or a usability study.

Several important earlier recommendations already work: separate submitter pages, current shared action items, evidence previews beside creative, pending-response attention, partial corrections, explicit decision sharing, and withdrawn-reference warnings. Preserve those behaviors rather than treating old audit findings as unfinished work.

## 1. Test whether the workflow removes reconstruction work

**Gap:** tests establish state correctness, but we still have no observed evidence that a new user understands the workflow or that it reduces total handling effort. That is the largest gap between the implementation and the assignment's throughput objective.

**Smallest useful step:** ask a willing participant to perform three tasks without narration: identify what is blocking a partial correction; respond from the submitter side; assess the answer and communicate the exact decision. Record where they hesitate, need help, or repeat work. Ideally include a compliance reviewer; a non-specialist can test navigation but cannot validate substantive judgments. Arrange participation only with permission.

Then compare the same reconstruction tasks against an explicitly authored email-and-spreadsheet example. Count time finding the current version, locating outstanding requests, identifying the next owner, and communicating the result. Include coordinator and submitter effort. Use matched cases and vary task order where possible; one participant and a familiar scenario are formative evidence, not a throughput benchmark.

**Done when:** a short results note records tasks, observations, assistance given, and one resulting decision. Report actual observations, including failures. Do not convert timestamps in seeded records into savings, count every revision as completed work, or claim legal accuracy from a navigation test.

**Effort:** a small evaluation, with participant availability as the dependency. More useful than adding a metrics dashboard before knowing what to measure.

## 2. Make the prepared scenarios repeatable for each visitor

**Observed:** the live examples are shared mutable cases. Their titles describe their starting stages, but visitors can complete or change them. [Sample navigation](../src/App.tsx) opens those same records, and [the population script](../scripts/populate-demo.mjs) deliberately preserves previously prepared cases. A later visitor may not encounter the behavior the README describes.

**Smallest useful change:** offer “Try a fresh copy” for the partial-correction scenario, with links to that copy's reviewer and submitter pages. Keep the original prepared record available for inspection. Generate a fresh scenario through the existing workflow operations; do not copy old history and present it as new work. Extend to other stages only if useful.

**Done when:** two visitors receive distinct cases and return links; changing one leaves the original and the other copy untouched; a retry does not create duplicates; unresolved requests, original files, and approval gates behave exactly as in normal cases. Do not add a global reset or claim that isolated demo records provide production access control.

**Why it matters:** the evaluator specifically needs to interact with the product. A dependable starting point makes the strongest behavior independently discoverable. This is a better demonstration investment than adding more examples of the same state.

**Effort:** moderate; scenario creation and safe retry behavior need verification.

## 3. Shorten the path from returned evidence to reviewed material

**Observed:** in **Northstar · Destination evidence received**, the reviewer can inspect the returned PDF beside the creative and assess its answer. To make that destination part of the approved package, they must leave that context, open **Add revision**, select the returned file, choose its role, save, confirm intake, and return to the finding. The controls exist, but the next step is not available at the evidence itself. See [finding assessment](../src/FindingReview.tsx), [response display](../src/ResponseThread.tsx), and [revision form](../src/forms.tsx).

**Smallest useful change:** an explicit “Include in next revision” action on a response attachment opens the existing revision form with that file selected and its role awaiting confirmation. Preserve current components, require a revision note, and return to the finding after the normal intake step. Label whether the file is already included in the current package.

**Done when:** the destination enters a new package exactly once without re-uploading; earlier packages remain intact; supporting evidence is never silently promoted to advertising; unrelated findings remain open; stale-case checks still apply. [Existing returned-file tests](../tests/internal-draft.spec.ts) provide a starting point for the regression.

**Why it matters:** this removes navigation from the main correction loop while preserving the important distinction between evidence supporting a judgment and material receiving approval. It shows product judgment more directly than a broad redesign.

**Effort:** a focused UI change using the existing revision API, with an end-to-end test.

## 4. Make intake guidance match one additional placement

**Observed:** choosing **Marketing email** leaves the same offer/context, copy, upload, and destination fields. Subject and preheader can be entered in generic copy, but the form does not specifically request them. Intended run dates remain free text apart from the launch date. See [submission form](../src/SubmitterApp.tsx) and [revision model](../shared/types.ts).

[Affirm's published intake procedure](https://businesshub.affirm.com/hc/en-us/articles/6402545332628-Submitting-Custom-Marketing-Assets-to-Affirm) specifically requests email subject/preheader, relevant destinations, and campaign dates. This supports contextual guidance; it is one program's procedure, not a universal legal checklist. Source rechecked during this review.

**Smallest useful change:** when Marketing email is selected, prompt for subject, preheader, a rendered message, and destination context where applicable. Start with guidance and explicit unknown/not-applicable answers; introduce separate fields only if they remain visible and versioned throughout review and sharing. Include one matching sample.

**Done when:** an email package retains those details through revision and decision; an absent rendition is visible as missing context without being labeled a legal violation; social submissions gain no irrelevant required fields. No email sending, HTML execution, or native email renderer is needed for this slice.

**Why it matters:** avoiding one preventable clarification round directly addresses throughput and shows that “an ad” is a package whose components depend on its placement.

**Effort:** small for guidance; moderate if adding versioned fields. Prioritize after the existing correction journey is easy to use.

## 5. Close the notification gap before full mailbox ingestion

**Observed:** both sides have useful action items but must return and refresh to discover changes. Sharing updates the portal, not an inbox. Manual refreshing also makes a two-tab demonstration less immediate.

**First small step:** detect that a case has changed and show a refresh prompt without overwriting an unsaved form. This improves the live two-sided interaction, but does not notify someone who has closed the app.

**Next product slice:** notify a confirmed recipient when feedback is deliberately shared, evidence returns, or a decision is shared. The message should link to the relevant case or request and contain only information that audience may see. Keep retries and send failures visible. Provider acceptance must not be labeled recipient acknowledgment. Recipient verification and an access boundary must precede real notifications.

**Done when:** each event notifies the correct recipient once, a retry does not duplicate it, failed delivery remains actionable, internal reasoning is excluded, and visiting the link shows the applicable material and current state. Test stale tabs and unsaved drafts separately.

**Why it matters:** a review can be complete while the next person is unaware they need to act. Notifications target that waiting time. Full inbound email comes later unless observation shows manual intake and reply transfer dominate effort; it adds difficult case association, duplicate handling, and ambiguous-attachment recovery.

**Effort:** modest for an update prompt; larger for reliable email and access controls. Do not start a broad integration just before submission.

## 6. Make backend verification easy from a fresh checkout

**Observed:** the repository has substantive API and browser tests and local instructions, but no committed CI workflow. Browser tests currently use a 1440×1000 viewport. Passing these tests does not establish a fresh Linux setup, smaller-screen usability, or keyboard accessibility. See [test configuration](../playwright.config.ts) and [API tests](../server/workflow.test.ts).

**Smallest useful change:** a clean CI run on the specified Node version: install from the lockfile, run API tests, build, install Playwright Chromium and required system libraries, then run browser tests with isolated data. Add a short backend walkthrough tracing submission → revision → finding disposition → decision → sharing, with links to the existing tests for critical invariants. The evaluator explicitly wants to understand how the backend works.

**Done when:** a fresh runner passes without local files, the live database, or credentials. Add focused keyboard and laptop-size checks for the submission form, adjacent evidence, and final decision rather than claiming broad device coverage.

**Effort:** limited verification work. Avoid a codebase rewrite or tests that merely repeat implementation details.

## Later, when evidence makes the case

- **Structured campaign duration:** capture an end date or explicitly unknown/open-ended use. The current applicability check compares only launch with the reference dates. [Regulation Z §1026.24(a)](https://www.consumerfinance.gov/rules-policy/regulations/1026/24/) concerns the availability of advertised terms; it does not mandate our date controls. Surface a mismatch for human review and preserve any explanation. Do not pretend the app stops a campaign. This source was rechecked.
- **Specialist worklists:** the current queue filters by case reviewer, while individual findings can belong to someone else. A request-level “Needs my answer” list could reduce chasing once real identities exist. Do not restore a cosmetic participant switcher.
- **Reference impact review:** withdrawal warnings already work. The additional opportunity is identifying reviews affected by a newly superseding source, with a named reassessment owner. A new reference does not automatically invalidate past decisions.
- **Independent hosting:** move this ahead of feature work if the current host cannot remain available for the review window. Persistence and a restore check matter more than the hosting brand. The accepted tunnel arrangement itself is not a weakness in meeting the brief.

Keep automated legal decisions, exhaustive rule coverage, generic analytics, broad file conversion, and enterprise administration deferred. Authentication and recovery become prerequisites for real users; they are not substitutes for demonstrating that the chosen review workflow is useful.
