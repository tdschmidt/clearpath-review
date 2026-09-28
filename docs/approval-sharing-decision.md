# Reconsider a withdrawn reference before sharing approval

The follow-up audit found that withdrawal blocked a new approval but did not interrupt sharing an approval recorded earlier. Reference withdrawal does not prove that every historical decision is invalid. It does mean the person communicating an approval should see the changed basis and deliberately consider its effect.

Portal sharing now checks the reference attached to that exact decision against the current catalog. If it has been withdrawn, a reviewer must inspect the withdrawal and explain why the existing approval still applies, or return to the decision to withdraw it. The explanation is bound to the specific reference and withdrawal timestamp, recorded internally with the shared result ID, actor, and time. It does not rewrite the original decision or expose internal reasoning to the submitter. Each later sharing action requires its own check.

The server enforces this even when the browser loaded before withdrawal. Withdrawal is a catalog change, so the case version alone cannot detect it. Rejections and unrelated withdrawn references do not trigger this approval check. Recording a message already communicated remains possible: preserving an actual past event is different from permitting a new share. Copying text is not a verified communication channel.

This is a control at the existing sharing action, not a reference-impact queue, automatic revocation, or legal determination. It follows the call's emphasis on getting consequential interactions right. The regulatory research supports retaining the applicable factual basis; it does not mandate this particular acknowledgment or exception policy. In a real organization, who may reaffirm an approval would follow its own policy.

The API regression first reproduced sharing succeeding without reconsideration. It now checks stale or unrelated acknowledgments, reviewer identity, unchanged historical evidence, internal-only rationale, and retrospective communication records.

The reply interface shows the withdrawal date, reason, and original scope before sharing, with a route back to the decision record. A fresh confirmation and internal explanation are required for each sharing attempt; they are not restored from a prior successful share. A rejected stale-browser attempt refreshes the reference catalog while preserving the drafted message. The browser regression withdraws the reference after the reply is already open, then verifies recovery, deliberate sharing, and exclusion of internal explanations from the return page.
