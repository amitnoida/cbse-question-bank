# Agent 1 — consolidated first-pass outcome and production reconciliation
**Date:** 2026-10-28 (IST)  
**Scope:** Class 11 Physics (subject 19) and Class 11 Biology (subject 16) ONLY  
**Supabase project:** `darfsuqfmmunxqiyqlvn`  
**GitHub branch:** `agent1-advanced-review-class11-20261028`

## Critical distinction between screening and substantive review

**First-pass disposition exists for all 1,667 stage-2 candidates, including the 60 Physics questions already released before this Agent 1 review register began.** The Agent 1 register has 1,607 per-question entries; the older 60 are covered by pre-existing individually verified review records. Of the 1,607 Agent 1 records, **114 have an individual academic first-pass content/options/answer/explanation decision** (16 ACCEPTED and 98 REJECTED). The other **1,493 are automated first-pass HOLD/SKIP records**, with `independently_checked=FALSE`. No one should treat those 1,493 as independently academically verified.

A request to finish 1,549 remaining candidates was received after a preceding snapshot of 58 individual reviews and 8 newly released MCQs. By the time live production was re-queried, another contemporaneous write had already added 27 individually checked decisions (7 new acceptances and 20 rejections) and 1,522 automated first-pass HOLD records. During this session, 29 of those 1,522 HOLD candidates were independently examined and reclassified as REJECTED. Current remaining not individually checked: 1,493. Those candidates remain excluded from the student mock pool; they satisfy a *skip/hold first-pass disposition*, NOT full individual academic verification.

### Production snapshot

| Subject | Stage 2 candidates | Runtime-released | Accepted after individual review in Agent 1 register | Individually rejected | Automated HOLD |
|---|---:|---:|---:|---:|---:|
| Class 11 Physics / 19 | 1,569 | 75 | 15 | 94 | 1,400 |
| Class 11 Biology / 16 | 98 | 0 | 1 | 4 | 93 |
| **Total** | **1,667** | **75** | **16** | **98** | **1,493** |

The 60 older Physics releases are verified separately in `cbse_import.advanced_mock_release_review_20261028` and are not part of the 1,607 Agent 1 entries. In the interim after the earlier 68-live snapshot, Physics rose to 75 live. This session itself released no additional MCQs; it completed 29 additional individual negative assessments. **Do not attribute any concurrent 7 additional releases to this session.**

### 1,493 automated SKIP/HOLD classifications (no individual verification)

| Subject | Automated reason | Count |
|---|---|---:|
| Physics | Repeated problem template | 719 |
| Physics | Inadequate explanation / elementary formula | 494 |
| Physics | Competitive branding | 97 |
| Physics | Missing or blocked required media | 89 |
| Physics | Flagged duplicate | 1 |
| Biology | All 98 candidates from one chapter, insufficient chapter coverage | 92 |
| Biology | Missing media | 1 |
| **Total** | | **1,493** |

The Biology pool maps only to *Body Fluids and Circulation* (chapter 349), and is not suitable as a balanced full-subject mock. Class 11 Physics released questions span all 14 CBSE XI Physics chapters with counts between 4 and 10 per chapter. Official curriculum: https://cbseacademic.nic.in/curriculum_2027.html ; Physics chapter list: https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Physics_SecP2_2026-27.pdf .

### Safety verification

Production read-only reconciliation confirmed:
- 75 released source IDs have all the runtime release flags and `reviewed_at` set.
- Zero released questions in the wrong class or subject/chapter.
- Zero released source records active in `public.questions`; required media-ready state preserved.
- Zero released records with media-block/answer/duplicate flags.
- Zero released questions with JEE Main, JEE Advanced or NEET question-text branding.
- Zero held or rejected Agent 1 records released.
- Zero repeated normalized numeric-template stems among the 75 released questions.
- The protected 29-record update did not change either subject's live count.
- No browser, end-to-end testing, UI modifications, other subjects or student records were touched.

## Complete per-ID audit

**Final authoritative CSV:** `academic-reviews/agent1-final-1607-dispositions-20261028.csv`  
Columns include source question ID, assigned subject/chapter IDs, exact review status, whether independent content checking actually occurred, release flag, rationale, staging content status and timestamp.

The database source of truth is `cbse_import.advanced_mock_agent1_review_20261028`, with read-only reconciliation against `cbse_import.advanced_mock_stage2_candidates_20261028`.

## Read-only SQL for subsequent final controller

```sql
SELECT r.destination_subject_id,r.review_status,r.independently_checked,count(*)
FROM cbse_import.advanced_mock_agent1_review_20261028 r
GROUP BY 1,2,3 ORDER BY 1,2,3;

SELECT c.destination_subject_id,
       count(*) FILTER(WHERE c.release_approved) AS released,
       count(*) FILTER(WHERE c.release_approved AND c.academic_verified AND
            c.answer_verified AND c.duplicate_cleared AND c.media_verified AND
            c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD' AND
            q.is_active=FALSE AND q.media_ready=TRUE) AS runtime_live
FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
JOIN public.questions q ON q.id=c.source_question_id
WHERE c.destination_subject_id IN (16,19)
GROUP BY 1 ORDER BY 1;
```

**Controller decision:** Agent 1's *screening disposition* is complete; every source has been assigned accepted/rejected/hold status or was among the preceding 60 individually released. The 1,493 automated holds **do not represent finished substantive academic verification** and must not be activated. Keep the live pool at its documented 75 Physics / 0 Biology unless exact individual academic verification yields additional qualified candidates. Leave end-to-end testing deferred until all agents finish.
