-- Stage 2 / phase A: isolated candidate ledger for Class 11/12 Advanced Mock Tests
-- Date: 2026-10-28 / production Supabase darfsuqfmmunxqiyqlvn
-- Compatible with the separate approved evening retirement of the 1,664 UNMAPPED IDs.
-- No inserts/updates/deletes against public.questions, public.mock_papers,
-- student records, subscriptions, results or existing standard mock allocators.
-- This stages ONLY the 7,442 mapped source IDs; all remain inactive and unapproved.
-- Not a student-facing feature. The eventual Advanced Mock allocator must use a
-- separate pool and paper category, not the current standard mock RPC.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

DO $preflight$
DECLARE
  n_mapped bigint;
  n_invalid bigint;
BEGIN
  SELECT count(*) INTO n_mapped
  FROM cbse_import.advanced_mock_mapping_20261028
  WHERE proposed_chapter_id IS NOT NULL;
  IF n_mapped <> 7442 THEN
    RAISE EXCEPTION 'Stage 2 preflight abort: expected 7442 mapped sources, found %', n_mapped;
  END IF;

  SELECT count(*) INTO n_invalid
  FROM cbse_import.advanced_mock_mapping_20261028 m
  LEFT JOIN cbse_import.advanced_mock_stage1_audit_20261028 a
    ON a.source_question_id=m.source_question_id
  LEFT JOIN public.questions q ON q.id=m.source_question_id
  LEFT JOIN public.chapters ch ON ch.id=m.proposed_chapter_id
  LEFT JOIN public.subjects s ON s.id=ch.subject_id
  LEFT JOIN public.classes cl ON cl.id=s.class_id
  WHERE m.proposed_chapter_id IS NOT NULL
    AND (a.source_question_id IS NULL
         OR a.proposed_chapter_id IS DISTINCT FROM m.proposed_chapter_id
         OR q.id IS NULL
         OR q.is_active IS DISTINCT FROM FALSE
         OR ch.is_active IS DISTINCT FROM TRUE
         OR s.is_active IS DISTINCT FROM TRUE
         OR cl.class_name NOT IN ('Class 11','Class 12')
         OR lower(btrim(s.subject_name)) IS DISTINCT FROM lower(btrim(m.source_subject)));
  IF n_invalid <> 0 THEN
    RAISE EXCEPTION 'Stage 2 preflight abort: % mapped rows violate school eligibility or inactive-source invariant',n_invalid;
  END IF;
END
$preflight$;

-- Separate review-only schema inventory with full provenance.
-- No automatic promotion from Stage 1 disposition to academic approval.
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_stage2_candidates_20261028 (
  source_question_id bigint PRIMARY KEY REFERENCES public.questions(id) ON DELETE RESTRICT,
  source_exam text NOT NULL,
  source_subject text NOT NULL,
  source_chapter text NOT NULL,
  original_chapter_id bigint NOT NULL,
  destination_chapter_id bigint NOT NULL REFERENCES public.chapters(id) ON DELETE RESTRICT,
  destination_subject_id bigint NOT NULL REFERENCES public.subjects(id) ON DELETE RESTRICT,
  destination_class_id bigint NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  mapping_review_status text NOT NULL,
  audit_disposition text NOT NULL,
  source_content_review_status text NOT NULL,
  source_media_ready boolean NOT NULL,
  duplicate_candidate boolean NOT NULL DEFAULT FALSE,
  media_blocked boolean NOT NULL DEFAULT FALSE,
  answer_issue boolean NOT NULL DEFAULT FALSE,
  academic_verified boolean NOT NULL DEFAULT FALSE,
  answer_verified boolean NOT NULL DEFAULT FALSE,
  duplicate_cleared boolean NOT NULL DEFAULT FALSE,
  media_verified boolean NOT NULL DEFAULT FALSE,
  release_approved boolean NOT NULL DEFAULT FALSE,
  reviewer_note text,
  reviewed_at timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT advanced_stage2_signed_release
    CHECK (NOT release_approved OR (
      academic_verified AND answer_verified AND duplicate_cleared
      AND media_verified AND reviewed_at IS NOT NULL
    ))
);

-- Treat stage-2 release decisions as internal only; do not expose to learners.
ALTER TABLE cbse_import.advanced_mock_stage2_candidates_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cbse_import.advanced_mock_stage2_candidates_20261028 FROM PUBLIC, anon, authenticated;

INSERT INTO cbse_import.advanced_mock_stage2_candidates_20261028
 (source_question_id,source_exam,source_subject,source_chapter,
  original_chapter_id,destination_chapter_id,destination_subject_id,destination_class_id,
  mapping_review_status,audit_disposition,source_content_review_status,
  source_media_ready,duplicate_candidate,media_blocked,answer_issue)
SELECT
 m.source_question_id,m.source_exam,m.source_subject,m.source_chapter,
 q.chapter_id,m.proposed_chapter_id,s.id,s.class_id,
 m.review_status,a.disposition,q.content_review_status,
 q.media_ready,a.duplicate_candidate,a.media_blocked,a.answer_issue
FROM cbse_import.advanced_mock_mapping_20261028 m
JOIN cbse_import.advanced_mock_stage1_audit_20261028 a USING (source_question_id)
JOIN public.questions q ON q.id=m.source_question_id
JOIN public.chapters ch ON ch.id=m.proposed_chapter_id
JOIN public.subjects s ON s.id=ch.subject_id
JOIN public.classes cl ON cl.id=s.class_id
WHERE m.proposed_chapter_id IS NOT NULL
  AND q.is_active IS FALSE
  AND cl.class_name IN ('Class 11','Class 12')
ON CONFLICT (source_question_id) DO NOTHING;

-- Exact row count + disabled-release gate. This is intentionally never an activation.
DO $postflight$
DECLARE
  n_candidates bigint; n_approved bigint; n_unmapped bigint;
BEGIN
  SELECT count(*),count(*) FILTER (WHERE release_approved)
  INTO n_candidates,n_approved
  FROM cbse_import.advanced_mock_stage2_candidates_20261028;
  SELECT count(*) INTO n_unmapped
  FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
  JOIN cbse_import.advanced_mock_mapping_20261028 m
    ON m.source_question_id=c.source_question_id
  WHERE m.proposed_chapter_id IS NULL;
  IF n_candidates<>7442 OR n_approved<>0 OR n_unmapped<>0 THEN
    RAISE EXCEPTION 'Stage 2 gate abort: candidate count %, approved %, unmapped in ledger %',
      n_candidates,n_approved,n_unmapped;
  END IF;
END
$postflight$;

COMMIT;

-- Separate post-commit read-only summary, unaffected by 1,664-source retirement:
SELECT cl.class_name, s.subject_name,
       count(*) AS staged,
       count(*) FILTER (WHERE c.release_approved) AS release_approved,
       count(*) FILTER (WHERE c.media_blocked OR NOT c.source_media_ready) AS media_attention,
       count(*) FILTER (WHERE c.duplicate_candidate) AS duplicate_attention
FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
JOIN public.classes cl ON cl.id=c.destination_class_id
JOIN public.subjects s ON s.id=c.destination_subject_id
GROUP BY cl.class_name,s.subject_name ORDER BY 1,2;
