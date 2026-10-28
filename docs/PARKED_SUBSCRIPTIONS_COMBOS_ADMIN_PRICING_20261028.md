# PARKED — Class-wise Subscriptions, Combo Packages and Admin Pricing

**Recorded:** 28 October 2026 (IST)  
**Decision:** Requirements gathering only — DO NOT implement in live application until explicitly unparked.  
**Current live system:** Global paid membership with ₹99 hardcoded in student application; coupon-based 100% discount activation; payment gateway not connected. This document does not authorize changing existing student memberships or revenue flows.

## 1. Student identity and class promotion
- One permanent student account, email and password across Class 8–12.
- Keep **registered/enrolled class** separate from **learning classes available** and **paid class entitlements**.
- Permit promotion to the next enrolled class with an auditable confirmation; do not delete previous progress or active entitlements.
- Do not unlock a new class solely because profile `class_id` changes.

## 2. Seven initial packages and admin price control
Full Admin controls the publishable price and active/inactive status of seven packages. Admin Viewer can only view prices:
1. Class 8 — 12 months.
2. Class 9 — 12 months.
3. Class 10 — 12 months.
4. Class 11 — 12 months.
5. Class 12 — 12 months.
6. Classes 9 + 10 combo — separate 12-month entitlement for each class.
7. Classes 11 + 12 combo — separate 12-month entitlement for each class.

- Central Admin **Subscription Pricing** screen with one editable price box per package, preview, validation, publish confirmation and audit history (admin, old/new price, timestamp).
- Existing purchases keep the price agreed at purchase. Price changes affect **future orders only**.
- Show savings for combos compared with the two standalone plans; a combo should have a genuine discount.
- Exact new prices, taxes, promotions, payment integration and refund terms are **undecided**.

## 3. Activation and validity
- Ordinary single-class subscriptions last **12 calendar months from actual activation**.
- On **next-class purchase**, offer **Activate Now** or **Activate on upcoming 1 April**.
- For a combo, each class receives a separately stored activation date and expiry; do not use a single combo expiry for both.
- Example: Class 9 activated 15 Oct 2026; valid through 14 Oct 2027. Class 10 bought 15 Jan 2027; activate now (through 14 Jan 2028), or on 1 Apr 2027 (through 31 Mar 2028).
- Renewing an active class should **extend from existing expiry**, not truncate remaining days; policies for scheduled renewals and purchases many months early require final decision.
- A coupon's redemption deadline is separate from purchased membership validity.

## 4. Dynamic learning-class dropdown
- Free / single-class student: registered class only unless additional explicitly granted entitlements exist.
- Combo and add-on students: dropdown lists both permitted learning classes. Only **active entitlements** unlock paid content.
- Scheduled future class may be shown as **Scheduled — starts 1 April**, disabled until start.
- A student may study earlier class until its purchased expiry even after enrolling in the next class.
- Class-scoped practice sessions, mock results, access gates and performance metrics must remain isolated; switching the UI dropdown must not bypass server-side checks.

## 5. My Subscriptions and purchasing
- Student screen shows registered class, each owned class, pending activation, expiry, next-class upsell, price, coupon and renewal.
- Buying an additional class must **not cancel or extend** unrelated subscriptions.
- One checkout may issue two entitlements (combo). Each entitlement records purchased package, class, scheduled/active/expired state and term.
- Preserve original order price and transaction history; support no duplicate active entitlement on repeated webhook events.
- An optional **Switch rather than Add Class** flow (with prorated credit/refund) is **phase 2**, not approved for the first implementation.

## 6. Future technical design (not authorization)
- Pricing master and immutable price/purchase snapshots.
- Entitlement-by-student/class table with activation and expiry, including scheduled states.
- Student enrollment history and promotion audit.
- Validated payment orders/webhooks, coupon applicability, idempotency, receipts and reconciliation.
- Strong backend authorization in every practice/mock/report RPC; do not use client-only class locks.
- Migration that preserves existing memberships, coupon benefits, test history and account identities.
- Dedicated validation for class promotion, combo activation, cross-class RBAC, expiry, refunds, repeated gateway notifications and price changes.

## 7. Outstanding business decisions
- Final prices for all seven packages and whether a next-class add-on has a fixed discount.
- Can a purchaser schedule activation at any date or only upcoming 1 April?
- Whether already enrolled students can defer activation of their current class.
- Grace period, refund/cancellation and renewal rules.
- Payment provider, applicable tax invoices and billing company details.
- Long-term historical reporting beyond the existing 14-day attempt retention.

## Explicit separation from current production stabilization
The following are **not** part of this parked design: review of existing MCQs and images, the currently unavailable ₹99 payment gateway, database security/performance advisory remediation or the existing 12-account school/admin test suite. Do not conflate them with the class-wise subscription redesign.
