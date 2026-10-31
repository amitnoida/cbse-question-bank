# ExamShuru domain cutover — prepared, not production-active

Vercel project remains cbse-question-bank. Supabase project and data stay unchanged.

## Already configured
- examshuru.com attached to the existing production project.
- www.examshuru.com attached with a 308 redirect to examshuru.com.
- Existing examyari.com routes remain untouched.

## DNS required at BigRock
Vercel reports the current apex and www resolving to 127.0.0.1.
Replace the parking/loopback records for these names only:
- @ A 216.198.79.1
- @ A 64.29.17.1
- www CNAME 3767bbb974c34701.vercel-dns-017.com
Use normal/default TTL. Preserve unrelated records, especially MX and email TXT records.
Recheck Vercel recommendations at execution time and verify DNS and HTTPS.

## Before merging this branch
- Supabase Auth Site URL: https://examshuru.com
- Allow https://examshuru.com/auth/callback and https://examshuru.com/reset-password.
- Retain old allowed callback/reset URLs temporarily for existing emails.
- Inspect actual email templates, SMTP sender display name and any configured OAuth providers.
- Rebrand code/UI, metadata, share URLs, install labels and tests are in this branch.
- The logo uses the existing student/book symbol with a new code-rendered ExamShuru wordmark.
- Source asset filenames and internal consent/session keys are deliberately preserved for compatibility.
- Do not invent support@examshuru.com: current working Gmail support remains until a mailbox is configured.
- Review brand artwork and create new external promotional exports separately.

## Cutover and verification
Merge/deploy once DNS and Auth redirects are ready. Verify signup email, existing-account login, password reset, practice, mocks, memberships/coupons, teachers/admin, daily learning and app installation.
Then redirect examyari.com and www.examyari.com to equivalent examshuru.com paths with query strings preserved. Check old verification/recovery email links before enabling redirects on auth routes. Keep old-domain registration active.

## External consoles
Verify examshuru.com in Search Console, submit its sitemap and execute the supported address change process. Update the existing GA4 web stream URL and any domain filters. Payment/OAuth provider allowed domains should be inspected if those services are enabled. Configure support-domain email separately if desired.

Visitors will need to sign in again on the new origin. Installed shortcuts/PWAs may need reinstalling. No student-data migration is needed.
