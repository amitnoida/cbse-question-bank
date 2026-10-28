# Stage 2 — Class 11/12 Advanced Mock Test (28 October 2026)

## Latest Vercel preview and 12-account E2E status (28 October 2026)
- **Vercel preview READY**: `https://cbse-question-bank-f74nc65x6-cbse-question-bank.vercel.app`; deployment `dpl_9s9K6bmig3hU3mSY8xYoqVM4mFhE`, commit `2749533bf95fd78faf99a2a66e9823fd494a2811`. `/advanced-mock` returns HTTP 200 through authenticated Vercel fetch. Production domain unchanged.
- User confirmed **12 accounts only**: 10 active school accounts (Classes 8–12, free and paid) and 2 admin accounts. Supabase check found all 10 active student profiles and the two full/viewer admin roles; no legacy competitive accounts are in E2E scope.
- GitHub Actions `Stage 2 Preview 12-Account E2E` run **40669882497** was blocked in the *prerequisites* step: GitHub Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET` **not configured**. `E2E_ACCOUNTS_JSON` was present. **0 of 12 browser test cases executed**, not passed or failed. Run: `https://github.com/amitnoida/cbse-question-bank/actions/runs/40669882497`.
- To unblock without weakening Vercel protection: create or copy a **Protection Bypass for Automation** secret in Vercel project `cbse-question-bank` → Settings → Deployment Protection. Add it to GitHub repository → Settings → Secrets and variables → Actions → New repository secret, name exactly `VERCEL_AUTOMATION_BYPASS_SECRET`. Never put its value in the repository, issue comments, or this chat. Then rerun the **Stage 2 Preview 12-Account E2E** GitHub workflow. The Playwright code sends the bypass header only to the exact preview hostname.
- GitHub Actions `Advanced Mock TypeScript and Build` passed independently (including latest Stage 2 code). No actual 12-account UI results or screenshot artifacts yet.
- This is not a content release: all 7,442 staged advanced source questions remain inactive and unapproved, standard school questions unmodified, and the 1,664 unresolved-source deletion still awaits the user's separate SQL Editor action.


**Status:** Phase A and Stage 2 Phase B **database runtime implemented on production Supabase**; Class 11/12 UI is committed on the Stage 2 GitHub branch. **Preview built successfully; not merged/deployed to production or academically released.**
Production project: `darfsuqfmmunxqiyqlvn`. Branch: `stage2-advanced-mock-20261028` (based on `main`, separate from `stage1-advanced-mock-audit-20261028`).

## Phase A: complete
- Migration `01-isolated-candidate-ledger.sql` applied successfully with Supabase `apply_migration`; created `cbse_import.advanced_mock_stage2_candidates_20261028`.
- **7,442** mapped/inactive source questions staged exclusively for Class 11 and 12 Biology, Chemistry, Mathematics and Physics.
- **0** academically verified, **0** release-approved, **0** original questions activated.
- **315** mapped rows have a media-readiness block; **41** mapped rows have flagged duplicates; **397** mapped rows have source content HOLD. Overlaps are possible; do not sum them.
- Source `question_usage`: MOCK **3,305**, PRACTICE **3,397**, SHARED **740**. These are legacy metadata, not an approved Advanced-only release classification.
- The new candidate ledger has RLS enabled and grants revoked from `PUBLIC`, `anon` and `authenticated` with no student policies. This is a private audit/release ledger, not a student query endpoint.
- No changes to `public.questions`, `public.mock_papers`, student profiles, practice/answer history, subscriptions, standard mock allocation functions, Next.js UI or Vercel deployment.

## Class/subject inventory
| Destination | Biology | Chemistry | Mathematics | Physics | Total |
|---|---:|---:|---:|---:|---:|
| Class 11 | 98 | 1,062 | 652 | 1,569 | 3,381 |
| Class 12 | 1,462 | 979 | 495 | 1,125 | 4,061 |
| **Total** | **1,560** | **2,041** | **1,147** | **2,694** | **7,442** |

## 8 PM IST unresolved-source retirement independence
The 1,664 unmapped source questions remain outside the new candidate ledger (verified **0 overlap**).
User approved retirement of those 1,664 after archive/guard checks. Their backup and deletion are **not yet executed**. The Stage 1 branch's `13-user-approved-unresolved-retirement-NOT-EXECUTED.sql` has been updated to verify the 7,442 ledger remains intact, and to enable RLS/revoke public grants on its three backup tables.
**After successful retirement:** original Stage 1 mapping/audit counts should be 7,442 each; Stage 2 candidate ledger remains 7,442; unresolved count becomes 0. Do not automatically rerun the Stage 2 insert or release the questions.

