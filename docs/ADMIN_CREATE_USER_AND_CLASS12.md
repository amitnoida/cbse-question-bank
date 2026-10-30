# Full Admin account creation and direct Class 12 membership

## Create user

Full Admin opens `/admin` → Create user. The form asks for full name, email, password, school class and Free/Paid, then Submit. Passwords must be 12–128 characters. No invitation or verification email is sent. Public signup's normal email verification remains enabled.

The protected server endpoint checks a verified bearer identity, admin membership, active Full Admin role and completed password-change requirement. The server Auth Admin API uses `email_confirm: true`. The profile remains inactive until its database setup commits. Free gets normal permanent per-subject/mode free allowances. Paid gets one calendar year of selected-class Practice and Real Mock starting at creation. This is an administrator grant, not a payment receipt or Razorpay charge.

Creation uses a request UUID. Double submissions do not create a second account or year. Retries can recover only an Auth identity marked with that exact request and administrator. Existing emails are never overwritten, reset or upgraded by this flow. An incomplete setup remains inactive and can be retried with the same details. A pending request with no recoverable Auth user can be retried after its five-minute lease expires.

Passwords are sent only to the server Auth creation call; they are not stored in creation tracking, audit events or responses. Browser form fields are cleared after success. No credential email is sent.

## Direct Class 12 entrants

`initial_class_id` records the original school class at profile creation. Existing students are backfilled from their first enrollment where available, otherwise their home/current class. The initial class is protected against direct student edits and is retained during progression.

Students initially enrolled in Class 12 receive a single Class 12 plan, price, coupon and payment review. There is no plan/class/combo selector, progression or next-April option. A configured Class 12 product is used; the existing INR 99 current-class offer remains the fallback until that product is configured. Server quote rules also reject other products and April activation for this cohort. Existing coupon-expiry rules remain unchanged. Normal renewals still queue behind existing same-class coverage.

Students progressing from Class 11 retain the wider membership flow and existing entitlements.

Razorpay remains unconfigured. Paid checkout is explicitly unavailable until merchant setup and verification are complete. Admin-created annual grants do not depend on Razorpay.

## Verification

- `maintenance/test-admin-create-student.cjs`: validation, Full Admin gate, confirmed-email Auth options, no password persistence/response, free/paid selection, duplicate email, recovery/idempotence and provisioning failure.
- `maintenance/test-admin-create-student.sql`: rolled-back Auth/profile fixtures, one-year scoped paid grant, free account, retries, direct vs progressed Class 12 and server restrictions.
- Browser workflow `Admin Student Creation and Class 12 Checks`: existing school/admin regression plus Free/Paid creation, immediate password login without verification, duplicate retry and simplified Class 12 coupon review. Fixture passwords are generated in memory and are not uploaded as artifacts. Only run-specific `qa_admin_create_<GITHUB_RUN_ID>_{free,paid}@example.com` accounts are created; remove those fixtures with sessions and dependent grants after verification. Real accounts are never part of cleanup.
