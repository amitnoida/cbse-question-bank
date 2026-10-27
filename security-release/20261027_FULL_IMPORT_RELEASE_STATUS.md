# 2026-10-27 CBSE full-question-bank recovery and release

This release resumes the interrupted Work import using the exact source CSV with SHA-256 `e5ddf80c7d1085dca679e7bac58cf10b95ee6e1d6e004605dcc8ee8e1ffd3ec6`.

## Database checkpoint (production, as observed 2026-10-27)
- Original Class 9 and Class 10 question records: **9,204**, IDs, wording, answer choices, answers, and explanations preserved.
- Active original questions remain **9,189**.
- Imported new inactive questions: **23,762**, consisting of **22,288 PENDING_REVIEW** and **1,474 HOLD** records.
- Total questions: **32,966**; every staged CSV entry has a `question_id` mapping.
- Import batch `cbse_import.batches.status=IMPORTED_INACTIVE_MEDIA_PENDING`.
- All **613** CSV image-bearing rows have their original embedded base64 payloads preserved in `cbse_import.master_rows.payload[17]`; they are **not** uploaded to a public image bucket, and those questions remain `media_ready=false` and inactive.
- New class categories Class 8, 11, 12, JEE Main, JEE Advanced, and NEET remain inactive.
- Previous Class 9/10 question classifications stored before update in `cbse_import.question_classifications_before_cutover_20261027`.
- Database constraint `questions_review_gate_active` prevents activation unless the media is ready and academic review status is approved/legacy.

## Updated logic
- Practice allocation and chapter counts include active PRACTICE and SHARED only, rather than MOCK-only questions.
- Authenticated paid mock allocator `start_next_mock_paper_v2` allocates **48 MOCK + 12 SHARED** without same-paper duplicates, prioritizes never-assigned questions (including the `mock_question_coverage` persistent ledger), resumes unfinished assignments, and permits retakes once numbered exams have been completed.
- `cbse_assigned_mock_questions_v2` delivers authorized assigned questions without correct answers while the exam is running, preserving legacy assignments; `cbse_mock_pool_counts_v2` communicates eligibility and capacity to the UI.
- Existing historical assignments, scores, attempts, and 14-day history were not deleted.

## Application
- Start Next Mock / Resume Mock replaces numbered-selector UX.
- Private GET `/api/reports/mock?attemptId=<id>` checks current authenticated student, completed MOCK status, attempt ownership, and 14-day retention. Report renders student score, every question including unanswered items, correct answer, explanation, and supported diagrams.
- Result page and dashboard provide **Download Complete Report PDF**, implemented via the browser Print / Save as PDF functionality, not a directly streamed binary PDF.
- Latest feature-branch Vercel build succeeded. Authenticated UI and regression testing are out of scope per owner.

## Work remaining before enabling additional classes
1. The 613 embedded image files are retained privately but **still need upload** to an approved question-images asset location. Rewrite question-media references and set `media_ready=true` only once asset paths are verified.
2. All newly imported MCQs are marked `PENDING_REVIEW` or `HOLD` and must undergo academic/content review before activation.
3. Additional classes and exams must have their UI/authorization and release gating completed before enabling their class/subject/chapter records.
4. Independent E2E/browser testing of mock allocator, report permissions, registration, and paid/free journeys remains with the separate testing agent.

The audit SQL `security-release/20261027_resumed_stage1_partial.sql` records the applied database operations and function definitions. It is an audit/migration record, not a command to run automatically on production.
