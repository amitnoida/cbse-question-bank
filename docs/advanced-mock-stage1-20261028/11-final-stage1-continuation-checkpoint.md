# Stage 1 continuation — final audited checkpoint (28 October 2026)

**Scope:** production Supabase `darfsuqfmmunxqiyqlvn`; 9,106 inactive JEE Advanced/NEET source MCQs; Class XI/XII Physics/Chemistry/Mathematics/Biology destination candidates.

**Disposition:** Stage 1 scoped automated mapping and audit documented; **NOT academically release-ready**. Continue academic item review within Stage 1 before any Stage 2 authorization. Stage 2 **not begun**.

## Resumption and connection

- Simple `SELECT COUNT(*) AS question_count FROM public.questions` succeeded with **28,425**.
- Existing branch `stage1-advanced-mock-audit-20261028` was 6 commits ahead of `main` at handover; original six reports and two `cbse_import` staging tables were preserved.
- Previous conversation's safety block **did not recur** on the COUNT query. One unrestricted normalized-stem join hit PostgreSQL statement timeout `57014`; a more efficient fingerprint grouping succeeded.

## Updated database staging counts

| Metric | Handover checkpoint | After scoped Stage 1 continuation |
|---|---:|---:|
| Source questions inventoried | 9,106 | **9,106** |
| Structurally proposed destination | 6,362 | **7,442** |
| Unresolved destination | 2,744 | **1,664** |
| Newly proposed from question-text concept rules | — | **1,080** |
| Ambiguous-title unresolved | 61 | **61** |
| Fully unmapped | 2,683 | **1,603** |
| Academic APPROVED to release | 0 | **0** |
| Source active | 0 | **0** |

Destination class/subject grouping: XI — Biology **98**, Chemistry **1,062**, Mathematics **652**, Physics **1,569**. XII — Biology **1,462**, Chemistry **979**, Mathematics **495**, Physics **1,125**. All **7,442** proposed chapters are active school chapters for grade XI/XII, match the source subject, and show **0** structural invariants failing. Mapping/audit chapter-ID mismatches: **0**.

`match_status='UNIQUE_TITLE_MATCH'` is also used for new **question-text rules** due to its pre-existing CHECK constraint; treat `review_status='RULE_MATCH_NEEDS_REVIEW'` and `mapping_note` as the authoritative distinction. Never confuse rule matches with academically verified title matches.

## Final audit dispositions

| Staging audit disposition | Records | Meaning |
|---|---:|---|
| MAPPED_READY_FOR_REVIEW | **7,086** | Structural candidate, academic review still required |
| NEEDS_ACADEMIC_REVIEW | **1,658** | Unassigned/ambiguous or audit review required |
| MEDIA_BLOCKED | **321** | Embedded source image not yet verified |
| DUPLICATE_CANDIDATE | **41** | Primary priority disposition only |
| **Total** | **9,106** | **None approved for activation** |

**44** records have `duplicate_candidate=true` (includes 3 categorized as `NEEDS_ACADEMIC_REVIEW`). Four exact normalized stem matches against **existing active school questions** have been validated and flagged **only in Stage 1 audit rows**: 26401→3967, 26402→3970, 26403→3968, 32830→2213. In-source exact normalized duplicates: **0**. Repeated numerical template families: **651**, spanning **5,576** rows; these are potentially legitimate variants, not confirmed duplicates.

All **321** media-blocked source questions have `media_ready=false`, with 147 Markdown relative image references and 174 HTML image tags. `storage.objects` showed no objects on inspected bucket summary, and the branch's `public/assets` directory was absent; actual fetch/render checks cannot be passed. No question was activated.

Correct-answer key and required MCQ option structural validation found **0 malformed** among the 9,106. `content_review_status` remains **8,682 PENDING_REVIEW**, **424 HOLD**. Mathematical correctness, explanations, official 2026–27 curriculum-level equivalence, image validity and semantic duplicates are **not approved/cleared**.

## Remaining 1,664 unmapped by subject

| Subject | Still without defensible approved single chapter |
|---|---:|
| Chemistry | 955 |
| Biology | 474 |
| Mathematics | 125 |
| Physics | 110 |
| **Total** | **1,664** |

These include cross-chapter Biology, partly legacy or practical Chemistry, and multi-grade mathematics and physics. **Do not force a chapter** to achieve 100% mapping. Review each MCQ concept against official CBSE 2026–27 syllabus and choose a valid class/chapter or mark formally out-of-scope. `07-unresolved-chapter-triage.md` is the **handover baseline** at 2,744, not the updated count; query staging or use `12-final-unresolved-and-gates.sql` for current values.

## Migration dependencies / safety

- No source question in inspected student answer, mock answer, coverage or practice usage reference tables; no paper/session question-id arrays overlapping source IDs.
- No competitive-subject attempt, paper or practice sessions in the inspected tables.
- **6 student profiles** still reference competitive class IDs 6–8 — a category-retirement hard blocker.
- Source school hierarchy still referenced by the 9,106 source `questions.chapter_id`; audit mapping also has FKs.
- Source question active count = **0** after work. No source question chapter/status, active school question, student record, subscription, history, or mainline UI changed.

## GitHub artifacts

Original 01–06 handover reports retained. Added: 07 unresolved-topic triage; 08 academic/duplicate/media gate; 09 read-only per-question classification SQL; 10 dependency checks; this final checkpoint; and 12 final unresolved/gating queries.

## Final gate

Stage 1 **mechanical mapping/audit pass** is complete for this scope, but **academic eligibility clearance and the 1,664 unresolved item-level mappings are still outstanding**. No 100% mapping or academic verification is falsely claimed.

**STAGE 2 NOT AUTHORIZED:** wait until each intended release row has chapter/grade, academic answer and explanation review, duplicate and media QA, and a signed-off per-question release ledger. Preserve all school and student data and histories in future work.

CBSE official 2026–27 academic curriculum: https://cbseacademic.nic.in/curriculum_2027.html .
