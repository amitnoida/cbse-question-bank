# Final four-agent release and production E2E consolidation

**Date:** 28 October 2026 (Asia/Kolkata)  
**Production:** https://cbse-question-bank.vercel.app  
**Supabase:** `darfsuqfmmunxqiyqlvn`  
**Review scope:** CBSE Classes 11–12 school Advanced Mock MCQs. Competitions are excluded from the student experience.  
**Dedicated test users:** 10 Classes 8–12 free/paid student accounts and two administrator test accounts.  
**Owner cadence:** One consolidated post-release end-to-end regression, not one per academic batch.

## A. Current production release snapshot (post-test refresh)

| Class | Subject | Live Advanced MCQs | 60-question test ready? |
|---|---|---:|---|
| 11 | Biology | 0 | NO |
| 11 | Chemistry | 38 | NO |
| 11 | Mathematics | 17 | NO |
| 11 | Physics | 75 | YES |
| 12 | Biology | 110 | YES |
| 12 | Chemistry | 99 | YES |
| 12 | Mathematics | 20 | NO |
| 12 | Physics | 28 | NO |
| **Total** | | **387** | **3 of 8 ready** |

All **7,442** Stage 2 candidates remain accounted for in the release staging system; **387 released** and **7,055 not released** (a mixture of individual pending checks, grouped triage, holds, skips and questions not suitable for Advanced Mock).

**Concurrent release note:** At the start of testing there were **374 released**. During final reconciliation another agent's releases increased Class 11 Maths by 4, Class 12 Maths by 3, and Class 12 Physics by 6, giving **387 live**. All 13 new items are in underfilled subjects that remain below 60. Recheck counts before any future product decisions; these are live snapshots, not immutable totals.

## B. Read-only database safety — PASS on all 387

| SQL safety rule | Violations |
|---|---:|
| Original `public.questions.is_active=true` for an Advanced release | **0** |
| Missing academic, answer, media or duplicate-clearing eligibility, or blocked/rejected release | **0** |
| JEE/NEET/IIT terms in any released question stem | **0** |
| Identical normalized stem hashes within each Advanced subject | **0** |
| Missing A/B/C/D option, invalid correct-option value or empty explanation | **0** |

All **6 stored Advanced Mock papers** present after regression were **COMPLETED** and held **exactly 60 questions each**. An earlier read-only paper integrity check found 0 within-paper duplicates and 0 cross-subject or unreleased assignment records. The runtime stored-procedure code was also inspected and implements paid access, 60-question threshold, 60 unique selections, unseen-first preference, student ownership, answer persistence and answer-release gating until completion.

These checks do **not** constitute human teacher certification of all academic questions.

## C. One consolidated live browser test campaign

**Main GitHub Actions run:** https://github.com/amitnoida/cbse-question-bank/actions/runs/40699779317  
**Targeted one-case validation:** https://github.com/amitnoida/cbse-question-bank/actions/runs/40700793701

| Group | Initial passed | Initial failed | Skipped | Follow-up result |
|---|---:|---:|---:|---|
| Advanced Mock readiness/free gates/3 full paid papers | **12** | 0 | 0 | No retry necessary |
| Full Admin/Viewer, API role restrictions, reporting, SEO, registration | **30** | 0 | 0 | No retry necessary |
| School students, 12-account login, practice and Standard Mock | **27** | 1 | **5** | Failed Class 9 retake test selector fixed; targeted retest **1 passed** |
| **Distinct final test scenarios** | **70 passed after retry** | **0 unresolved** | **5** | Original main workflow remains red due to the historical failed test; targeted follow-up workflow is green |

### Advanced Mock successes
- Class 11 Physics, Class 12 Chemistry, Class 12 Biology each ran a **complete paid 60-question paper**.
- Confirmed 60-item navigator, withheld correct answer before submission, answer save/reload/resume, all 60 answers, completed grading, saved paper history, reopen previous result, and **Print / Save results as PDF** action. This validates the browser print action; it is **not** a separate generated PDF file-download test.
- Checked the 5 underfilled subjects display a review/60-item threshold warning and disable Start; Class 11 Biology 0, Class 11 Chemistry 38, Class 11 Maths 17, Class 12 Maths 20, Class 12 Physics 28.
- Free accounts cannot initiate any ready Advanced Mock; Classes 8–10 cannot access Class 11/12 feature; anonymous users are blocked.

