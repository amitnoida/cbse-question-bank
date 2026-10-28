# School MCQ stabilization — inactive queue triage (28 October 2026)

Scope: Classes 8–12 only. Competitive-exam data excluded entirely. This is a **read-only academic triage**, not permission for bulk activation.

## Live verified counts
- School MCQs total: 20,332; currently inactive: **1,058**; active: **19,274**.
- Class 8: 135 inactive (135 HOLD).
- Class 9: 14 inactive (14 LEGACY).
- Class 10: 1 inactive (1 LEGACY).
- Class 11: 480 inactive (231 HOLD, 249 PENDING_REVIEW).
- Class 12: 428 inactive (386 HOLD, 42 PENDING_REVIEW).
- Totals: **752 HOLD**, **291 PENDING_REVIEW**, **15 LEGACY**.
- All 1,058 have `media_ready=true`; no school media still pending.
- All 291 PENDING_REVIEW explanations are below the currently enforced 30-character `TEST_READY` threshold. Do **not** add filler merely to pass the constraint.
- HOLD with short explanations: 57 Class 8 + 22 Class 11 + 162 Class 12 = 241; the other 511 held questions have >=30 character explanations but require academic review.

## Content concerns observed in live rows
- Class 8 English HOLD records include repetitively templated questions across chapters (e.g. 'wisest' superlative and 'clearer' comparative questions). These are not necessarily wrong, but mass activation may harm chapter-specific diversity.
- Class 9 Mathematics inactive QIDs **1426–1429** are nearly identical trivial die questions differing only in impossible threshold (>7, >8, >9, >10), all answer 0; avoid releasing four redundant variations before quality review.
- Class 9 Hindi inactive LEGACY includes titles usually associated with other curricula/class levels (e.g. 'राम-लक्ष्मण-परशुराम संवाद'); verify active Class 9 syllabus alignment before any activation.
- Class 11 Chemistry PENDING_REVIEW examples QIDs **14258**, **14324** state a 'solution of H2O' with 'dissolved H2O'; these may be poorly phrased/chemically misleading; remain inactive for correction/replacement.
- Initial review found **no exact prompt duplicates of those 15 LEGACY rows within the same active chapter**. Not a reason to auto-enable.

## Safe release gate
- Review question wording, question-class/chapter alignment, exact unique correct answer, all distractors, explanation reasoning, normalized near-duplication, question_usage and active ancestor records.
- Record question-level reviewer determination, source/syllabus evidence, explicit corrected fields and QA result.
- Only change `HOLD` / `PENDING_REVIEW` to `TEST_READY` and activate **after** independent content validation and appropriate QA, observing `questions_review_gate_active` plus `cbse_import.guard_question_activation`.
- No historical attempts, assignments, class structure or content should be deleted or silently edited.
- This triage made **no production MCQ content/status changes**.
