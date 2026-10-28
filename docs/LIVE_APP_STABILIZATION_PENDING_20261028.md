# Production stabilization checkpoint — 28 October 2026

Status legend: **DONE** verified, **SAFE/GATED** retained as-is because activation is not approved, **BLOCKED** requires external credential or academic asset, **REVIEW** needs separate security review.

## Area 1 — MCQ/content and diagrams
- **DONE:** Existing database read-only audit: 32,966 questions, 19,110 active, 13,856 inactive; 1,222 school Class 8–12 questions inactive and 12,634 competitive exam questions inactive.
- **DONE (code):** Media Audit query now excludes bare `{}` JSON placeholders, includes actual diagrams or `media_ready=false` pending questions. Correct candidate set: 124 questions with nonempty media + 613 not-ready questions, with some overlap. One new authenticated E2E test added.
- **SAFE/GATED:** Never bulk-activate pending/HOLD questions; keep existing `questions_review_gate_active` constraints and existing active school MCQs intact.
- **BLOCKED:** 613 question images are not ready. Original image payloads are preserved in private `cbse_import.master_rows`, but not yet validated and published in a durable asset store. Of the 613, 164 belong to Class 8–12; the rest belong to deferred competitive exam pools. No image paths, copyright or academic correctness should be invented.
- **BLOCKED:** Academic review of 1,222 inactive school questions; many are HOLD/PENDING_REVIEW. Review subject/chapter/syllabus/correct option/explanation before activation. Do not confuse `is_active=false` with an application outage.
- **Note:** The earlier 2026-10-27 import checkpoint showed only 9,189 active; the live database snapshot on 2026-10-28 is now 19,110 active. Use live numbers, not the historical checkpoint.

## Area 2 — existing subscription and payment readiness (NOT parked V2 pricing)
- **DONE (read-only):** Existing `subscriptions`, `subscription_plans`, `coupons`, `subscription_payments` inspected. There are zero payment transaction rows. Current student UI hardcodes the ₹99 plan and supports only valid 100%-discount coupon activation. Paid checkout is disabled.
- **DONE (code):** Update UI to explicitly state that paid checkout is not yet live, to avoid implying that a student can pay immediately.
- **BLOCKED (provider/user):** A verified merchant payment gateway (Razorpay, Stripe or equivalent) with legal business/KYC, test/live keys, signed server-to-server webhook notifications, refunds, test settlement/reconciliation, price/tax disclosure, receipts, callback/idempotency safeguards.
- **PAUSED (product decision):** The new seven-package Admin Pricing / 12-month / next-April activation / Class 9+10 or 11+12 combo entitlement design is documented **separately and parked**, not implemented. Activating a gateway against the obsolete global membership model would create billing rework and potential misbilling.
- **SAFE/GATED:** No live ₹99 paid charges, subscription entitlement migrations or discount changes have been enabled.

## Area 3 — security and performance
- **DONE:** Add and verify 7 missing foreign-key indexes (migration `cbse_20261028_missing_foreign_key_indexes`). The Supabase missing-foreign-key-index advisor disappeared.
- **DONE:** Full Admin Function/RLS and RLS Policy Reports are deployed; catalog RPC is SECURITY INVOKER and executable only by service_role; all 29 public tables have RLS enabled.
- **REVIEW:** Supabase security linter reports 31 `authenticated_security_definer_function_executable` notices. Many may be intentional server-RPC API endpoints and need *per-function authorization/body review* before revoking EXECUTE.
- **REVIEW:** 23 `auth_rls_initplan` policy optimizations, 2 multiple-permissive-policy notices; preserve behavior and test thoroughly before altering policies. There are 6 no-primary-key notices (review backup/system tables; do not blindly add keys). New indexes can temporarily show as unused because the dataset is small.
- **BLOCKED (dashboard setting):** Supabase Auth leaked-password protection is not enabled according to the security advisor; requires supported Auth configuration management and validation.
- **INFO:** 13 RLS-enabled tables with no policies (default-deny, some private import/backup tables); not automatically a vulnerability.
- Security advisors: [SECURITY DEFINER executable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [Auth leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Performance advisors: [RLS auth initialization](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan), [multiple permissive policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies).

## Required regression before any large release
- Existing school/admin E2E run (12 accounts) previously: 55 passed, 0 failed, 5 skipped due to free quota. Re-run after this media audit reporting change and new index DDL.
- Verify Media Audit under Full Admin, filtered CSV, and allow no student access. For any test data, avoid consuming actual student allowances.
- Separate manual checks: image-based questions, mock report Print/Save PDF on Android, school Class 8–12 free/paid workflows, email verification/signup on iOS.
- Do not mark the three areas “fully finished” until the remaining academic/media, merchant and Auth settings blockers are cleared.
