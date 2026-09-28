# Reviewer workflow corrections

## Inspect evidence where the answer is assessed

A response attachment was preserved but absent from the reviewer interface. Response cards now expose the original download and an adjacent preview. Package supporting evidence can use the same adjacent pane, so inspecting a substantiation PDF does not replace the disputed creative. Received evidence stays separate from the advertising package: it cannot silently change the material covered by a decision.

This fixes the existing evidence-request promise. It adds neither automatic analysis nor a new intake channel. TypeScript validation passed; the combined correction journey will also be exercised in browser tests before delivery.

## Assess returned work in the finding

An unassessed response now puts a case back in the actionable queue, even if another dependency is still waiting. The finding's assessment view keeps the concern, current material, preserved original, answers, and attachments together. Comparison opens this neutral assessment rather than preselecting Resolve against an old file. Specialists can answer an existing finding in that same context.

When recording a disposition, the reviewer can explicitly identify the responses used as evidence and choose whether to share the request's status. The internal reason stays private. Marking a response reviewed never resolves a finding; acceptance of a request never becomes approval of a package. This removes reconstruction work without delegating a consequential judgment to the software.

## Keep a decided case actionable until its result is communicated

The queue now includes a recorded decision with an unfinished handoff and names its accountable reviewer. The case offers Prepare decision message and Record outside communication. A reviewer explicitly links a saved message version to the decision; an unrelated feedback draft cannot complete that task. Deliberate portal sharing also completes the handoff, while delivery remains unverified.

This preserves the useful separation between an internal judgment and its external communication. It removes a hidden task without requiring automatic publication, email integration, or a new approval stage. Creating a return link is included in deliberate sharing rather than requiring a separate setup action.

Communication records select an immutable message ID and version, including earlier saved versions. A refresh cannot silently change the message claimed to have been sent. Unfinished reply drafts are scoped to their package and decision; reusing a saved draft from an earlier decision requires an explicit check. These details matter because a faithful communication record must describe the text actually used.

## Prioritize the material and consequential fields

The review and queue headers use less vertical space, leaving more of the working material visible. Finding classification is optional detail; audience, the concern and basis, requested action, owner, and required/advisory status remain prominent because they affect who does what and what can block a decision. This is a small refinement of the existing layout, not a visual redesign.

Phone-width inspection found that opening an assessment could leave the new panel far below the viewport. Assessment, material, and evidence actions now move focus to the panel they open. The stacked layout must preserve the same clear next action as the desktop view.

## Render the source in the reference library

The final browser walkthrough found a blank PDF in the reference library: its native browser embed did not work in the in-app browser, while the workspace's PDF viewer did. The library now uses that same viewer, including page selection, selectable text, zoom, and the original-file link. A reviewer must be able to inspect the basis beside a recorded fact; merely preserving the file is insufficient. The regression now checks rendered PDF content instead of just an iframe URL. The production build, focused source-version browser test, and manual in-app rendering check passed.

## Combine deliberate handoffs with the work that causes them

Sharing requests can also record a chosen waiting owner and reason in the same action; saving the message as a draft changes neither. When disposing of a finding in a waiting case, a visible choice returns the case to its reviewer or preserves the wait. Other unresolved findings remain open. These choices remove separate tracker updates while leaving the user in control of the next responsibility; they do not send email or decide compliance.
