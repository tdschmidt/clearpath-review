# Closing the core workflow gaps

The follow-up audit tested what happens after a handoff, not just whether a record saves. These changes finish the existing review loop before adding inbox integration or automated checks.

## Changed review basis

A reviewer could resolve a finding against one reference, receive an evidence-only revision, then select a different reference at intake without reconsidering the resolution. Intake now logs the old and new offer/applicability basis and marks addressed findings for explicit recheck. It preserves the original disposition and does not declare a violation. Confirming the same basis leaves findings alone. Regression coverage reproduces the reference change and an applicability-only change, and verifies that approval waits for human reconsideration.

## Responses, review attention, and shared status

Receiving a response now creates reviewer attention until someone explicitly assesses it. The existing waiting dependencies remain intact; reading an answer is not the same as resolving a finding. A disposition can name the response records considered, which also preserves the connection to their original attachments. That explicit choice clears response attention once a reviewer has considered every linked finding in the current revision; it does not resolve the other findings or publish an acknowledgment. A reviewer can separately share a short acknowledgment. Internal assessment notes and disposition reasons remain outside the submitter response model.

The submitter’s current request list combines all published batches, using the latest deliberately shared wording for each request. Acceptance or withdrawal of a request appears only when the reviewer explicitly shares that status. It applies to the reviewed revision; a later submitter revision does not inherit that acceptance. Sharing feedback can also explicitly mark the case waiting in the same save, without claiming an email was sent.

## Decision versus handoff

An approval or rejection records a review decision, not communication. The queue can now identify a current decision whose handoff is still pending. Sharing that exact result or recording outside communication of a message version explicitly linked to that decision completes the handoff. An unrelated request, a saved draft, or communication about an earlier revision does not count. The link is preserved with each message version; editing a result into an unrelated message cannot silently reuse it.


## Returned files and reviewed packages

A response attachment is preserved evidence, not automatically an approved deliverable. A reviewer may explicitly carry a returned file into a new package as creative, destination, or supporting evidence. This reuses the original bytes and requires fresh intake. The normal retain path accepts current components and response attachments, rather than allowing an unrelated historical file to silently reappear in a package.
