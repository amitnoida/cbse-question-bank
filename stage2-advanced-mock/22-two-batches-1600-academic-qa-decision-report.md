# CBSE Advanced Mock — Two 800-question batches: academic QA decision report

**Date:** 28 October 2026  
**Project:** `darfsuqfmmunxqiyqlvn`  
**Scope:** Classes 11/12; four subject names (Biology, Chemistry, Mathematics, Physics). **No JEE, NEET or IIT exam-labelled selected questions.**  
**Authority:** [CBSE 2026–27 curriculum](https://cbseacademic.nic.in/curriculum_2027.html).

## Executive summary

Two separate, **non-overlapping 800-MCQ batches (1,600 total)** have been selected and run through rigorous, repeatable **automated QA screening**, with individual outcomes recorded in a restricted Supabase import-schema audit table. This is **not** a completed independent academic verification of 1,600 answers. The user explicitly deferred the final release decision. **No further questions were released**.

### Current release
- Existing **120 Advanced Mock MCQs remain live**: 60 Class 11 Physics and 60 Class 12 Chemistry.
- Existing two completed test-account Advanced Mock papers remain unchanged.
- The 1,600 selected review questions remain **unreleased**, and their original `public.questions` rows remain inactive.
- No changes were made to memberships, subscriptions, student records, original question content, mock results, or Standard Mock/Practice pools.

### Breakdown of the 1,600

| Class | Subject | Batch 1 | Batch 2 | Combined |
|---|---|---:|---:|---:|
| 11 | Biology | 60 | 0 | 60 |
| 11 | Chemistry | 150 | 160 | 310 |
| 11 | Mathematics | 60 | 0 | 60 |
| 11 | Physics | 84 | 0 | 84 |
| 12 | Biology | 183 | 420 | 603 |
| 12 | Chemistry | 85 | 220 | 305 |
| 12 | Mathematics | 60 | 0 | 60 |
| 12 | Physics | 118 | 0 | 118 |
| **Total** | | **800** | **800** | **1,600** |

Batch 2 uses Chemistry XI (160), Biology XII (420), and Chemistry XII (220) because the other subjects lacked enough **fresh nonrepeating numerical question patterns** after Batch 1 and existing release exclusions. All Batch 2 entries are marked Medium/Hard (difficulty label only, not an expert assessment).

## Audited screening results

| Classification | Batch 1 | Batch 2 | Total |
|---|---:|---:|---:|
| Passed **preliminary automated screen** | 572 | 685 | **1,257** |
| Needs additional quality review | 155 | 115 | **270** |
| Existing syllabus-coverage / repetition hold | 73 | 0 | **73** |
| **Total** | **800** | **800** | **1,600** |
| Two-/four-statement questions with internally consistent answer keys | 305 | 501 | **806** |

- **806/806** structured two- or four-statement questions: the selected answer is consistent with individual truth-value labels in its stored explanation, with no missing labels.
- **Zero contradictions in repeated true/false statement labels within each class/subject.** This is an internal-dataset consistency test, **not independent scientific fact verification**. Several hundreds of individual factual statements are reused across generated questions; concept diversity must be considered before expanding mock retakes.
- **Zero exact-text duplicates among 1,600**; zero exact-text collisions with active Class 8–12 school MCQs in the final check; **13 extra numeric-template variants** from the known Class 12 Mathematics hold (26 rows participate in repeated-template groups).
- **Zero JEE/NEET/IIT-labelled stems** after excluding/replacing old-labelled Batch 1 selections and hard-excluding them from Batch 2.
- **Zero active source questions, zero released-question overlap, zero detected blocked media** among the selected 1,600.
- **251** have an explanation shorter than 55 characters (heuristic, not automatically incorrect), **14** marked Easy despite Advanced Mock context, and **270** are queued for more detailed content/complexity review.
- **All 1,600** Stage 2 candidate mappings retain `...NEEDS_REVIEW` status. Even a seemingly appropriate chapter title is not proof that the question meets every CBSE 2026–27 curriculum requirement.

### Academic-verification limitations — do not mislabel as completed

- **5** of the 1,600 were previously individually AI-assisted checked; **1,595** lack a recorded independent full worked-answer, official-curriculum mapping and distractor review.
- In particular **794** are not in the two- or four-statement formats; logical agreement between an answer key and stored explanation was not independently proved for these.
- Even the **806** internally consistent structured items might repeat incorrect source facts; factual correctness cannot be inferred from their self-consistent explanations.
- Batch 1 contains **60 Class 11 Biology questions from only one chapter**, unsuitable to unlock a full-subject mock, and **13 Class 12 Mathematics numeric-template duplicates**. These 73 stay on hold.
- The other Advanced candidates not yet selected in these two batches are outside the scope of this first 1,600-MCQ screening.
- The user will choose final rollout after the academic evidence is complete. No bulk approval of the 1,257 preliminarily screened questions is justified by this report alone.

## Database and GitHub audit artifacts

1. `cbse_import.advanced_mock_bulk_review_batch_20261028` — Batch 1, 800.
2. `cbse_import.advanced_mock_bulk_review_batch2_20261028` — Batch 2, 800, private RLS-enabled, no direct anonymous/authenticated access.
3. `cbse_import.advanced_mock_bulk_academic_audit_20261028` — per-question automated QA flags across 1,600, private RLS-enabled.
4. `stage2-advanced-mock/18-bulk-review-batch2-exact-800.sql` — executed Batch 2 migration, one-time (do not rerun blindly).
5. `stage2-advanced-mock/19-combined-1600-academic-quality-audit.sql` — executed audit migration.
6. `stage2-advanced-mock/20-bulk-1600-academic-audit-register.csv` — full per-ID audit register; **contains no password or protected student data**.
7. `stage2-advanced-mock/21-batch2-800-academic-qa-register.csv` — Batch 2-only audit register.

## Proposed decision gate (not yet authorized)
- Retain existing 120 live items. Do **not** activate or release the remaining 1,600 on the strength of automated QA alone.
- To complete *academic* verification, review answer derivations (including the 794 non-statement questions), scientific facts for the 806 self-consistent statement questions, all chapter mappings against official CBSE texts, distractor plausibility, content level, and concept diversity. Reject/replace questionable questions without changing existing live school data.
- When independently checked sets reach 60 acceptable questions in a subject, present exact-ID release roster and test plan for approval, or approve only after the user explicitly makes their stated final decision.
- Disposition of the remaining staged questions beyond these 1,600 is a separate later batch.

## Immutable safety result
After Batch 2 and audit, Supabase returned **1,600 unique selected, zero selected active source records, zero selected release approvals, zero old JEE/NEET/IIT labels, 120 pre-existing live Advanced MCQs, and two unchanged test-account papers**.
