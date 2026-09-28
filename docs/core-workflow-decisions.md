# Closing the core workflow gaps

The follow-up audit tested what happens after a handoff, not just whether a record saves. These changes finish the existing review loop before adding inbox integration or automated checks.

## Changed review basis

A reviewer could resolve a finding against one reference, receive an evidence-only revision, then select a different reference at intake without reconsidering the resolution. Intake now logs the old and new offer/applicability basis and marks addressed findings for explicit recheck. It preserves the original disposition and does not declare a violation. Confirming the same basis leaves findings alone. Regression coverage reproduces the reference change and an applicability-only change, and verifies that approval waits for human reconsideration.