### Admin, public site and existing school functionality
- Admin/SEO group: **30/30 passed**, including admin full/viewer controls, report access/API restrictions, audit paginated data/CSV export, school SEO pages, homepage, sitemap, registration.
- Student group: **27 passed**, including the 12-account login checks, class navigation/membership checks and paid Standard Mock submissions on Classes 8, 10, 11, 12.
- **5 tests skipped:** the Class 9 free-practice scenario and four other class-free practice scenarios encountered already-exhausted 10-question quotas. Their limits/guard behavior was observed but they cannot be counted as completed practice-answer submissions. Creating new test accounts/consuming more free allowances was not necessary for this release regression.

### One original failure and its resolution — no product fix needed
The older Class 9 paid Standard Mock test selected a subject with **11 completed numbered papers**. The live application correctly displayed **Start Randomized Retake**. However, the old Playwright test selector matched only `Start Next Mock Test`, `Resume Mock Test`, `Start Mock Test`, or `Retake Mock`. It did not match `Start Randomized Retake`; the first run therefore failed after a 30-second locator timeout.

- Source inspected: `app/app/page.tsx` intentionally presents `Start Randomized Retake N →` after all numbered papers are completed.
- Database confirmed that the Class 9 paid Mathematics test subject had 11 completed numbered papers and a sufficient active/mock/shared source pool.
- **Fix made only to the test selector** in `e2e/full-journeys.spec.cjs` on this GitHub testing branch; **no production app code or database change** for this issue.
- A one-case GitHub Actions follow-up **passed** (10.2 seconds total) and generated one completed randomized retake in the authorized test account.

The first attempted follow-up workflow commit had a YAML scalar quoting mistake and created a GitHub run with **zero test jobs**, so it is not counted as a test. The corrected follow-up workflow ran and passed.

## D. Four parallel academic review handoff

- **Agent 1:** Class 11 Physics and Biology. User reported all **1,607 source IDs** given first-pass dispositions; **75 live Physics**, **1,522** held and not individually academically approved. Detailed per-ID CSV and release audits reside on the dedicated Agent 1 branch.
- **Agent 2:** Class 11/12 Chemistry. User reported assigned review queue complete, exact-ID release manifest and private evidence in Supabase. Current live **38 Class 11 Chemistry / 99 Class 12 Chemistry**; Class 11 Redox Reactions has no approved Advanced MCQs; Class 12 covers all ten chapters.
- **Agent 3:** Class 11/12 Maths and Class 12 Physics. User reported initial **96 newly reviewed**, then a final first-pass pool triage and an additional **27** independently assessed releases. During the final test, a further **13** accepted IDs were released in Agent 3 subjects. Current live numbers are in the table above. **Detailed individual academic review remains incomplete.**
- **Agent 4:** Class 12 Biology. **1,462 total candidates**, **273 individually AI-assisted assessed**, **110 accepted/live**, **163 individually assessed but skipped**, and **1,189 additional grouped-triaged** (not individually academically certified). All 13 Biology chapters covered. Separate Agent 4 report: https://github.com/amitnoida/cbse-question-bank/blob/advanced-mock-agent4-biology-20261028/stage2-advanced-mock/agent4-biology-final-firstpass-handoff-20261028.md

## E. Decision and outstanding items

**Ready for use / verified as working:** Class 11 Physics, Class 12 Chemistry and Class 12 Biology. Their approved pools can generate full paid Advanced Mock 60-question papers.

**Not ready for 60-question Advanced Mock:** Class 11 Biology (needs 60), Class 11 Chemistry (needs 22, plus Redox chapter coverage), Class 11 Mathematics (needs 43), Class 12 Physics (needs 32), Class 12 Mathematics (needs 40). **197 additional distinct approved questions overall** are needed across these five subjects before all have a 60-question pool, with subject/chapter quality constraints in addition to raw quantity.

Do **not** reactivate skipped or structurally screened-but-unverified MCQs solely to inflate totals. Continue first-pass academic checking or source new verified questions for these five underfilled subjects. Other agents' grouped triages are NOT independent answer verification, and the exercise was not a blanket academic certification of all 7,442 candidates.

### Test artifacts
- Main combined run: [GitHub Actions report and three uploaded Playwright archives](https://github.com/amitnoida/cbse-question-bank/actions/runs/40699779317).
- Targeted follow-up: [Class 9 randomized retake corrected selector — PASSED](https://github.com/amitnoida/cbse-question-bank/actions/runs/40700793701).
- Executed test definitions: `e2e/final-four-agent-advanced.spec.cjs`, `e2e/full-journeys.spec.cjs` (test-only selector revision) and `.github/workflows/final-four-agent-production-e2e.yml`.
- The testing branch is intentionally separate from production `main`. It contains **test scripts/workflows/reports only**, and no new main-site deployment is required for these tests.
