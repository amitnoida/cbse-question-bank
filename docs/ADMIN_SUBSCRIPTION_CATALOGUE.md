# Admin subscription catalogue — Release C, admin scope

Open `/admin/subscriptions` through the Admin dashboard. Only active FULL_ADMIN accounts with a completed password change and admin_users membership can load or save the catalogue. ADMIN_VIEW and student access is rejected by the API.

Seven fixed products: Classes 8, 9, 10, 11, 12; combos 9+10 and 11+12. Full Admin can edit name, INR price (two decimals), description and configuration status. Prices start unset. Draft permits unset price; Configured requires a price. Both modes are included. Class coverage cannot be altered through the edit API.

This is an admin preparation catalogue, stored separately from the legacy subscription_plans. Configured does not publish a product, grant entitlements or change current prices. Student selection, payments, class progression, validity/activation policy and coupon migration belong to the later student release.

Saves use a revision check and row lock. A stale editor receives HTTP 409 and must reload. Product changes and before/after audit entries commit together. Client roles have no table or function access; the server uses its existing service client after authenticating the administrator. The RPC independently rechecks the actor role and membership. No credentials are added.

Verification:
- `node --test maintenance/test-admin-subscription-catalog.cjs`
- `maintenance/test-admin-subscription-catalog.sql`: dedicated QA role tests, deliberate subtransaction rollback, no lasting catalogue changes.
- TypeScript, focused ESLint, production build.
- `Admin Subscription Catalogue Checks` workflow: anonymous and viewer denial, Full Admin seven-plan page, mobile width and invalid request rejection; read-only production checks, no student allowances consumed.

Deployment: apply `maintenance/20261029-admin-subscription-catalog.sql` once, then deploy frontend. Existing student code has no dependency on these tables. For rollback, restore previous application release; retain catalogue and audit rows. Do not drop tables containing administrator edits.
