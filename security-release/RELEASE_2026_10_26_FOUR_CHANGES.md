# Production release — four changes, 26 October 2026

Application commit: 545dd16cdea67d806d566f4a1d6d38976bf30904. Production Vercel build READY (24 seconds).
Previous application commit: c6cfde036beb889fb2f3beeb5994f6310727f3e6.
Database migration: retire_chapter_mocks_and_limit_history_to_14_days.
The separate validation environment is deferred by the owner.

## Delivered
1. Removed chapter-mock creation, selection and wording. New chapter-mock allocation RPCs return a retired-feature error. Full-syllabus papers and retakes remain.
2. Completed practice/mock results and answer details expire after 14 days. Notices appear in both test boxes and dashboard. Restrictive read policies and review RPCs enforce the window. PostgreSQL cleanup runs every 15 minutes. A question-ID-only ledger preserves free question assignments; no scores or answers are stored there.
3. Finish / Review submits fully answered practice from any question. Incomplete tests retain skipped-question review. Saving blocks submission; server finalization remains idempotent.
4. Student-facing install suggestion, persistent Install app action, browser-native prompt when available, iOS/iPadOS guidance, seven-day dismissal, standalone-mode suppression and visible installation help. Internet is required.

## Verification
- Local Next.js production build: PASS, 203/203 generated pages. TypeScript: PASS. New install component lint: PASS.
- Retention transaction tests: PASS — old versus recent results, answer cleanup, compact assignment ledger, preserved full-mock assignments, active sessions, quota counters and repeat cleanup.
- Database-role regressions: PASS — 11th free access rejected; separate-subject allowance; no pre-answer keys; immutable practice answers; saved index; partial submission and skipped scores; repeated finalize returns same attempt; mock session/deadline/answer resume; late-answer rejection and automatic expired finalization; no early retake; chapter RPC retired; expired/inactive/used coupons rejected; student denied admin; Viewer denied writes; Full Admin coupon creation.
- Live browser: PASS — paid Hindi practice, 14 questions, skip Q2/Q5, answer both later, finish from Q5 at 14/14, immediate result and explanations. Result attempt 66.
- Live browser: PASS — full Mathematics paper 2, answer save, exit, reload, resume Q2 with answer preserved and timer 59:49, submit and review. Result attempt 67.
- Live browser: PASS — paid dashboard recent history and Valid through 31 March 2027.
- Live browser: PASS — exhausted free Mathematics still 10/10 after history wipe, another chapter does not bypass limit, Science independent 0/10.
- Live browser: PASS — no chapter-mock selector, two retention notices, automatic install guidance, dismissal across reload, reopen and help navigation.
- Admin authenticated RPC: PASS — summary and read-only student history after cleanup.
- Vercel production error/fatal log scan: no matching logs returned.
- Security advisor comparison: no new warning category; chapter allocation SECURITY DEFINER warnings removed. New ledger intentionally has RLS and no client policies/grants. Existing authorized SECURITY DEFINER and leaked-password-protection notices remain.
- Vercel environment metadata reviewed without decryption: service-role key is production-only and server-named, encrypted type; CRON_SECRET sensitive type. Changing secret classification is separate work.

## Authorized history reset
The owner explicitly authorized clearing all prior quiz attempts. Cleanup left zero attempts and answer rows immediately after reset. New test attempts 66/67 were subsequently created intentionally.
Memberships, free-usage counters and numbered assignments were protected by before/after guards.
Two active practice sessions were preserved at cleanup time.
No authentication users or student profiles were deleted.

## Limits
- Native Android/iPhone installation, iOS standalone suppression and physical phone-call/network-loss recovery require real-device checks. The cloud browser did not offer a native install event; fallback guidance was verified.
- Simultaneous multi-tab race testing was not performed; transactional idempotency and server advisory-lock paths were checked.
- The cleanup function passed operator execution and rolled-back expiry tests; the scheduled job was enabled but its first timed run had not occurred at the recorded check.
- Admin invitation emails, real payments and real account creation were not exercised in this release.
- Existing dashboard aggregate counts reflect retained history, not lifetime totals.

## Rollback
Application rollback can use the previous Vercel deployment. To prevent further cleanup during an incident, a database operator may unschedule cbse-history-retention-14-days.
Do not undo SQL 03/05 or reopen direct client grading writes. Do not remove the assignment ledger without preserving consumed-question tracking.
Deleted prior history is not recoverable from a frontend rollback.
