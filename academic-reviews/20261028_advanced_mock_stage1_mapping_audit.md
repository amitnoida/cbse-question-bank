# Advanced Mock Test migration — Stage 1 mapping and readiness audit (28 October 2026)

## Scope and safeguards
Source: inactive JEE Advanced and NEET questions in production Supabase `darfsuqfmmunxqiyqlvn`. Target candidates: Class 11/12 Physics, Chemistry, Mathematics, Biology, using existing school chapters. JEE Main was previously deleted. No source questions were moved, activated, renamed or deleted during this Stage 1 work. Existing active school questions and student records were not modified. No UI code was changed.

## Staging inventory
Table: `cbse_import.advanced_mock_mapping_20261028`. One row per source question (9,106 rows), fields source_question_id, source_exam, source_subject, source_chapter, proposed_chapter_id, match_status, review_status.

- `TITLE_MATCH_NEEDS_REVIEW`: 4,228 candidate records with normalized chapter title equality.
- `RULE_MATCH_NEEDS_REVIEW`: 2,134 candidate records matched by reviewed title-to-school-chapter routing rules; these mappings still require item-level verification.
- `CHAPTER_MAPPING_REQUIRED`: 2,744 records. Some chapters span multiple school chapters or represent out-of-scope topics; do not guess a destination.
- None is academically approved for student release.

## Structural readiness (not academic approval)
- Title candidates: 4,007 media-ready, 3,545 meet basic MCQ/answer/explanation-length/media conditions.
- Rule candidates: 2,075 media-ready, 1,755 pass basic mechanical checks.
- Unmapped: 2,703 media-ready, 2,434 pass basic mechanical checks.
- Basic check = question_type MCQ, answer A-D, explanation >=30 chars, media_ready true. It does not establish content quality or distinctness.

## Stage 2 gating
1. Resolve 2,744 unassigned chapter cases at question level.
2. Verify scope against current CBSE syllabus, correct unique answers, explanations, and duplicates.
3. Check each question's media and suitability for single-correct advanced mock test format.
4. Promote only approved questions into Class 11/12 chapters, with Advanced Mock Test categorization. Preserve source provenance and student test records.
5. Remove competitive branding and source structures only after successful migration, production testing, and verification.

**No release authorization is granted by this Stage 1 audit.**