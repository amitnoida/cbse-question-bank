# Standing owner authorization — CBSE Advanced Mock candidate releases

**Authorized on 28 October 2026** by the application owner in this chat:
> "You have my default approval for all batches which is ready to deploy into prd. You don't need my approval for each batch. After batch review, whatever MCQ can be deployed please do it."

## Application scope
- Existing production application: https://cbse-question-bank.vercel.app
- Supabase: `darfsuqfmmunxqiyqlvn`.
- Class 11/12 CBSE school-level **Advanced Mock** only (Biology, Chemistry, Mathematics, Physics).
- Source legacy competitive-exam labels must not be displayed in student question texts; old staging source metadata is not displayed.
- This authorization does NOT waive academic review or permit blanket promotion of questions that passed only automated structural checks.

## Allowed without repeated owner approval
- Carry out **first-pass, per-question AI-assisted academic review** against current CBSE curriculum and NCERT where possible.
- Accept only clear answers, plausible options, appropriate Advanced-level difficulty, correct subject/chapter mapping, adequate explanation and low-content redundancy.
- On ambiguous, incorrect, repetitive, media-dependent, overly easy, out-of-syllabus or time-intensive items, **skip/hold rather than spend more time repairing**.
- Once a subject has **at least 60** distinct defensibly reviewed questions, release the exact IDs to the *isolated* `cbse_import.advanced_mock_stage2_candidates_20261028` Advanced Mock ledger.
- Protect original `public.questions.is_active` status, student data, standard mocks and subscriptions.
- Use atomic SQL checks for exact count, subject/chapter, answer/media eligibility, no exam branding, non-overlap with active-school items, and zero unintended cross-subject release.
- After each release, perform **read-only production database safety checks only** (exact approved IDs, subject/chapter counts, no unintended activation, zero blocked items). **Do not execute paid/free browser or end-to-end tests after individual batches.**
- **Run one consolidated production end-to-end suite only after all qualifying batches have been released** and the current academic release pass is finished. Use designated test accounts to cover all released subjects, free/paid access, autosave, resume, scoring, test history, and PDF/print control; document all outcomes together.
- Keep audit SQL, source ID roster and review notes in GitHub draft PR #24.

## Never automatically approve
- Bulk preliminary QA passes without substantive answer and syllabus review.
- Questions marked HOLD, too basic, repetitive, ambiguous or needing corrections; other subjects with fewer than 60 reviewed viable questions.
- Unrelated changes to student access, live school questions, coupons, payments, subscriptions, original auth, deletion or app-wide schema.
- Any unexpected production migration failure, unbounded scope or dangerous write outside isolated Advanced Mock release ledger.

## Limitations
- The review is AI-assisted, not professional teacher certification.
- Standing authorization is a release decision policy for a running review workflow. It **does not itself schedule future background execution**; a future agent run or automation is required to continue later.

## Testing cadence amended on 28 October 2026
The owner explicitly instructed: **"Testing do once all ques will be in prd not for each batch"**. This overrides any older per-batch test plan or test recommendation. Do not start new targeted GitHub browser-test workflows while academic releases are ongoing. The Biology workflow triggered before this amendment has already completed successfully; it should not be repeated. This does not waive the basic SQL post-release safety checks.
