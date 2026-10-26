# Change 5A + 5B — release gate checklist (26 Oct 2026)

> REVIEW ONLY — this file does not authorize, schedule, or execute any production action.

## Changes included
- **5A — trusted grading and quota:** server-owned practice scoring/history; answer locking; consistent free quota charging; idempotent submission; 10-question subject limit with concurrency safeguards.
- **5B — secure delivery and session boundaries:** student-class and chapter-scoped question RPC; no correct answer or explanation in pre-answer listing; server-assigned sessions; resume/index save; post-answer feedback; historical practice and mock review.
- **Final SQL 03 — separate cutover:** revoke direct question SELECT, direct practice-session/history writes, and legacy free-usage RPC execution.

## Evidence already collected
- Paid Science practice, resume, feedback, server grading, dashboard answer review: local Playwright PASS.
- Free account: 10/10 usage accounted for; server rejected 11th start; local Playwright PASS.
- Paid Mathematics chapter mock: start, answer saving, no early feedback, finish, history review: local Playwright PASS.
- Historical practice and mock review: local Playwright PASS after fixing asynchronous wait assertion.
- Secure question-list response: 642 Mathematics questions without keys; local Playwright PASS.
- Preview branch 93e7805 on Vercel: READY, Next.js build/TypeScript PASS, 203/203 static pages, GET /, /app, /dashboard, /admin all HTTP 200.
- Supabase functions present and executable by authenticated role; SQL 03 not yet applied.

## Outstanding release gates (NOT YET COMPLETE)
- [ ] Confirm current preview build is READY at the latest review branch commit.
- [ ] Authenticated free/paid/admin workflows tested on the deployed preview (not only localhost).
- [ ] Verify old production account and mock history against preview, including read-only error-free review.
- [ ] Confirm production database backup and previous deployment rollback are available.
- [ ] Obtain explicit production release authorization from project owner.
- [ ] Merge only the reviewed commit to main and verify correct Vercel PRODUCTION build.
- [ ] Smoke test production paid/free/admin workflows before SQL 03.
- [ ] Apply **security-release/03_CUTOVER_AFTER_FRONTEND.sql** once; do not use outdated standalone version revoking practice_sessions INSERT only.
- [ ] Post-cutover negative tests: authenticated direct SELECT questions denied, INSERT/DELETE practice_sessions denied, quiz_attempts/answers INSERT/UPDATE/DELETE denied; legacy free-usage RPC denied.
- [ ] Post-cutover positive tests: secure question RPC, paid/free grading/history, mock and admin actions remain functional.

## Emergency only
1. If cutover blocks legitimate production workflows, use **security-release/04_EMERGENCY_RESTORE_ACCESS.sql** under incident approval.
2. Revert frontend to known-good production release (commit ea43c2b at time of review) and verify.
3. Emergency restore reopens known direct-access security weaknesses; investigate and replan a safe cutover.

Never commit Playwright auth files, tokens, browser storage state or local .env credentials.
