# Stage 2: Mock attempt and complete PDF-report UI — 27 October 2026

## Scope
Follow-up to production rollout be90f0a. This release changes Next.js UI and report-server code only; no schema, question content, question activation, or historical attempts are changed.

## Improvements
- Mock controls indicate the next numbered paper, an unfinished paper to resume, or the next randomized retake.
- Resume remains available for an already assigned mock even if fewer than 48 MOCK / 12 SHARED eligible questions are currently available for new assignments. Server authorization still controls access.
- All new full-syllabus mock assignments continue to be allocated by `start_next_mock_paper_v2`: 48 MOCK + 12 SHARED, unseen first, no duplicates in one paper, stable assignment/resume and saved coverage.
- After `mock_finish_exam` confirms completion, the UI marks the exam completed even when optional feedback or history refresh fails. Server-confirmed scores come from the saved owned `quiz_attempts` row. A failed feedback request does **not** display an inaccurate 0% or reopen the attempt.
- An expired-at-resume or previously completed exam fetches authorized feedback before rendering individual answer explanations. If feedback is unavailable, the saved attempt remains accessible through the report page.
- Correct question numbering is preserved in filtered wrong/skipped reviews.
- Mock history links to completed reports only during their 14-day availability window.
- Secure report endpoint orders all 60 questions in original assigned paper order when a linked paper is available.
- Report header identifies numbered mock/retake, student, subject, submission date, marks, percent, and elapsed duration. Correct, incorrect, and unanswered questions include answer options, correct answers, explanations, and approved question-media diagrams.
- Print-friendly question diagrams load eagerly; PDF print waits for fonts and images and warns on missing diagrams. Use **Download Complete Report PDF → Save as PDF** in the browser system print dialog (works with Hindi and Unicode fonts); this implementation does not stream a direct binary PDF download.

## Production and testing boundary
User assigned end-to-end account/browser tests to a separate agent. This release only uses GitHub code review and Vercel's build/TypeScript validation. There is no user-account browser testing in this change.

## Existing import release gates unchanged
- 32,966 source records accounted for; 9,189 previously active remain active.
- 23,762 new questions inactive, including 1,474 HOLD.
- 613 staged image assets preserved privately and awaiting public asset upload/verification.
- Class 8, 11, 12, JEE Main, JEE Advanced, NEET remain inactive.

## Suggested separate tester coverage
Check paid/free Class 9/10, each eligible subject, 48:12 question selection, no same-paper duplicates, resume after refresh/logout, unanswered navigation, deadline expiry and persisted score, numbered sequence/retake, complete PDF diagrams and print on Android, 14-day expiry, and authorization between two student accounts.
