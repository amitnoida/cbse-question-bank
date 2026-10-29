# Student membership release — 29 October 2026

## Implemented

- `/memberships` is the student plan, renewal, dates and class-selection workspace. Both Practice and Real Mock are included.
- Configured admin catalogue products are selectable; Draft products remain hidden. All seven new products start without prices; Full Admin must set a price and mark Configured.
- The pre-existing current-class INR 99 offer remains available until a configured single-class product replaces it. This preserves historical coupon access without inventing new class prices.
- Students choose immediate activation or the next 1 April at 00:00 IST. Memberships last one calendar year from the actual start. A same-class-coverage renewal queues after the latest existing expiry. Different single/combo coverages can overlap; no automatic proration, credit or recurring charge.
- Legacy subscriptions preserve status/start/end dates and a snapshot of the existing enrolled class. No unrelated class is added by migration. Legacy coupons preserve expiry-based access; administrators can explicitly choose ONE_YEAR for future redemptions and set exact plan applicability.
- A coupon can be redeemed once per student. Existing COUPON references are migrated to a redemption ledger. Coupon availability, usage limits, activation, plan applicability and expiry checks remain server-side.
- Quote confirmation uses server prices/scope and rechecks changes. Activation is atomic, request-idempotent and records an audit event. Positive-price activation is rejected while checkout is unavailable; no coupon is consumed.
- Explicit school progression moves the home class to its next grade only while that grade has active purchased coverage. Free access then remains in the new home class after premium expiry. Historical free ledgers are never reset.
- Class selection requires home-class or active purchased entitlement. Future plans do not grant early access. An expired selected class returns to the home class on state refresh. Live mock sessions must finish before switching class. Existing assignment and grading flows remain guarded.
- Full Admin can configure coupon scope and membership validity at `/admin/subscriptions`. Existing redemptions are never rewritten by these controls.

## Payment setup still required

The owner selected Razorpay and has no merchant account yet. No Razorpay integration is provisioned, no keys were retrieved, and no fake checkout or payment-success path is implemented. The UI explicitly reports that paid checkout is unavailable. This release must not be described as completed online purchases.

Next: owner creates/activates an account at https://dashboard.razorpay.com/signup and completes its merchant onboarding. Then connect its sandbox/test resources, follow the provider's current integration instructions, create orders server-side, verify checkout signatures and payment capture, configure and verify webhooks, test retries/refunds, and enable live payments only after verification. Keep secret keys in Vercel server-only environment variables. Never paste them into chat or commit them. Standard provider transaction charges apply; no paid service was enabled by this release.

The student purchase flow remains blocked at this concrete merchant-account dependency. Final prices also remain owner-managed.

## SQL and rollout

Apply `20261029-student-membership-lifecycle.sql`, assignment guards, then the quote/count-guard corrective SQL. The initial source contains the corrected definitions for future reconstruction. The production migration history records the initial migration plus its correction. Private definer entry points check auth.uid(); public wrappers are invoker functions. Browser roles have no direct writes to subscriptions, coupon redemptions or event records.

QA: `test-student-memberships.sql` verifies class scope, combos, next-April scheduling, renewal queuing, coupon expiry and retries, unpaid rejection and expiry fallback. All writes roll back. Existing five-class paid-set/expiry and chapter/free-set SQL checks also pass under rollback. `Student Membership Lifecycle Checks` is a production browser suite covering ten school accounts and admin access; it does not buy plans, redeem real coupons or consume free test allowances.

For rollback, preserve new records and use a compatible application/DB forward fix. An old frontend that treats any future subscription as current premium is not a safe rollback after scheduled subscriptions exist. The entitlement helpers must remain class-scoped.
