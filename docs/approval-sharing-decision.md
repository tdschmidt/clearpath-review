# A withdrawn reference blocks sharing an earlier approval

The audit found that reference withdrawal blocked a new approval but did not interrupt sharing an approval recorded earlier. That let a consequential action use a basis the organization had since withdrawn.

Portal sharing now checks the reference attached to that exact decision against the current catalog. If withdrawn, the approval cannot be shared again. The reply shows the source version, withdrawal date, and reason, and links back to the package and decision. Recovery uses the existing workflow: supply a current reference, add a revision, complete intake and review, and record a new decision. Changing only the current package's reference never repairs an older decision's basis.

The first implementation permitted a reviewer explanation to override this block. We removed that exception after pressure-testing it against incorrect pricing evidence: a rationale is not corrected substantiation. This also makes sharing consistent with the existing new-approval rule. It is an explicit demo policy, not a legal requirement that every reference change voids every approval.

**Superseded is different from withdrawn.** A newer version can coexist with a historically applicable source. Withdrawal means the reference must no longer support approvals; the reference screen explains that distinction before the action. There is no automatic revocation of historical decisions or previously communicated results. Reviewers can separately withdraw an approval when warranted. A reference-impact queue remains outside scope.

The server catches withdrawal even if the reply was opened earlier. The browser refreshes reference information without discarding drafted text. Rejections and unrelated withdrawals remain unaffected. Recording an actual past communication remains possible; it records an event, not permission for a new send. Copy/download does not verify or control outside communication.

API coverage checks supersession, blocked sharing, rejection of the former override payload, fresh-review recovery, historical snapshots, and retrospective communication. Browser coverage exercises a stale reply, retained text, the decision-record route, and sharing only the new decision after review. Neither test establishes legal correctness or source authority.
