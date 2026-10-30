-- CBSE Advanced Mock: first EIGHT-HUNDRED question BATCH, private review only.
-- 360 carried-forward *unreleased* review rows + 440 new and nonrepeating-pattern rows.
-- NEVER approve, activate, edit or delete public.questions or Stage 2 release ledger.
BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_bulk_review_batch_20261028 (
 source_question_id bigint PRIMARY KEY,
 destination_subject_id bigint NOT NULL,
 destination_chapter_id bigint NOT NULL,
 class_name text NOT NULL CHECK (class_name IN ('Class 11','Class 12')),
 subject_name text NOT NULL CHECK (subject_name IN ('Biology','Chemistry','Mathematics','Physics')),
 chapter_name text NOT NULL,
 origin text NOT NULL CHECK (origin IN ('CARRY_FORWARD','NEW_440')),
 question_pattern_hash text NOT NULL,
 source_mapping_status text NOT NULL,
 qa_bucket text NOT NULL CHECK (qa_bucket IN ('PENDING_ACADEMIC','ALREADY_INDIVIDUALLY_REVIEWED','HOLD_CHAPTER_COVERAGE','HOLD_NUMERIC_TEMPLATE')),
 previously_verified boolean NOT NULL DEFAULT false,
 structurally_screened boolean NOT NULL DEFAULT true,
 academic_verification_complete boolean NOT NULL DEFAULT false,
 release_approved boolean NOT NULL DEFAULT false CHECK (release_approved=false),
 review_note text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.advanced_mock_bulk_review_batch_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE cbse_import.advanced_mock_bulk_review_batch_20261028 FROM PUBLIC,anon,authenticated;

WITH old_unreleased AS (
 SELECT r.source_question_id,r.destination_subject_id,r.destination_chapter_id,
 r.class_name,r.subject_name,r.chapter_name,
 r.template_fingerprint as question_pattern_hash,
 c.mapping_review_status AS source_mapping_status,
 CASE WHEN r.review_status='NEEDS_CHAPTER_COVERAGE' THEN 'HOLD_CHAPTER_COVERAGE'
 WHEN r.review_status='NEEDS_DIVERSITY_REPLACEMENT' THEN 'HOLD_NUMERIC_TEMPLATE'
 WHEN r.review_status='VERIFIED' THEN 'ALREADY_INDIVIDUALLY_REVIEWED'
 ELSE 'PENDING_ACADEMIC' END AS qa_bucket,
 (r.review_status='VERIFIED') AS previously_verified,
 CASE WHEN r.review_status='VERIFIED'
 THEN 'Carried forward previously individually reviewed candidate; not automatically released.'
 WHEN r.review_status='NEEDS_CHAPTER_COVERAGE'
 THEN 'Class 11 Biology candidates cover only one chapter; subject-wide mock must wait for chapter coverage.'
 WHEN r.review_status='NEEDS_DIVERSITY_REPLACEMENT'
 THEN 'Repeated numeric stem pattern in Class 12 Mathematics. Requires question-diversity replacement.'
 ELSE 'Existing private review backlog carried forward; full academic solution/syllabus verification pending.'
 END AS review_note
 FROM cbse_import.advanced_mock_release_review_20261028 r
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=r.source_question_id
 JOIN public.questions q ON q.id=r.source_question_id
 WHERE NOT c.release_approved AND NOT q.is_active
), seen_patterns AS (
 SELECT r.destination_subject_id,
 lower(regexp_replace(regexp_replace(btrim(q.question_text),'[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')) AS stem_pattern
 FROM cbse_import.advanced_mock_release_review_20261028 r
 JOIN public.questions q ON q.id=r.source_question_id
), fresh_candidates AS (
 SELECT c.source_question_id,c.destination_subject_id,c.destination_chapter_id,
 cl.class_name,s.subject_name,ch.chapter_name,c.mapping_review_status,
 lower(regexp_replace(regexp_replace(btrim(q.question_text),'[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')) AS stem_pattern,
 length(q.explanation) AS explanation_length
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 JOIN public.chapters ch ON ch.id=c.destination_chapter_id
 JOIN public.subjects s ON s.id=c.destination_subject_id AND ch.subject_id=s.id
 JOIN public.classes cl ON cl.id=s.class_id
 WHERE c.destination_subject_id IN (17,19,20,21,23)
 AND NOT c.release_approved
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND c.source_content_review_status<>'HOLD' AND c.source_media_ready
 AND NOT q.is_active AND q.media_ready
 AND (q.question_media IS NULL OR q.question_media='{}'::jsonb)
 AND length(btrim(q.question_text))>30
 AND length(btrim(q.explanation))>=25 AND q.correct_option IN ('A','B','C','D')
 AND q.option_a IS NOT NULL AND q.option_b IS NOT NULL AND q.option_c IS NOT NULL AND q.option_d IS NOT NULL
 AND btrim(q.option_a)<>btrim(q.option_b) AND btrim(q.option_a)<>btrim(q.option_c) AND btrim(q.option_a)<>btrim(q.option_d)
 AND btrim(q.option_b)<>btrim(q.option_c) AND btrim(q.option_b)<>btrim(q.option_d) AND btrim(q.option_c)<>btrim(q.option_d)
 AND q.question_text !~* '(https?://|<img|!\[|\[image|see (the )?(diagram|figure))'
 AND NOT EXISTS(SELECT 1 FROM cbse_import.advanced_mock_release_review_20261028 r WHERE r.source_question_id=c.source_question_id)
 AND NOT EXISTS(SELECT 1 FROM seen_patterns p WHERE p.destination_subject_id=c.destination_subject_id AND p.stem_pattern=lower(regexp_replace(regexp_replace(btrim(q.question_text),'[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')))
), dedup_pattern AS (
 SELECT *, row_number() OVER(PARTITION BY destination_subject_id,stem_pattern
 ORDER BY explanation_length DESC,source_question_id) AS pattern_rank
 FROM fresh_candidates
), by_chapter AS (
 SELECT *,
 row_number() OVER(PARTITION BY destination_subject_id,destination_chapter_id
 ORDER BY md5(source_question_id::text)) AS chapter_round
 FROM dedup_pattern WHERE pattern_rank=1
), ranked AS (
 SELECT *, row_number() OVER(PARTITION BY destination_subject_id
 ORDER BY chapter_round,md5(source_question_id::text)) AS subject_slot
 FROM by_chapter
), caps AS (
 SELECT * FROM (VALUES (17::bigint,90),(19::bigint,85),(20::bigint,95),(21::bigint,85),(23::bigint,85)) AS v(subject_id,max_new)
)
INSERT INTO cbse_import.advanced_mock_bulk_review_batch_20261028 (
 source_question_id,destination_subject_id,destination_chapter_id,class_name,subject_name,chapter_name,origin,
 question_pattern_hash,source_mapping_status,qa_bucket,previously_verified,review_note)
SELECT source_question_id,destination_subject_id,destination_chapter_id,class_name,subject_name,chapter_name,
 'CARRY_FORWARD',question_pattern_hash,source_mapping_status,qa_bucket,previously_verified,review_note
FROM old_unreleased
UNION ALL
SELECT r.source_question_id,r.destination_subject_id,r.destination_chapter_id,r.class_name,r.subject_name,r.chapter_name,
 'NEW_440',md5(r.stem_pattern),r.mapping_review_status,'PENDING_ACADEMIC',false,
 'Fresh distinct numeric-normalized stem; chapter spread prioritized. Structural checks passed. Not yet individually academically verified.'
FROM ranked r JOIN caps cap ON cap.subject_id=r.destination_subject_id WHERE r.subject_slot<=cap.max_new;

DO $$
DECLARE n_total integer;n_old integer;n_new integer;n_subjects integer;n_ver integer;n_qa_hold integer;
BEGIN
 SELECT count(*),count(*) FILTER(WHERE origin='CARRY_FORWARD'),count(*) FILTER(WHERE origin='NEW_440'),
 count(DISTINCT destination_subject_id),count(*) FILTER(WHERE previously_verified),
 count(*) FILTER(WHERE qa_bucket LIKE 'HOLD_%')
 INTO n_total,n_old,n_new,n_subjects,n_ver,n_qa_hold
 FROM cbse_import.advanced_mock_bulk_review_batch_20261028;
 IF n_total<>800 OR n_old<>360 OR n_new<>440 OR n_subjects<>8 OR n_ver<>5 OR n_qa_hold<>73 THEN
  RAISE EXCEPTION 'Unexpected 800-batch shape total % old % new % subjects % previous-verified % hold %, rolling back',
  n_total,n_old,n_new,n_subjects,n_ver,n_qa_hold;
 END IF;
 IF EXISTS(
 SELECT 1 FROM cbse_import.advanced_mock_bulk_review_batch_20261028 b
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=b.source_question_id
 JOIN public.questions q ON q.id=b.source_question_id
 WHERE c.release_approved OR q.is_active OR NOT c.source_media_ready OR NOT q.media_ready OR c.media_blocked
 OR c.duplicate_candidate OR c.answer_issue OR c.source_content_review_status='HOLD'
 ) THEN RAISE EXCEPTION 'Batch includes a previously released/active/blocked question'; END IF;
END $$;
COMMIT;
