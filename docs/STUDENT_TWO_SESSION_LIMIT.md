# Student two-session limit

Policy: students have at most two active browser sessions across phone/laptop. The oldest signed-in session is removed when a third new login enters the application. Tabs in one browser share Supabase's session_id and one slot. Different browsers/incognito count separately. Admin accounts are exempt.

## Enforcement

The signed JWT session_id is verified against auth.sessions. A per-student transaction lock serializes admission. Slot order uses the native Auth created_at timestamp, never last activity or client time. Revocation tombstones prevent an older token from re-registering. Evicted native Auth sessions are removed by exact session ID and student ownership; existing Auth foreign keys cascade removal to refresh tokens. A refreshed JWT cannot bypass the rule.

The PostgREST pre-request guard rejects removed tokens before protected RPCs or direct Data API table requests. is_active_student also enforces the session state, covering answer saves, submissions, assignments and membership changes. The privileged owned mock report endpoint checks the caller's session before using its server client. Public content and admin workflows retain their existing permissions.

The browser registers sessions before protected queries, deduplicates parallel registrations and polls every 20 seconds while visible, plus focus/online checks. Revocation signs out only that browser and displays: “You were signed out because your account was used on another device. Only two active sessions are allowed.” Background/offline browsers display this on reconnection/focus; server access is already blocked. A late response from an older session cannot sign out a newer session. Transient errors do not force logout.

Normal student logout uses local scope so the other retained device stays signed in. Password-reset/global administrative security actions retain their stronger semantics. Saved Practice answers and mock deadlines are not altered by session eviction.

## Rollout

Apply the staged session migration and native-revocation correction with policy disabled. Deploy frontend/server checks and confirm READY/build success. Run `20261030-enable-student-two-sessions.sql` once: it preserves the latest two native sessions per student, marks older ones revoked, removes only those evicted native sessions and enables enforcement atomically. Do not enable against an older frontend. Already-open pages running old bundles may need refresh to receive the new sign-out notice, while server enforcement still applies.

Config is private, RLS-protected and unavailable to client roles. The registry permits owned reads only, with no direct client writes. It stores session IDs/timestamps/reasons, no passwords or tokens. No paid Supabase session feature or new infrastructure is enabled.

## Verification

`test-student-session-policy.cjs` covers first registration, shared tabs/refresh, in-flight deduplication, revocation, admin exemption, rollout toggling and transient failures.

`Student Two-Device Session Checks` creates one run-specific disposable paid QA account, opens separate student browser contexts, verifies first/second admission, third/fourth oldest eviction, direct old-JWT and refresh-token denial, saved-answer/mock-deadline preservation, local logout isolation and three-admin-session exemption. No tokens/passwords or auth traces are uploaded. Remove the exact run-specific account after verification.

`test-student-two-sessions.sql` is an optional explicit rollback-only fixture test. Its remote execution was not completed because the connector repeatedly returned an expired request-state error; do not count it as passing evidence. Live browser/API checks are the end-to-end verification.
