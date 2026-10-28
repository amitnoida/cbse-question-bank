# Stage 2 — Class 11/12 Advanced Mock Test (28 October 2026)

**Status:** Phase A **implemented and verified on production Supabase**; Phase B student-facing advanced test delivery **not deployed**.
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

## Phase B: remaining, independent build
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
