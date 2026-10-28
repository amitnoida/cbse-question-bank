# Stage 1 — migration dependency and retirement safeguards (28 October 2026)

**Inspection only; no schema, student, question or UI mutation.** Project: `darfsuqfmmunxqiyqlvn`. Competitive class IDs: 6=JEE Main, 7=JEE Advanced, 8=NEET. Subject IDs: 24–32. Do not execute any retirement migration in Stage 1.

## Category inventory (live read-only count)

| Competitive category | Subject-level source counts |
|---|---|
| JEE Main | Chemistry 0, Mathematics 0, Physics 0 |
| JEE Advanced | Chemistry 1,496; Mathematics 1,272; Physics 1,304 |
| NEET | Biology 2,034; Chemistry 1,500; Physics 1,500 |

Total JEE Advanced and NEET = **9,106** inactive questions. Structural routing on 6,362 stays *staged*, not yet migrated.

## Verified dependency counts

| Reference | Source question or competitive class/subject references |
|---|---:|
| `quiz_attempt_answers`, `mock_exam_answers`, `student_answers` referencing the 9,106 source question IDs | 0 source questions |
| `mock_question_coverage`, `practice_question_usage` direct references to source IDs | 0 |
| `mock_papers.question_ids` overlapping source IDs | 0 papers |
| `chapter_mock_papers.question_ids` overlapping source IDs | 0 papers |
| `practice_sessions.question_ids` overlapping source IDs | 0 sessions |
| `quiz_attempts.subject_id`, `practice_sessions.subject_id`, `mock_papers.subject_id`, `mock_exam_sessions.subject_id`, `chapter_mock_papers.subject_id` on competitive subject IDs 24–32 | 0 each |
| `quiz_attempts.chapter_id`, `practice_sessions.chapter_id` on competitive chapters | 0 each |
| `free_usage.subject_id`, `mock_question_coverage.subject_id`, `practice_question_usage.subject_id` on competitive subjects | 0 each |
| `student_enrollments.class_id` on competitive classes 6–8 | 0 |
| **`student_profiles.class_id` on competitive classes 6–8** | **6 profiles — retirement blocker** |

These are observed database references at audit time, not a waiver of future FK/code/array checks. Do not mutate those six student profiles in Stage 1.

## Schema and application migration issues

1. `cbse_import.advanced_mock_mapping_20261028.source_question_id` references `public.questions.id`; `proposed_chapter_id` references `public.chapters.id`. Do not drop destination/source structures while audit rows depend on them.
2. `public.questions.chapter_id` references `public.chapters.id`; `public.chapters.subject_id` references `public.subjects.id`; `public.subjects.class_id` references `public.classes.id`. Existing structural relationships must remain intact.
3. Practice, quiz and student-profile FKs reference those hierarchy tables. Mock paper, practice and chapter paper question ID arrays have no ordinary per-element FK and require explicit future overlap checks.
4. Code uses a broader set of mock, practice and report routes. Do not assume lack of hardcoded `JEE Advanced` references means categories can be dropped: school/competitive options can come dynamically from classes/subjects.
5. Existing 48 MOCK + 12 SHARED allocator and historical attempt/retake compatibility must be preserved. Advanced vs Standard should be explicitly differentiated only in Stage 2 with history-preserving defaults.
6. Class retirement is blocked by **six live student profile class references** and **all 9,106 unmigrated source questions**. Also require per-question academic clearance, corrected/migrated media, destination count parity, source provenance, compatible policies/RLS, and backups/rollback.

## Stage 1 release decision

**NO-GO for Stage 2** on current evidence. Class/subject/chapter drop, source question activation, source chapter reassignment, student profile changes and UI removal are not authorized by this audit. This is a complete *dependency inventory checkpoint*; academic and item-level chapter clearance remain open.
