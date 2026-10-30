<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## ExamYari — standing MCQ import policy (owner decision, 30 October 2026)

**This section overrides older Advanced Mock academic-review queues and any "fix every source item" workflow for future MCQ document imports.** Teachers, not ChatGPT, own substantive academic review. Do not launch AI academic validation, rework rejected questions, or create pending-review questions merely to preserve source content.

For PDFs, Word documents, and other explicitly supported document inputs:

1. Extract the text faithfully. Do not invent questions, options, correct answers, explanation, images, subject, class, or chapter. A brief explanation may be cleaned or shortened from a *clear source explanation*; if the source gives no trustworthy explanation, skip the MCQ rather than make one up.
2. Each accepted MCQ must contain one readable question, four distinct readable answer choices A–D, one unambiguous answer, and a brief readable explanation supported by the document. If any essential element is missing, blurry, ambiguous, image-dependent, outside the parser's supported format, or not reproducible, **skip without repair, OCR escalation, image reconstruction, manual transcription or academic review**.
3. Import only questions with a verified matching active class, subject and chapter. Never guess chapter mapping. Existing teacher-upload flows enforce a single subject/chapter per submitted file; files containing mixed or uncertain chapters must be split or the uncertain questions skipped rather than assigned arbitrarily.
4. Check duplicates against existing question content before insertion and again atomically during insertion, including cross-file and within-file duplicates. Never insert duplicates. Exact normalized text/options fingerprint checks are implemented; do not claim semantic duplicate detection unless actually implemented.
5. **Keep only accepted questions active**: is_active=true, content_review_status='TEST_READY', question_type='MCQ', media_ready=true, with all required fields. TEST_READY is a technical completeness flag, not academic teacher certification. Do not create inactive/HOLD/PENDING_REVIEW queues for rejected imports.
6. Partial success is the goal. Example: if 500 source questions produce 250 reliably complete and mapped, nonduplicate MCQs, insert those 250 and skip the others. Do not spend additional effort chasing the remaining 250. Store import counts and reasons, not discarded question bodies.
7. After import commit is verified, delete the uploaded source file and keep only minimal import history. If a transient download/connection failure interrupts processing, keep source for a safe retry. If the document is readable but yields zero acceptable MCQs, record zero accepted and delete the processed source; truly unreadable files may require safe retry or administrative deletion instead of claiming success.
8. Do not incur external AI/OCR/API charges for this workflow unless the owner explicitly changes the cost policy. Student data, active school questions, memberships and tests must remain unaffected by discarded source questions.
9. Teacher academic review is a distinct, teacher-controlled activity outside this import path. Neither the assistant nor its automated scripts must reopen the discontinued 1,540-question Advanced Mock review campaign.

Scope note: This documents an import policy, not support for extracting videos. The current production reader supports selectable-text PDFs and .docx; scanned or multimedia sources are skipped unless a separate feature is explicitly implemented and tested.
