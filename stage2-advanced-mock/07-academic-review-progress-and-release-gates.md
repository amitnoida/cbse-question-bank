# Advanced Mock Academic Release — First Controlled Batch
**Date:** 28 October 2026  
**Supabase project:** `darfsuqfmmunxqiyqlvn`  
**Branch:** `advanced-mock-academic-review-20261028`  
**CBSE curriculum:** https://cbseacademic.nic.in/curriculum_2027.html

## Completed in production (isolated private schema only)
- Created `cbse_import.advanced_mock_release_review_20261028` using migration `advanced_mock_private_480_academic_review_queue_20261028`.
- Staged exactly **480 question IDs** in eight 60-question class/subject review lists. Selection favors distinct numerical stem patterns, subject chapter coverage, non-HOLD, non-media-blocked, non-duplicate-flagged, answer choices and explanations. The complete ID list is `academic-review-480-20261028.csv`. This is a **review queue, not a release or source-question update**.
- Independent worked-solution checks recorded for **9 questions** in `06-nine-individually-reviewed-problems.sql`. Only private review statuses were updated, with evidence. Existing Stage 2 ledger `release_approved` and all four actual release checks are still false.
- Confirmed **480 rows**, exactly **60 per subject**, RLS enabled on private table, no direct `anon`/`authenticated` SELECT, source questions inactive and unchanged, and **0 released / 0 Advanced paper attempts / 0 Advanced answers**.

## Live Review Progress
| Class | Subject | Queue | Individually verified | Pending academic check | Blocked for coverage or diversity | Mapped chapters |
|---|---|---:|---:|---:|---:|---:|
| 11 | Biology | 60 | 0 | 0 | 60 coverage gap | 1 |
| 11 | Chemistry | 60 | 0 | 60 | 0 | 9 |
| 11 | Mathematics | 60 | 1 | 59 | 0 | 9 |
| 11 | Physics | 60 | 2 | 58 | 0 | 14 |
| 12 | Biology | 60 | 0 | 60 | 0 | 13 |
| 12 | Chemistry | 60 | 2 | 58 | 0 | 10 |
| 12 | Mathematics | 60 | 2 | 45 | 13 repetitive-pattern replacements | 10 |
| 12 | Physics | 60 | 2 | 58 | 0 | 14 |
| **Total** | | **480** | **9** | **398** | **73** | |

## Substantive blockers that prevent auto-approval
1. **Class 11 Biology**: The entire 98-question source subset maps to *Body Fluids and Circulation*. Even 60 individually correct questions from one chapter would misrepresent a full-subject Class 11 advanced mock. Source additions from other CBSE Class 11 Biology chapters are needed before releasing full-subject tests.
2. **Class 12 Mathematics**: Only 47 distinct numeric-normalized question patterns in the 60-slot review queue. The remaining 13 are structural variants, flagged `NEEDS_DIVERSITY_REPLACEMENT`. Replace with genuinely different question concepts.
3. **All candidate mappings** still have `TITLE_MATCH_NEEDS_REVIEW` or `RULE_MATCH_NEEDS_REVIEW`, not human-approved syllabus mapping.
4. **Academic correctness cannot be inferred from structural screening**. Even with valid four options and a nonempty explanation, every chosen item still needs a worked answer, chapter suitability, duplicate review and CBSE 2026-27 alignment. No blanket approval.
5. Potential mapping ambiguity spotted during review: source question **27297** is a circle-chord calculation currently mapped to *Straight Lines*; the *Conic Sections* chapter may be academically more appropriate. It was not marked verified or released and is not one of the 9 checked records.

## Nine independently checked problems (private QA only)
- **Class 11 Mathematics**: 27445 (parabola tangent intercept area)
- **Class 11 Physics**: 32980 (Atwood pulley), 34207 (successive closed-tube resonances)
- **Class 12 Chemistry**: 31846 (Nernst), 31988 (kinetic rate multipliers)
- **Class 12 Mathematics**: 27624 (continuity limit), 27856 (homogeneous differential equation)
- **Class 12 Physics**: 33619 (fixed-charge dielectric capacitor energy), 34177 (Zener regulator current)

The mathematical checks and selected options are documented alongside each ID in `06-nine-individually-reviewed-problems.sql`. **No question is live due to these nine queue reviews.**

## Release criteria and next executable work
- Verify the pending queue by chapter, read the **full stem + all four options + correct answer + explanation**, solve independently, and check the relevant 2026–27 CBSE syllabus. Reject or correct faulty items via a controlled *candidate* revision; do not silently edit original school data.
- For each subject, require 60 distinct acceptable reviewed items with adequate chapter spread. For Class 11 Biology, expand subject chapter coverage first. For Class 12 Maths, substitute 13 repetition cases first.
- Only after a complete subject batch passes: independently audit active-school text overlaps and media links; record reviewer approval and set all original candidate ledger release flags for the **exact approved IDs** with a guarded transaction. Never bulk-approve all 7,442.
- Then run live paid/free Class 11/12 Advanced Mock E2E against the first released subject, including 60 answers, resume, score, print, cross-user rejection, and original Standard Mock regression. Ensure real student histories and subscriptions are not changed.

## Safety boundary
- `public.questions` unchanged (no inserts, updates, activation, deletion).
- `public.advanced_mock_papers`, `public.advanced_mock_answers` unchanged.
- Student profiles, free_usage, memberships, subscriptions, coupons, and Standard Mock records untouched.
- 1,664 unresolved legacy candidates were **not deleted**.
- Stage 2 is live on Vercel with the academic gate **closed** until actual review approval.
