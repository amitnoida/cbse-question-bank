-- Batch #2: EXACTLY 800 NEW, currently unreleased Class 11/12 Advanced questions.
-- Only candidate selection into private cbse_import table, NOT academic approval or release.
-- Prior 800 batch, prior 480-review pool, and all released questions are excluded.
BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_bulk_review_batch2_20261028 (
 source_question_id bigint PRIMARY KEY,
 destination_subject_id bigint NOT NULL,
 destination_chapter_id bigint NOT NULL,
 class_name text NOT NULL CHECK (class_name IN ('Class 11','Class 12')),
 subject_name text NOT NULL CHECK (subject_name IN ('Biology','Chemistry')),
 chapter_name text NOT NULL,
 template_fingerprint text NOT NULL,
 mapping_review_status text NOT NULL,
 difficulty text NOT NULL CHECK (difficulty IN ('Medium','Hard')),
 structural_screen_pass boolean NOT NULL DEFAULT true,
 academic_status text NOT NULL DEFAULT 'PENDING_INDEPENDENT_ACADEMIC_REVIEW'
   CHECK (academic_status IN ('PENDING_INDEPENDENT_ACADEMIC_REVIEW','FLAGGED_FOR_CORRECTION','INDEPENDENTLY_VERIFIED')),
 independently_verified_at timestamptz,
 release_approved boolean NOT NULL DEFAULT false CHECK (release_approved=false),
 reviewer_note text NOT NULL DEFAULT 'AI-eligible structural screening only; answer and syllabus verification are NOT certified.',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (destination_subject_id,template_fingerprint),
 CONSTRAINT individual_verification_requires_timestamp CHECK
 ((academic_status='INDEPENDENTLY_VERIFIED')=(independently_verified_at IS NOT NULL))
);
ALTER TABLE cbse_import.advanced_mock_bulk_review_batch2_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cbse_import.advanced_mock_bulk_review_batch2_20261028 FROM PUBLIC,anon,authenticated;
WITH used_stems AS (
 SELECT x.destination_subject_id,
 lower(regexp_replace(regexp_replace(btrim(q.question_text),
 '[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')) AS stem
 FROM (
 SELECT source_question_id,destination_subject_id FROM cbse_import.advanced_mock_release_review_20261028
 UNION
 SELECT source_question_id,destination_subject_id FROM cbse_import.advanced_mock_bulk_review_batch_20261028
 ) x JOIN public.questions q ON q.id=x.source_question_id
), eligible AS(
 SELECT c.source_question_id,c.destination_subject_id,c.destination_chapter_id,
 cl.class_name,s.subject_name,ch.chapter_name,c.mapping_review_status,
 q.difficulty,length(q.explanation) explanation_length,
 lower(regexp_replace(regexp_replace(btrim(q.question_text),
 '[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')) AS template
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 JOIN public.chapters ch ON ch.id=c.destination_chapter_id
 JOIN public.subjects s ON s.id=c.destination_subject_id AND s.id=ch.subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 WHERE c.destination_subject_id IN (17,20,21)
 AND NOT c.release_approved AND c.source_content_review_status<>'HOLD'
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND c.source_media_ready AND NOT q.is_active AND q.media_ready
 AND COALESCE(q.question_media,'{}'::jsonb)='{}'::jsonb
 AND q.difficulty IN ('Medium','Hard')
 AND length(btrim(q.question_text))>30 AND length(btrim(q.explanation))>=25
 AND q.correct_option IN ('A','B','C','D')
 AND q.option_a IS NOT NULL AND q.option_b IS NOT NULL AND q.option_c IS NOT NULL AND q.option_d IS NOT NULL
 AND lower(btrim(q.option_a))<>lower(btrim(q.option_b))
 AND lower(btrim(q.option_a))<>lower(btrim(q.option_c))
 AND lower(btrim(q.option_a))<>lower(btrim(q.option_d))
 AND lower(btrim(q.option_b))<>lower(btrim(q.option_c))
 AND lower(btrim(q.option_b))<>lower(btrim(q.option_d))
 AND lower(btrim(q.option_c))<>lower(btrim(q.option_d))
 AND q.question_text !~* '(\m(jee|neet|iit)\M|https?://|<img|!\[|\[image|see (the )?(diagram|figure))'
 AND NOT EXISTS(SELECT 1 FROM cbse_import.advanced_mock_release_review_20261028 r
   WHERE r.source_question_id=c.source_question_id)
 AND NOT EXISTS(SELECT 1 FROM cbse_import.advanced_mock_bulk_review_batch_20261028 b
   WHERE b.source_question_id=c.source_question_id)
 AND NOT EXISTS(SELECT 1 FROM used_stems u WHERE u.destination_subject_id=c.destination_subject_id
 AND u.stem=lower(regexp_replace(regexp_replace(btrim(q.question_text),
 '[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')))
), unique_templates AS(
 SELECT *,row_number() OVER
 (PARTITION BY destination_subject_id,template ORDER BY explanation_length DESC,source_question_id) template_rank
 FROM eligible
), chapter_balanced AS(
 SELECT *,row_number() OVER(PARTITION BY destination_subject_id,destination_chapter_id ORDER BY
 md5(source_question_id::text)) chapter_round
 FROM unique_templates WHERE template_rank=1
), ranked AS(
 SELECT *,row_number() OVER (PARTITION BY destination_subject_id
 ORDER BY chapter_round,md5(source_question_id::text)) subject_rank
 FROM chapter_balanced
), quota AS(
 SELECT * FROM (VALUES (17::bigint,160),(20::bigint,420),(21::bigint,220)) v(subject_id,maximum)
)
INSERT INTO cbse_import.advanced_mock_bulk_review_batch2_20261028
(source_question_id,destination_subject_id,destination_chapter_id,class_name,subject_name,
 chapter_name,template_fingerprint,mapping_review_status,difficulty)
SELECT r.source_question_id,r.destination_subject_id,r.destination_chapter_id,r.class_name,r.subject_name,
 r.chapter_name,md5(r.template),r.mapping_review_status,r.difficulty
FROM ranked r JOIN quota k ON k.subject_id=r.destination_subject_id WHERE r.subject_rank<=k.maximum;

DO $$
DECLARE n integer; nl integer; nbad integer;
BEGIN
 SELECT count(*) INTO n FROM cbse_import.advanced_mock_bulk_review_batch2_20261028;
 SELECT count(*) INTO nl FROM cbse_import.advanced_mock_bulk_review_batch2_20261028 b
 JOIN public.questions q ON q.id=b.source_question_id WHERE q.question_text ~* '\m(jee|neet|iit)\M';
 SELECT count(*) INTO nbad FROM cbse_import.advanced_mock_bulk_review_batch2_20261028 b
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c USING(source_question_id)
 JOIN public.questions q ON q.id=b.source_question_id
 WHERE c.release_approved OR q.is_active OR c.media_blocked OR NOT q.media_ready
 OR c.duplicate_candidate OR c.answer_issue OR c.source_content_review_status='HOLD';
 IF n<>800 OR nl<>0 OR nbad<>0 THEN
 RAISE EXCEPTION 'Batch2 validation failed: count %, exam labels %, blocked %',n,nl,nbad;
 END IF;
 IF EXISTS (
 SELECT destination_subject_id, count(*) n FROM cbse_import.advanced_mock_bulk_review_batch2_20261028
 GROUP BY destination_subject_id
 HAVING (destination_subject_id=17 AND count(*)<>160)
 OR (destination_subject_id=20 AND count(*)<>420)
 OR (destination_subject_id=21 AND count(*)<>220)
 ) THEN RAISE EXCEPTION 'Incorrect subject quotas'; END IF;
END $$;
COMMIT;