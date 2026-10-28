# Agent 3 — Advanced Mock final review disposition (2026-10-28)

**Production:** Supabase `darfsuqfmmunxqiyqlvn`; GitHub `amitnoida/cbse-question-bank`.
**Strict assignment:** Class 11 Mathematics (subject 18); Class 12 Mathematics (subject 22); Class 12 Physics (subject 23). No other subject touched.
**Reference curriculum:** CBSE 2026–27 Mathematics 041 and Physics 042; official PDF URLs:
- https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Maths_SecP2_2026-27.pdf
- https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Physics_SecP2_2026-27.pdf

## Authoritative production counts after final duplicate correction

| Subject ID | Staged | Individually first-pass examined | Earlier individually verified | Automated numeric-template rejections (NOT answer-verified) | Individually rejected | Held | Live released | Unaccounted |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 18 | 652 | 109 | 1 | 542 | 77 | 19 | 14 | 0 |
| 22 | 495 | 92 | 2 | 401 | 51 | 25 | 18 | 0 |
| 23 | 1125 | 236 | 1 | 888 | 159 | 54 | 24 | 0 |
| **Total** | **2272** | **437** | **4** | **1831** | **287** | **98** | **56** | **0** |

Of 437 individual first-pass assessments, 52 final `ACCEPT` decisions remain released, 287 are `REJECT`, and 98 are `HOLD`. Four previously individually verified items were released. Total live 56. Numeric-template rejections are automatic first-pass **exclusions based on near-identical question structure**, not individual answer/explanation verification; their `academically_examined_this_round` flag is FALSE.

### Review evidence

Authoritative question-level evidence is stored **privately** in `cbse_import.advanced_mock_agent3_review_20261028`:
- `source_question_id`, `destination_subject_id`, `destination_chapter_id`, `review_outcome`, `review_basis`, `academically_examined_this_round`, `reviewer_type`, `reviewed_at`, `release_approved`.
- Values of `review_outcome`: `ACCEPT`, `PREVIOUS_VERIFIED`, `REJECT`, `HOLD`.
- Released runtime is `cbse_import.advanced_mock_stage2_candidates_20261028`. Original `public.questions` records stay inactive.
- No authenticated student, history, payment, coupon, subscription, or Practice/Standard Mock rows were modified.

### Controlled releases and rollback of repeated released templates

A guarded 13-question release and a guarded 1-question release occurred in this review. Final duplicate-family analysis identified **10 new releases** that repeated already released older MCQs in the same destination subject and chapter. Those later 10 releases were transactionally withdrawn and their review outcomes changed to `REJECT` with older-reference IDs, preserving their independent assessment notes. Withdrawn IDs and earlier preserved IDs:

| Withdrawn new ID | Preserved earlier live ID |
|---:|---:|
| 27089 | 27115 |
| 27090 | 27108 |
| 27150 | 27166 |
| 26873 | 26872 |
| 27515 | 27568 |
| 33566 | 33571 |
| 33570 | 33569 |
| 28754 | 28761 |
| 33690 | 33683 |
| 33728 | 33761 |

Final live templates have **zero collisions** within the same subject/chapter using digits-normalized text. The exact database register stores both the accepted/rejected question IDs and decision evidence. The companion read-only SQL file reproduces final checks.

## Limitations and next phase

This completes first-pass **disposition of every assigned candidate**; it does NOT certify that 2,272 answers were independently verified. The 1,831 numerical-template variants were excluded for repetition without answer review, and 98 are HOLD rather than released. None of the three subjects reaches 60 live questions (14,18,24 respectively). Chapter coverage is incomplete. More distinct high-quality questions are required before these subjects can offer full 60-question Advanced Mocks. No browser or end-to-end testing was run; by user request, testing is deferred until all agents finish.

**Final post-write safety checks:** zero unaccounted candidates; zero live blocked, mis-mapped or active source questions; zero released numerical-template duplicates. All writes were confined to subject IDs 18,22,23 and the private Agent 3 register.
