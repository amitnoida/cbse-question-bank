-- Advanced Mock academic release: ISOLATED REVIEW QUEUE ONLY.
-- Does NOT activate, approve, delete, or edit ANY source question, student, subscription,
-- standard mock paper, advanced paper, or original Stage 2 candidate ledger flag.
-- CBSE 2026-27 Class XI/XII syllabus must be checked before any VERIFIED status.

BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_release_review_20261028 (
  source_question_id bigint PRIMARY KEY,
  destination_subject_id bigint NOT NULL,
  destination_chapter_id bigint NOT NULL,
  review_slot integer NOT NULL CHECK (review_slot BETWEEN 1 AND 60),
  template_fingerprint text NOT NULL,
  repeat_numeric_template boolean NOT NULL,
  class_name text NOT NULL CHECK (class_name IN ('Class 11','Class 12')),
  subject_name text NOT NULL,
  chapter_name text NOT NULL,
  review_status text NOT NULL CHECK (
    review_status IN ('PENDING_ACADEMIC_REVIEW','NEEDS_CHAPTER_COVERAGE',
    'NEEDS_DIVERSITY_REPLACEMENT','VERIFIED','REJECTED')),
  reviewer_note text NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (destination_subject_id,review_slot),
  CONSTRAINT verified_requires_timestamp CHECK (
    (review_status='VERIFIED') = (verified_at IS NOT NULL))
);
ALTER TABLE cbse_import.advanced_mock_release_review_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cbse_import.advanced_mock_release_review_20261028 FROM PUBLIC,anon,authenticated;
WITH candidate AS (
 SELECT c.source_question_id,c.destination_subject_id,c.destination_chapter_id,
 cl.class_name,s.subject_name,ch.chapter_name,
 q.question_text,q.explanation,
 lower(regexp_replace(regexp_replace(btrim(q.question_text),
 '[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')) AS stem_pattern
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 JOIN public.subjects s ON s.id=c.destination_subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 JOIN public.chapters ch ON ch.id=c.destination_chapter_id
 WHERE c.source_content_review_status <> 'HOLD' AND c.source_media_ready
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND q.media_ready AND q.is_active=FALSE
 AND (q.question_media IS NULL OR q.question_media='{}'::jsonb)
 AND LENGTH(BTRIM(q.explanation))>=25 AND LENGTH(BTRIM(q.question_text))>20
 AND q.correct_option IN ('A','B','C','D')
 AND lower(btrim(q.option_a))<>lower(btrim(q.option_b))
 AND lower(btrim(q.option_a))<>lower(btrim(q.option_c))
 AND lower(btrim(q.option_a))<>lower(btrim(q.option_d))
 AND lower(btrim(q.option_b))<>lower(btrim(q.option_c))
 AND lower(btrim(q.option_b))<>lower(btrim(q.option_d))
 AND lower(btrim(q.option_c))<>lower(btrim(q.option_d))
 AND q.question_text !~* '(https?://|<img|!\[|\[image|see (the )?(diagram|figure))'
), patterned AS (
 SELECT *,
 row_number() OVER(PARTITION BY destination_subject_id,stem_pattern
 ORDER BY length(explanation) DESC,source_question_id) AS template_rank
 FROM candidate
), fair AS (
 SELECT *,
 row_number() OVER(PARTITION BY destination_subject_id,destination_chapter_id
 ORDER BY template_rank,length(explanation) DESC,source_question_id) AS chapter_round
 FROM patterned
), ranked AS (
 SELECT *,
 row_number() OVER(PARTITION BY destination_subject_id
 ORDER BY template_rank,chapter_round,md5(source_question_id::text)) AS review_slot
 FROM fair
)
INSERT INTO cbse_import.advanced_mock_release_review_20261028 (
 source_question_id,destination_subject_id,destination_chapter_id,review_slot,
 template_fingerprint,repeat_numeric_template,class_name,subject_name,chapter_name,
 review_status,reviewer_note)
SELECT source_question_id,destination_subject_id,destination_chapter_id,review_slot,
 md5(stem_pattern),template_rank>1,class_name,subject_name,chapter_name,
 CASE WHEN class_name='Class 11' AND subject_name='Biology'
 THEN 'NEEDS_CHAPTER_COVERAGE'
 WHEN template_rank>1 THEN 'NEEDS_DIVERSITY_REPLACEMENT'
 ELSE 'PENDING_ACADEMIC_REVIEW' END,
 CASE WHEN class_name='Class 11' AND subject_name='Biology'
 THEN 'All 98 source candidates map to Body Fluids and Circulation; this cannot represent complete Class 11 Biology. No academic verification yet.'
 WHEN template_rank>1
 THEN 'Numerically varied repeat of another stem pattern; replace before approving. No academic verification yet.'
 ELSE 'Preliminary structural and media screen only. Verify CBSE 2026-27 syllabus, solution, distractors, duplicates and appropriateness individually.' END
FROM ranked WHERE review_slot<=60
ON CONFLICT (source_question_id) DO NOTHING;

DO $$
DECLARE total integer; pools integer; slots_ok boolean;
BEGIN
 SELECT COUNT(*),COUNT(DISTINCT destination_subject_id) INTO total,pools
 FROM cbse_import.advanced_mock_release_review_20261028;
 SELECT NOT EXISTS(
 SELECT destination_subject_id FROM cbse_import.advanced_mock_release_review_20261028
 GROUP BY destination_subject_id HAVING COUNT(*)<>60
 ) INTO slots_ok;
 IF total<>480 OR pools<>8 OR NOT slots_ok THEN
   RAISE EXCEPTION 'Review batch must have 480 rows in eight complete 60-question pools; got % rows / % pools',total,pools;
 END IF;
 IF EXISTS (SELECT 1 FROM cbse_import.advanced_mock_release_review_20261028 WHERE review_status='VERIFIED') THEN
   RAISE EXCEPTION 'Academic verification must not be auto-set by queue creation';
 END IF;
END $$;
COMMIT;
