# Stage 1 — Academic eligibility, duplicate and media gate (28 October 2026)

Scope: Supabase production `darfsuqfmmunxqiyqlvn`, **read-only inspection only**, 9,106 inactive JEE Advanced/NEET source questions. All 6,362 structurally mapped rows remain provisional; 2,744 have no chapter ID. Nothing was activated, deleted, or moved.

## Question-level eligibility — conservative assessment

- Academic APPROVED: **0 / 9,106**. School-level eligibility cannot be established from competitive-source metadata or chapter-title matching alone.
- Current `content_review_status`: **8,682 PENDING_REVIEW**, **424 HOLD**, **0 approved**.
- Existing audit dispositions: **6,055 MAPPED_READY_FOR_REVIEW** (means structural candidate only, NOT approved); **2,703 NEEDS_ACADEMIC_REVIEW**; **321 MEDIA_BLOCKED**; **27 DUPLICATE_CANDIDATE**. Separately the audit flag `duplicate_candidate` is true for **44** rows, including **17** counted in another disposition.
- Questions with null/blank stem, null/blank option, or key not A/B/C/D: **0** on SQL shape checks. This does not validate correctness, explanations, or difficulty.
- `public.questions.is_active`: **0** of 9,106. Do not override.

**Eligibility output for all 9,106:** NOT RELEASE APPROVED. Future per-question clearance must establish concept-by-concept CBSE 2026-27 coverage, correct key and explanation, class/subject/chapter placement, uniqueness and media readiness. Proposed chapter IDs must not be treated as academic signoff.

## Chapter mapping

- Structural matches **6,362**: all destination chapters belong to active Class 11/12 subjects, with **zero subject mismatches, invalid grades or inactive destinations**.
- Missing mapping **2,744**: **2,683 UNMAPPED** and **61 AMBIGUOUS_TITLE_MATCH**, across **43** source-exam/subject/topic groups. See `07-unresolved-chapter-triage.md` for all groups, counts and candidate school chapter IDs. No broad topic is automatically assigned to a single Class XI/XII chapter.
- Chemistry legacy, formative/practical, cross-grade and combined-source categories need syllabus-specific question-level inspection; absence of a standalone chapter does not prove a question is out of scope.

## Duplicate audit

- Existing preliminary/semantic candidate flag: **44** (includes four confirmed cross-bank exact-stem overlaps; the other flags are candidates).
- Strict case/whitespace-normalized question-text matches *within the 9,106 source questions*: **0 exact duplicate groups**.
- Confirmed source rows with exact normalized stems matching **active school questions: 4** — source IDs **26401, 26402, 26403, 32830** match active question IDs **3967, 3970, 3968, 2213**, respectively. Four staging-only audit flags were changed to true; one disposition changed from mapped-ready to duplicate-candidate. No source or school question row was modified.
- Number-normalized stem template screening found **651 repeated template families spanning 5,576 source questions** (4,925 repetitions after the first; largest family 31). These can be legitimate numerical variants, not necessarily duplicates, but they warrant diversity controls in Advanced Mock allocation.
- More sophisticated semantic/near-duplicate verification is **not complete**. Do not treat the remaining candidates as automatically rejectable or the zero within-set exact matches as proof of uniqueness.

## Media audit

- Media blocked: **321** rows; **147 Markdown `assets/...` references**, **174 HTML `<img src="assets/...">` references**.
- All **321** currently have `media_ready=false`; source `question_media` JSON is empty on all 9,106 questions.
- The reviewed Stage 1 branch has no `public/assets` directory. It contains `public/question-images` with unrelated school image subdirectories. Missing folder discovery alone does not prove a Storage object is absent; **actual retrieval/render verification has not been established**.
- Keep media-dependent source questions blocked pending valid asset migration, stable URLs, and visual QA.

## Official academic reference

CBSE 2026–27 senior-secondary curriculum index: https://cbseacademic.nic.in/curriculum_2027.html . Verify concept/grade in the relevant official PDF before academic approval. Curriculum topic names alone cannot validate the 9,106 answers. Some legacy Chemistry topics have nuanced formative treatment; do not blanket-label them deleted.

## Limitations and no-go

Read-only simple counts, scoped aggregates and most inventory/dependency queries succeeded. An initial unoptimized pairwise normalized text-match query timed out (`57014: canceling statement due to statement timeout`); a later **scoped materialized fingerprint grouping succeeded** and resolved all four cross-bank exact matches. Do not retry the unrestricted self-join. Prior conversation's safety-check block did **not** recur on the first COUNT query. This is an audit checkpoint, **not a claim of complete academic signoff** or authorization for Stage 2.
