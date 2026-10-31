# Mobile browser regression

Run `npm install --no-save --package-lock=false @playwright/test@1.56.1`, then `npx playwright install --with-deps chromium webkit` and `npx playwright test --config=e2e/mobile-compatibility.config.cjs`.

Default target: https://examshuru.com. Override with E2E_BASE_URL for a separately configured test site. The suite does not create accounts, send recovery emails, purchase memberships or submit saved student assessments. Guest demo answers exist only in browser memory. Auth requests in the resend scenarios are intercepted; signup, sign-in errors and email service responses are simulated without sending emails.

32 scenarios: eight checks each on small/large Android Chromium and small/large iPhone WebKit profiles. Includes portrait/landscape layout, signup control sizing and required acknowledgement, login/recovery navigation, in-page Android/iPhone instructions with no floating install controls, full ten-question demo through Finish to signup, manifest/icons and zoom-friendly viewport, signup resend address/callback/countdown, and unconfirmed-login resend rate-limit handling. Reports and failure traces are in results/mobile-*.

GitHub Actions runs after successful Production deployment-status events, on changes to this test suite/workflow, and via Run workflow. A successful run verifies the live deployment at execution time. View/download reports from the run's mobile-compatibility-results artifact (seven-day retention).

Limitations: emulated phone profiles are not physical Android/iOS devices. Native keyboard, actual Add to Home Screen, email-inbox verification/reset, signed-in membership/student/teacher/admin journeys, camera/file providers and interruption/network recovery are not certified by this suite. Tests intentionally avoid handling real credentials or mutating student records.
