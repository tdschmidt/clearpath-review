# External workflow decisions

The submission page preserves an affiliate's work without letting old draft text silently replace a newer package. A saved draft records its base revision and only the fields the submitter actually edited. Unchanged copy, placement, and offer context come from the latest package when the draft is reconciled.

If the package changes, submitting pauses. The submitter sees what changed, explicitly chooses between conflicting text edits, and acknowledges the latest files before continuing. New files selected in the open page remain available. Keep/Replace/Remove choices must be rechecked against the latest package; a replacement whose original disappeared cannot silently become an extra creative. Drafts from the older storage format have no reliable base version, so each differing saved field needs an explicit choice.

This is recovery from ordinary concurrent work, not collaborative editing or an approval decision. An internal note can update the record without changing the package; after refreshing that unchanged package, the submitter can retry with their text and files intact. A browser reload restores text edits, but cannot restore file selections. Every submitted revision still requires human review.

Validation includes two concurrent-browser scenarios: a note-only draft must preserve another actor's corrected copy, and a conflicting copy edit requires an explicit choice while keeping a newly selected PDF.
