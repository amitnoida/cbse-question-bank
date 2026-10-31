# ExamYari growth implementation checklist

This checklist implements the product recommendations accepted on 30 October 2026.

- [x] Five-question guest demo, no account required; only a bounded sample is public.
- [x] Daily five-question challenge, independent of existing free allowances.
- [x] Practise mistakes from owned, completed recent attempts.
- [x] Chapter-level next revision recommendations.
- [x] Monthly aggregate progress for 12 months; detailed answers still expire after 14 days.
- [x] Teacher-created chapter quizzes, student sharing links and owner-only aggregate results.
- [x] Student error reporting and administrator triage; no automatic academic changes.
- [x] Pilot feedback and aggregate acquisition/engagement dashboard.
- [x] Shareable demo/challenge links without student information or public scores.
- [x] Clear pricing/payment availability and focused pilot positioning.
- [x] Meaningful tests for session ownership, first-answer locking, limits and scoring.

External dependencies: real paid checkout needs provider selection, merchant onboarding and credentials; actual teacher academic review, recruiting students, testimonials and paid advertisements require people/decisions outside the app. No paid AI, SMS, email or advertising service is introduced. No automatic messages are sent.

## Verification and limits

- Type generation and TypeScript pass; production build passes (460 pages) using local placeholder public settings. Vercel runtime validation is separate.
- Three focused Node tests cover private feedback redaction, scoring and validation.
- Rollback-only database regression covers daily/assignment idempotency, cross-student isolation, class isolation, first-answer locking, invalid answer and question rejection, aggregate idempotency, owner-only reporting, teacher result scope, closed assignments, service-only grants, unchanged free allowances, chapter recommendations, test progress trigger and aggregate metrics. No synthetic accounts remain.
- Added tables are RLS protected and not readable/writable by browser roles. RPCs are service-only, security invoker; one private trigger maintains progress from existing completed tests.
- Monthly summaries start from currently surviving records; deleted history is not reconstructed. Detailed activity expires after 14 days. Teacher results cover the same window. Aggregate counters are opt-in, approximate counts, not unique visitor/cohort attribution.
- The payment provider is not configured; no external paid service or outgoing campaign messages are added. Teacher academic review, real student pilots and externally executed campaigns remain external tasks.