## Phase B: implemented this session
- Applied migration `03-isolated-advanced-mock-runtime.sql` successfully: isolated `public.advanced_mock_papers` and `public.advanced_mock_answers` (both RLS enabled, zero client table grants).
- Public RPCs `advanced_mock_overview_v1`, `advanced_mock_start_v1`, `advanced_mock_get_v1`, `advanced_mock_answer_v1`, `advanced_mock_finish_v1` require active student identity and enforce per-paper ownership; start requires paid enrollment in Class 11/12.
- Private score finalizer in `cbse_import.advanced_mock_finalize_v1`. Source question answer/explanation not returned for STARTED papers, only after COMPLETED. Existing Standard Mock RPCs, assignments, results and practice logic untouched.
- 60 unique randomized questions per paper, numbered paper sequence followed by retakes; resume and one STARTED paper per student/subject, 60-minute deadline and server-side scoring on completion or expiration.
- New `app/advanced-mock/page.tsx`: subject selector, eligibility state, history, per-question navigation, save response, timer, submit, completed answer review and print/save-as-PDF.
- Class 11/12 dashboard `app/app/page.tsx` links to the separate route. Classes 8–10 do not see the link.
- SQL verification: anonymous functions reject unauthenticated callers (SQLSTATE 42501), anonymous table reads denied and RLS enabled; expected 7,442 candidate rows and 0 release approvals.
- Full **rollback-only** database simulation with a paid Class 12 test profile: provisionally selected 60 ledger rows *inside a rollback-only subtransaction*, allocated paper, verified 60 questions/no answer exposure before submission, saved answer, finalized score, read review, then rolled back every flag/paper/answer. Confirmed **0** persisted advanced papers, **0** persisted answers, **0** releases. This was a technical simulation, **not** academic verification or live browser testing.
- The standard system still shows 38 original `public.mock_papers` rows (unchanged).

### Release blockers
1. **Vercel build quota:** Explicit preview deployment request failed HTTP **402** `api-deployments-free-per-day` (>100 deployments; try after 24 hours or resolve plan limits). No new branch preview or production deployment of this code is verified. GitHub branch is not merged into `main`.
2. **Academic content:** 7,442 questions remain inactive, **0** ledger release-approved. Student UI will display a pending-approval state; it cannot start a real paper until 60 approved questions exist in a subject.
3. **Browser end-to-end test:** not performed; no deployment of latest commit available. SQL technical simulation is not a substitute.
4. **Legacy RLS audit:** six older `cbse_import` tables flagged without RLS, as described below; remediation awaits separate review.

## Further release steps after blockers clear
1. Validate latest Stage 2 branch build and preview before merging to production. Run authenticated Class 11 and 12 UI tests, time expiry, return/resume, free vs paid denial, cross-student ownership, scoring/report and Standard Mock regression.
2. Independently academically review and approve sufficient Advanced source MCQs, including answer quality, image accessibility and duplicates. Do not bulk release pending/HOLD questions.
3. Merge/deploy UI only after branch build and access tests; leave zero-approved gate closed until academic release.
4. Do not alter the six student profiles tied to legacy competitive class IDs; handle as a separate retirement migration.

## Original Phase B implementation checklist (for traceability)
1. Implement separate `ADVANCED` mock category, question-pool isolation, entitlement check and independently numbered/retake 60-question paper assignments. The existing `start_next_mock_paper_v2` and 48 MOCK + 12 SHARED standard allocator must remain unchanged. Existing student/class entitlements, resume/history/results must not be affected.
2. Add a student dashboard Advanced Mock Test section **only for Classes 11/12**, separated from ordinary Standard Mock and chapter practice. Never expose legacy JEE/NEET labels in user-visible UI.
3. Build isolated authorized question delivery, persisted answers, deadline enforcement, scoring and reporting; no correct answer/explanation before submit; preserve student access controls.
4. Implement signed per-question academic/answer, duplicate and media release approval. No automatic approval, no media-referenced questions without working assets. User's desire to move quickly does not substitute for correctness checks.
5. Integrate and test separate data model before switching the feature on. Avoid simply marking existing inactive competitive-source records `is_active=true`: **the current standard/mock/practice RPCs select active questions by subject and would then mix Advanced with Standard.**
6. Stage 2 should never delete or repoint the six student profiles still bound to legacy competitive class IDs; their retirement is a separate migration dependency.

## Security advisory observed during Phase A
Supabase's table inventory flagged **six older cbse_import staging/backup tables with RLS disabled**:
`question_classifications_before_cutover_20261027`,
`preliminary_activation_20261027`,
`inactive_school_questions_backup_20261028`,
`removed_jee_main_questions_backup_20261028`,
`advanced_mock_mapping_20261028`, and
`advanced_mock_stage1_audit_20261028`.
Supabase reported that these may be exposed to API roles. Do **not** assume they are private merely because their schema is called `cbse_import`. A separately reviewed fix should validate API exposure and then enable RLS/revoke API role grants appropriately, without breaking importer/admin workflows. No automatic change was made to those six tables.
