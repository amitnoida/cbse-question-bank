# Teacher question review and 13-month memberships

Teacher accounts are provisioned only by Full Admin through Create user. Choose Teacher, the assigned class and a password. Teacher is always Paid, email is confirmed without email delivery, and access starts immediately for thirteen calendar months in Asia/Kolkata. Existing students and subscriptions retain their dates. New paid student grants also last thirteen months.

Teachers sign in through the existing application login and are routed to /teacher. They can choose any active subject or chapter in their assigned class. Stable sets contain at most sixty active questions. Decisions are saved per teacher/question: APPROVE, DELETE with reason, CORRECT with comment, proposed answer and explanation. Reopening resumes at the first question whose current content has not been reviewed. Questions changed after review require another review. Diagrams in /question-images are shown with the question/options.

Full Admin uses /admin/teacher-reviews for the consolidated review queue and submitted source files. Teachers never modify live questions. Admin KEEP closes a report; REMOVE sets is_active=false to exclude the question from future allocation while retaining prior results; CORRECT updates the answer and explanation. Stale question/review versions cannot be silently applied. A private audit table records teacher decisions and question changes. Teacher access can be suspended, enabled or extended thirteen months.

Suggest new MCQs accepts up to ten files per submission, ten MiB each: PDF, DOC, DOCX, JPG/JPEG, PNG. Files use a private Supabase bucket; no browser table or storage policies grant access. The server issues path-specific upload tokens and sixty-second download links only after role and ownership checks. Final submission verifies stored size and MIME type. Drafts can be resumed. Statuses: SUBMITTED, UNDER_REVIEW, ADDED, NOT_USED; statuses do not import content. No OCR, AI extraction or paid processing service is provisioned.

Teacher role is stored in a server-owned table, never user-editable metadata. Server APIs verify Auth user, native session ownership, active flag and expiry. Teacher JWTs cannot call student Data API endpoints. Teachers do not get student subscriptions or test access. Student device limits retain their existing two-session behavior; teachers use their separate access model.

Student /memberships shows the same five single classes and two combos to all grades, including Class 12. Unpriced/unconfigured products are displayed as Coming soon rather than assigning invented prices. The existing home-class ₹99 fallback remains available. New different-coverage purchases start immediately for thirteen months; same-coverage renewals add thirteen months after the current expiry. APRIL is rejected server-side. Existing expiry-based coupons, including FREETRIAL through 31 March 2027, retain their promised cutoff. Razorpay setup text is removed. Positive-price checkout remains disabled with a short Payments coming soon button until the gateway is connected.

Deployment sources: maintenance/teacher-review-schema.sql and teacher-membership-functions.sql. The schema source has a file-limit addendum applied as a separate migration. Verification: test-teacher-workspace.sql is rollback-only and uses disposable users/questions, never mutating real question content; e2e/teacher-workspace.spec.cjs covers the live browser/API/file path using disposable identities. Source uploads are collected only; extraction and insertion will be a subsequent decision.

## Verification on 30 October 2026

- 36 focused parser/API/catalogue/session tests passed; TypeScript, focused ESLint and the production Next.js build passed.
- Rollback-only database checks passed: Full Admin provisioning, mandatory paid teacher access, thirteen-month calendar dates, idempotence, student exclusion, native session ownership, assigned-class scope, stable sets, all three decisions, admin correction/removal, stale-content refusal, expiry/suspension, shared Class 12 plan selection and private bucket/grants.
- Live teacher workflow passed (GitHub Actions run 40996145694): mobile layout, creation/login, three reviews, reload/resume, PDF/DOC/PNG uploads, private signed downloads, student and admin access denial, admin feedback and deletion of test source files.
- Live student membership regression passed, 14 browser checks (run 40996291542). Two-device and admin-exemption regression passed, 2 browser checks (run 40995420532, attempt 2).
- Admin account creation and shared Class 12 flow passed, 18 browser checks (run 40996291285). Temporary accounts, review fixtures and uploaded source files were removed afterward.
- No new paid processing services were added. Source-file extraction/import and Razorpay merchant connection remain separate next steps.
- Apply maintenance/teacher-review-indexes.sql with the schema sources; it adds covering indexes for the new foreign keys.
