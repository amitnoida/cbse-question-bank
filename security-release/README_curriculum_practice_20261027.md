# Applied production changes — 27 October 2026

These SQL files document already-applied Supabase migrations/content changes; do not run them blindly. Database migration history is authoritative for DDL. Context content updates have a pre-change row-count guard and are intentionally not replayable after application.

- Seven lookup indexes support current quiz/practice/mock/admin paths; no access grants or RLS policies changed.
- Subject question delivery retains inactive questions only for the signed-in paid student's own unfinished mock assignment, with answer keys/explanations still hidden. New practice and paper counts exclude inactive questions.
- Paid chapter practice allocates the whole chapter. Subject-wide sets remain 60 and free quotas remain 10. Submission and index constraints support chapter cardinality; ownership, immutable assignments and grading checks remain.
- Client feedback retrieval uses batches of at most 60 for large-chapter resume/results. Run `node security-release/check_feedback_batches.mjs` to check batching boundaries and error propagation.
- Twenty original Class 10 poetry MCQs (two per prescribed poem) add initial coverage, not a comprehensive bank. Official source URLs are recorded in poetry_additions_20261027.json.
- Added lesson context to 2,057 existing literature stems. Existing options, keys and explanations were checked against the pre-change snapshot and are unchanged.
- Chapters 145 and 172 were archived from current practice: Hindi's excluded lesson and Social Science's non-prescribed Challenges to Democracy. Existing records/results remain.
- Eight assessment/supplementary scope notes are shown in the app and public chapter catalog. Existing public slugs are preserved.

Controlled tests, rolled back: full 153-question chapter allocation, progress at its final question, submission and complete batched result feedback; 60-question subject set; free-quota/paid-delivery restrictions; archived assigned-question delivery without key exposure; expired mock late-answer rejection and finalization.

No real student records, passwords, grants or RLS policies were changed. This is not an academic certification of every existing MCQ, nor a claim that all device/browser paths were tested.
