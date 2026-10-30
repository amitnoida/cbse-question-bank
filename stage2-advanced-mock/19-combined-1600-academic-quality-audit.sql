-- Two batches, 1,600 unreleased MCQs: machine-readable academic QA evidence.
-- Only private cbse_import audit data; no original question, approval or student changes.
-- Automated answer/explanation consistency is NOT an independent factual or curriculum review.
BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_bulk_academic_audit_20261028(
 source_question_id bigint PRIMARY KEY,
 batch_number integer NOT NULL CHECK(batch_number IN(1,2)),
 class_name text NOT NULL,
 subject_name text NOT NULL,
 destination_subject_id bigint NOT NULL,
 destination_chapter_id bigint NOT NULL,
 question_kind text NOT NULL CHECK (question_kind IN ('FOUR_STATEMENT','TWO_STATEMENT','OTHER')),
 answer_explanation_logic_consistent boolean,
 preliminary_structural_pass boolean NOT NULL,
 source_mapping_needs_review boolean NOT NULL,
 numeric_template_repeated boolean NOT NULL,
 easy_difficulty boolean NOT NULL,
 short_explanation_under_55 boolean NOT NULL,
 coverage_or_template_hold boolean NOT NULL,
 already_ai_individually_reviewed boolean NOT NULL,
 automated_qc_status text NOT NULL CHECK(automated_qc_status IN (
 'PASS_PRELIMINARY_AUTOMATED_SCREEN',
 'NEEDS_ANSWER_EXPLANATION_CORRECTION','NEEDS_ADDITIONAL_QUALITY_REVIEW','EXISTING_HOLD')),
 independent_academic_status text NOT NULL DEFAULT 'PENDING_INDEPENDENT_ACADEMIC_REVIEW'
  CHECK(independent_academic_status IN('PENDING_INDEPENDENT_ACADEMIC_REVIEW','PRIOR_AI_ASSISTED_INDIVIDUAL_CHECK','INDEPENDENTLY_VERIFIED')),
 release_approved boolean NOT NULL DEFAULT false CHECK (release_approved=false),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.advanced_mock_bulk_academic_audit_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.advanced_mock_bulk_academic_audit_20261028 FROM PUBLIC,anon,authenticated;
WITH source AS (
 SELECT 1 AS batch_number,b.source_question_id,b.class_name,b.subject_name,b.destination_subject_id,b.destination_chapter_id,
 b.qa_bucket AS original_bucket,b.previously_verified
 FROM cbse_import.advanced_mock_bulk_review_batch_20261028 b
 UNION ALL
 SELECT 2,b.source_question_id,b.class_name,b.subject_name,b.destination_subject_id,b.destination_chapter_id,
 'PENDING_ACADEMIC',false
 FROM cbse_import.advanced_mock_bulk_review_batch2_20261028 b
), qset AS (
 SELECT s.*, q.question_text,q.explanation,q.correct_option,
 q.option_a,q.option_b,q.option_c,q.option_d,q.difficulty,
 q.is_active,q.media_ready,q.question_media,
 c.release_approved AS stage2_released,c.source_content_review_status,
 c.media_blocked,c.duplicate_candidate,c.answer_issue,c.source_media_ready,
 c.mapping_review_status,
 lower(regexp_replace(regexp_replace(btrim(q.question_text),
 '[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')) AS numeric_template,
 CASE q.correct_option WHEN 'A' THEN q.option_a WHEN 'B' THEN q.option_b
 WHEN 'C' THEN q.option_c WHEN 'D' THEN q.option_d END AS chosen
 FROM source s JOIN public.questions q ON q.id=s.source_question_id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=s.source_question_id
),classified AS (
 SELECT *,
 CASE WHEN question_text LIKE 'Which of the following statements are correct?%'
   THEN 'FOUR_STATEMENT'
 WHEN question_text LIKE 'Read Statements I and II%' THEN 'TWO_STATEMENT'
 ELSE 'OTHER' END kind,
 (explanation ~ '(^|[[:space:]])I is correct[.]') i_true,
 (explanation ~ '(^|[[:space:]])I is incorrect[.]') i_false,
 (explanation ~ '(^|[[:space:]])II is correct[.]') ii_true,
 (explanation ~ '(^|[[:space:]])II is incorrect[.]') ii_false,
 (explanation ~ '(^|[[:space:]])III is correct[.]') iii_true,
 (explanation ~ '(^|[[:space:]])III is incorrect[.]') iii_false,
 (explanation ~ '(^|[[:space:]])IV is correct[.]') iv_true,
 (explanation ~ '(^|[[:space:]])IV is incorrect[.]') iv_false,
 count(*) OVER(PARTITION BY destination_subject_id,numeric_template) AS numeric_template_uses
 FROM qset
),checks AS (
 SELECT *,
 CASE WHEN kind='FOUR_STATEMENT' THEN
  (i_true<>i_false AND ii_true<>ii_false AND iii_true<>iii_false AND iv_true<>iv_false
   AND (chosen ~ '(^|[^IVX])I([^IVX]|$)')=i_true
   AND (chosen ~ '(^|[^IVX])II([^IVX]|$)')=ii_true
   AND (chosen ~ '(^|[^IVX])III([^IVX]|$)')=iii_true
   AND (chosen ~ '(^|[^IVX])IV([^IVX]|$)')=iv_true)
 WHEN kind='TWO_STATEMENT' THEN
  (i_true<>i_false AND ii_true<>ii_false AND
   chosen=CASE WHEN i_true AND ii_true THEN 'Both Statement I and Statement II are correct'
   WHEN i_true AND ii_false THEN 'Statement I is correct; Statement II is incorrect'
   WHEN i_false AND ii_true THEN 'Statement I is incorrect; Statement II is correct'
   WHEN i_false AND ii_false THEN 'Both Statement I and Statement II are incorrect'
   ELSE 'UNKNOWN' END)
 ELSE NULL END logic_consistent,
 (
  NOT is_active AND NOT stage2_released AND media_ready AND source_media_ready
  AND NOT media_blocked AND NOT duplicate_candidate AND NOT answer_issue
  AND source_content_review_status<>'HOLD'
  AND COALESCE(question_media,'{}'::jsonb)='{}'::jsonb
  AND correct_option IN ('A','B','C','D')
  AND length(btrim(explanation))>=25
  AND question_text !~* '\m(jee|neet|iit)\M'
  AND lower(btrim(option_a))<>lower(btrim(option_b))
  AND lower(btrim(option_a))<>lower(btrim(option_c))
  AND lower(btrim(option_a))<>lower(btrim(option_d))
  AND lower(btrim(option_b))<>lower(btrim(option_c))
  AND lower(btrim(option_b))<>lower(btrim(option_d))
  AND lower(btrim(option_c))<>lower(btrim(option_d))
 ) structural_pass
 FROM classified
)
INSERT INTO cbse_import.advanced_mock_bulk_academic_audit_20261028(
 source_question_id,batch_number,class_name,subject_name,destination_subject_id,destination_chapter_id,
 question_kind,answer_explanation_logic_consistent,preliminary_structural_pass,
 source_mapping_needs_review,numeric_template_repeated,easy_difficulty,
 short_explanation_under_55,coverage_or_template_hold,already_ai_individually_reviewed,
 automated_qc_status,independent_academic_status)
SELECT source_question_id,batch_number,class_name,subject_name,destination_subject_id,destination_chapter_id,
 kind,logic_consistent,structural_pass,
 mapping_review_status LIKE '%NEEDS_REVIEW',numeric_template_uses>1,difficulty='Easy',
 length(btrim(explanation))<55,original_bucket IN('HOLD_CHAPTER_COVERAGE','HOLD_NUMERIC_TEMPLATE'),previously_verified,
 CASE
 WHEN original_bucket IN('HOLD_CHAPTER_COVERAGE','HOLD_NUMERIC_TEMPLATE') THEN 'EXISTING_HOLD'
 WHEN NOT structural_pass OR logic_consistent IS FALSE THEN 'NEEDS_ANSWER_EXPLANATION_CORRECTION'
 WHEN numeric_template_uses>1 OR difficulty='Easy' OR length(btrim(explanation))<55
 THEN 'NEEDS_ADDITIONAL_QUALITY_REVIEW'
 ELSE 'PASS_PRELIMINARY_AUTOMATED_SCREEN' END,
 CASE WHEN previously_verified THEN 'PRIOR_AI_ASSISTED_INDIVIDUAL_CHECK'
 ELSE 'PENDING_INDEPENDENT_ACADEMIC_REVIEW' END
FROM checks;
DO $$
DECLARE n integer; s integer; fail integer; old_review integer; released integer;
BEGIN
 SELECT count(*),count(*) FILTER(WHERE question_kind IN('FOUR_STATEMENT','TWO_STATEMENT')),
 count(*) FILTER(WHERE answer_explanation_logic_consistent IS FALSE OR NOT preliminary_structural_pass),
 count(*) FILTER(WHERE already_ai_individually_reviewed),
 count(*) FILTER(WHERE release_approved)
 INTO n,s,fail,old_review,released
 FROM cbse_import.advanced_mock_bulk_academic_audit_20261028;
 IF n<>1600 OR s<>806 OR fail<>0 OR old_review<>5 OR released<>0 THEN
  RAISE EXCEPTION 'Academic audit integrity failed total %, statements %, failures %, reviewed %, released %',
  n,s,fail,old_review,released;
 END IF;
END $$;
COMMIT;