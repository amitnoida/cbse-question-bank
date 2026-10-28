-- 800-batch remediation: REMOVE only private review selections with old exam
-- labels; replace 107 slots with academically *unverified* but structurally
-- eligible clean school-topic candidates. No deletion of source questions.
-- C12 Physics has no remaining fresh numeric stem patterns: rebalance its 27
-- old-label slots to C12 Biology instead of importing numeric near-duplicates.
BEGIN;
DO $$
DECLARE bad_before integer; n_deleted integer; n_added integer; n_total integer; n_flagged integer; n_duplicate integer;
BEGIN
 SELECT count(*) INTO bad_before
 FROM cbse_import.advanced_mock_bulk_review_batch_20261028 b
 JOIN public.questions q ON q.id=b.source_question_id
 WHERE q.question_text ~* '\m(jee|neet|iit)\M';
 IF bad_before<>107 THEN
   RAISE EXCEPTION 'Expected 107 explicit exam-label candidates; found %',bad_before;
 END IF;
 DELETE FROM cbse_import.advanced_mock_bulk_review_batch_20261028 b
 USING public.questions q
 WHERE q.id=b.source_question_id AND q.question_text ~* '\m(jee|neet|iit)\M';
 GET DIAGNOSTICS n_deleted=ROW_COUNT;
 IF n_deleted<>107 THEN
   RAISE EXCEPTION 'Private-only deletion affected % not 107; rolled back',n_deleted;
 END IF;
 WITH seen_patterns AS (
   SELECT x.destination_subject_id,
     lower(regexp_replace(regexp_replace(btrim(q.question_text),'[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')) pat
   FROM (
     SELECT source_question_id,destination_subject_id FROM cbse_import.advanced_mock_release_review_20261028
     UNION
     SELECT source_question_id,destination_subject_id FROM cbse_import.advanced_mock_bulk_review_batch_20261028
   ) x
   JOIN public.questions q ON q.id=x.source_question_id
 ), eligible AS (
   SELECT c.source_question_id,c.destination_subject_id,c.destination_chapter_id,
    cl.class_name,s.subject_name,ch.chapter_name,c.mapping_review_status,
    lower(regexp_replace(regexp_replace(btrim(q.question_text),'[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')) pat,
    length(q.explanation) AS explanation_length
   FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
   JOIN public.questions q ON q.id=c.source_question_id
   JOIN public.chapters ch ON ch.id=c.destination_chapter_id
   JOIN public.subjects s ON s.id=c.destination_subject_id AND s.id=ch.subject_id
   JOIN public.classes cl ON cl.id=s.class_id
   WHERE c.destination_subject_id IN (17,19,20,21)
   AND NOT c.release_approved AND c.source_content_review_status<>'HOLD'
   AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
   AND c.source_media_ready AND NOT q.is_active AND q.media_ready
   AND (q.question_media IS NULL OR q.question_media='{}'::jsonb)
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
   AND NOT EXISTS(SELECT 1 FROM cbse_import.advanced_mock_release_review_20261028 r WHERE r.source_question_id=c.source_question_id)
   AND NOT EXISTS(SELECT 1 FROM cbse_import.advanced_mock_bulk_review_batch_20261028 b WHERE b.source_question_id=c.source_question_id)
   AND NOT EXISTS(SELECT 1 FROM seen_patterns sp
     WHERE sp.destination_subject_id=c.destination_subject_id
     AND sp.pat=lower(regexp_replace(regexp_replace(btrim(q.question_text),'[0-9]+([.][0-9]+)?','#','g'),'[[:space:]]+',' ','g')))
 ), one_pattern AS (
   SELECT *,row_number() OVER(PARTITION BY destination_subject_id,pat ORDER BY explanation_length DESC,source_question_id) AS pattern_rank
   FROM eligible
 ), by_chapter AS (
   SELECT *,row_number() OVER(PARTITION BY destination_subject_id,destination_chapter_id ORDER BY md5(source_question_id::text)) AS chapter_round
   FROM one_pattern WHERE pattern_rank=1
 ), ranked AS (
   SELECT *,row_number() OVER(PARTITION BY destination_subject_id ORDER BY chapter_round,md5(source_question_id::text)) AS subject_slot
   FROM by_chapter
 ), caps AS (
   SELECT * FROM (VALUES(17::bigint,33),(19::bigint,43),(20::bigint,27),(21::bigint,4)) v(subject_id,max_replacement)
 )
 INSERT INTO cbse_import.advanced_mock_bulk_review_batch_20261028
 (source_question_id,destination_subject_id,destination_chapter_id,class_name,subject_name,chapter_name,origin,
  question_pattern_hash,source_mapping_status,qa_bucket,previously_verified,review_note)
 SELECT r.source_question_id,r.destination_subject_id,r.destination_chapter_id,r.class_name,r.subject_name,r.chapter_name,
 'NEW_440',md5(r.pat),r.mapping_review_status,'PENDING_ACADEMIC',FALSE,
 'Replacement for legacy JEE/NEET-labelled question in private batch; new item has no examination label and a fresh numeric template. Full academic verification pending.'
 FROM ranked r JOIN caps cap ON cap.subject_id=r.destination_subject_id WHERE r.subject_slot<=cap.max_replacement;
 GET DIAGNOSTICS n_added=ROW_COUNT;
 IF n_added<>107 THEN RAISE EXCEPTION 'Could not replace all 107; inserted %; rolled back',n_added; END IF;
 SELECT count(*) INTO n_total FROM cbse_import.advanced_mock_bulk_review_batch_20261028;
 SELECT count(*) INTO n_flagged FROM cbse_import.advanced_mock_bulk_review_batch_20261028 b
 JOIN public.questions q ON q.id=b.source_question_id WHERE q.question_text ~* '\m(jee|neet|iit)\M';
 SELECT count(*) INTO n_duplicate FROM (
  SELECT source_question_id FROM cbse_import.advanced_mock_bulk_review_batch_20261028 GROUP BY source_question_id HAVING count(*)>1
 ) x;
 IF n_total<>800 OR n_flagged<>0 OR n_duplicate<>0 THEN
  RAISE EXCEPTION '800-batch integrity failed total %, labeled %, duplicated %; rolled back',n_total,n_flagged,n_duplicate;
 END IF;
END $$;
COMMIT;