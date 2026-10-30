# Class 12 Chemistry — First Advanced Mock Release and Live E2E
**Date:** 28 October 2026 (IST)
**Supabase project:** `darfsuqfmmunxqiyqlvn`
**GitHub branch:** `advanced-mock-academic-review-20261028`
**E2E run:** https://github.com/amitnoida/cbse-question-bank/actions/runs/40681826716
**Official CBSE Chemistry 2026–27 syllabus:** https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Chemistry_SecP2_2026-27.pdf

## Release outcome
- **Released exactly 60** CBSE Class 12 Chemistry questions from the private Advanced Mock candidate ledger to the `advanced_mock_*` runtime.
- **10 chemistry units**, six questions per chapter: Solutions, Electrochemistry, Chemical Kinetics, d/f-Block Elements, Coordination Compounds, Haloalkanes/Haloarenes, Alcohols/Phenols/Ethers, Aldehydes/Ketones/Carboxylic Acids, Amines, Biomolecules.
- The 60 stems, four options, designated answers and explanations were **AI-assisted reviewed item by item**, with explicit independently recalculated numerical results and checked conceptual true/false statement combinations (SQL file `08-class12-chemistry-60-answer-checks.sql`). Review provenance is labelled AI-assisted, not certified independent teacher verification.
- Exactly **60 candidate flags** released by a guarded transaction (`09-class12-chemistry-release-exact-60.sql`). It checks source inactivity, 10-chapter coverage, mapped destinations, media, duplicate and answer constraints, and reverts atomically unless 60 rows change.
- `public.questions` source questions **remain inactive**. None of the seven other Class 11/12 Advanced subject pools has been released. Standard Mock and Practice content not modified.

## Browser E2E result — PASSED
GitHub run **40681826716**, production host `https://cbse-question-bank.vercel.app`.
- **2 passed, 0 failed.** Existing `E2E_ACCOUNTS_JSON` secret reused; 12 configured credentials validated, but **only two Class 12 accounts** were used for this targeted test.
- Free test account: confirmed **cannot start** Class 12 Chemistry Advanced Mock.
- Paid test account: **start** paper with 60 questions → save first answer → page reload → **resume** → check answer persistence → answer all 60 → submit → access correct-answer/explanation review and Print/Save PDF button.
- Database result: **one COMPLETED Advanced Mock paper, 60 saved answers, 18/60 correct (30%)** from deliberately selected automated options. This is test data only.
- No other Advanced Mock paper started and no historical standard mock, student, school question, coupon or subscription records deliberately changed.

## Post-release verification
| Check | Value |
|---|---:|
| Total academic review queue | 480 |
| Queue marked individually reviewed | 67 (60 Chemistry + 7 other previously reviewed) |
| Class 12 Chemistry released | 60 |
| Other Advanced subject releases | 0 |
| Active source question overlap | 0 |
| Chemistry chapters covered | 10 |
| Chemistry Advanced completed papers | 1 |
| Chemistry Advanced in-progress papers | 0 |
| Chemistry Advanced answer rows | 60 |

## Quality debt / next batches
- First Chemistry paper is balanced across all ten topics and no complete-question exact duplicate exists against active school records. However, **42/60** are statement-combination items; they reuse some underlying chemistry facts. Improve conceptual variety in future expansion, rather than falsely claiming all 60 have unique underlying facts.
- With **only 60 released in Chemistry**, a randomized retake necessarily reuses the same questions in a different arrangement. More independently reviewed items are needed for substantive retake variety.
- The other 420 review slots remain queued: Class 11 Biology **60 chapter-coverage holds**; Class 12 Mathematics **13 numerical-template repeats**, with pending checks for the rest. Class 11/12 other subjects require their own exact-ID verified release.
- Browser end-to-end passing does not certify full expert peer review; optional external subject-matter review is advisable before broad marketing.
- Keep `stage2-advanced-mock/05-private-480-review-queue.sql` as the private review queue migration and `06`/`08`/`09` as exact executed audit SQL. Do **not** re-run `09` without an explicit idempotency plan.
