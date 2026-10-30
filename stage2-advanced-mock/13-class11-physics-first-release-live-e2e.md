# Class 11 Physics — Controlled Advanced Mock Release and Live E2E
**Date:** 28 October 2026
**Project:** `darfsuqfmmunxqiyqlvn`
**Source:** CBSE Class XI Physics curriculum 2026–27, https://cbseacademic.nic.in/curriculum_2027.html
**Proof of live browser testing:** https://github.com/amitnoida/cbse-question-bank/actions/runs/40682807204

## Release
- Exactly **60** mapped Physics questions passed an AI-assisted per-question worked-answer and syllabus review, recorded with 60 IDs, correct answer letters and numerical/conceptual checks in `11-class11-physics-60-answer-checks.sql`.
- Coverage: all **14** Class XI Physics chapters, **4–5** questions per chapter. Questions are a first, limited advanced practice set, not a substitute for full-course question-bank coverage.
- An atomic guarded release changed **only** the private `cbse_import.advanced_mock_stage2_candidates_20261028` ledger for exact verified Physics IDs, SQL `12-class11-physics-release-exact-60.sql`. Existing `public.questions.is_active` flags remained FALSE. No Standard Mock content or historic student data changed by the release.
- Before release: 60 unique source IDs, 14 chapters, 60 VERIFIED reviews, 0 media blocks, 0 source active, 0 exact normalized text overlap with active school MCQs, 0 short explanations.

## Browser E2E — PASSED
- GitHub workflow run **40682807204**, **2 passed, 0 failed**, production host.
- Existing `E2E_ACCOUNTS_JSON` secret used without modification.
- `test_11_free@gmail.com`: cannot start the Advanced Physics Mock without paid membership.
- `test_11_paid@gmail.com`: successfully starts a full 60-question Physics mock, persists first answer, reloads and resumes, completes 60 responses, submits, displays answer review and Print/Save PDF button.
- One `COMPLETED` Physics paper with 60 saved answers; automated arbitrary selections produced **8/60**, not a student's result. There are **zero** in-progress Physics papers after the run.
- Browser check validates presence of Print/Save button; actual Android device print/PDF is NOT covered by this test.

## Post-release production read-only audit
| Safeguard | Actual |
|---|---:|
| Private review queue total | 480 |
| All classes reviewed so far | 125 |
| Physics Class 11 Advanced released | 60 |
| Chemistry Class 12 Advanced released | 60 |
| All Advanced released | 120 |
| Other six subjects released | 0 |
| Original source questions unexpectedly active | 0 |
| Physics released chapters | 14 |
| Physics completed paper | 1 |
| Physics saved answer rows | 60 |
| Other subjects' advanced mock attempts | 0 |

## Remaining QA and scope
- Academic review is **AI-assisted**, not independent teacher or subject-matter expert certification. Numerically varied formulations may reuse standard concepts. A broader 60+ bank per subject is needed for meaningfully varied retakes.
- Remaining six unreleased Advanced subject pools require the same answer/syllabus/media verification process; Class 11 Biology has a 1-chapter coverage bottleneck; Class 12 Mathematics has 13 repetitive numerical templates.
- Keep pull request #24 **draft** until further QA. Database release already live and validated. Do not re-run these one-time release SQL files without an idempotent re-release strategy.
