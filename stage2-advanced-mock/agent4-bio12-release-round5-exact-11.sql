-- Class XII Biology Agent 4 Round 5: exact 11 first-pass-reviewed MCQs.
-- User's standing approval. Other agents may release different subject IDs concurrently.
-- Original public.questions remain inactive; no subscription / user changes.
BEGIN;
DO $$
DECLARE before_pool integer;pass_n integer;ch_n integer;blocked_n integer;updated integer;after_pool integer;
BEGIN
 SELECT count(*) INTO before_pool FROM cbse_import.advanced_mock_stage2_candidates_20261028
 WHERE destination_subject_id=20 AND release_approved;
 IF before_pool<73 THEN RAISE EXCEPTION 'Biology baseline unexpectedly below 73: %',before_pool; END IF;

 WITH pass AS (
 SELECT r.source_question_id,r.expected_answer,c.destination_chapter_id
 FROM cbse_import.advanced_mock_agent4_bio12_review_round5_20261028 r
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=r.source_question_id
 JOIN public.questions q ON q.id=r.source_question_id
 JOIN public.chapters ch ON ch.id=c.destination_chapter_id
 JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=c.source_question_id
 WHERE r.decision='ACCEPT' AND c.destination_subject_id=20 AND a.destination_subject_id=20
 AND ch.subject_id=20 AND s.subject_name='Biology' AND cl.class_name='Class 12'
 AND s.is_active AND ch.is_active
 AND r.expected_answer=q.correct_option::text
 AND NOT c.release_approved AND NOT q.is_active AND q.media_ready
 AND c.source_media_ready AND c.source_content_review_status<>'HOLD'
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND COALESCE(q.question_media,'{}'::jsonb)='{}'::jsonb
 AND a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN'
 AND a.preliminary_structural_pass
 AND q.question_text !~* '\m(jee|neet|iit)\M'
 AND length(btrim(q.explanation))>=25
 )
 SELECT count(*),count(DISTINCT destination_chapter_id) INTO pass_n,ch_n FROM pass;
 IF pass_n<>11 OR ch_n<>11 THEN RAISE EXCEPTION 'Preflight expected 11 new Biology questions in 11 chapters, got % in %',pass_n,ch_n; END IF;

 IF EXISTS (
 SELECT 1 FROM cbse_import.advanced_mock_agent4_bio12_review_round5_20261028 r
 JOIN public.questions q ON q.id=r.source_question_id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 old ON old.destination_subject_id=20 AND old.release_approved
 JOIN public.questions o ON o.id=old.source_question_id
 WHERE r.decision='ACCEPT'
 AND lower(regexp_replace(btrim(q.question_text),'[[:space:]]+',' ','g'))=
     lower(regexp_replace(btrim(o.question_text),'[[:space:]]+',' ','g'))
 ) THEN RAISE EXCEPTION 'Duplicate of live Biology question in release selection'; END IF;

 UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c
 SET academic_verified=true,
     answer_verified=true,
     duplicate_cleared=true,
     media_verified=true,
     reviewed_at=clock_timestamp(),
     reviewer_note='Agent4 Class12 Biology round5: 11/52 first-pass AI-assisted NCERT/CBSE answer, explanation, chapter and Advanced-fit checks; 41 skipped for novelty/difficulty. No teacher certification. Owner standing release approval.',
     release_approved=true
 FROM cbse_import.advanced_mock_agent4_bio12_review_round5_20261028 r
 JOIN public.questions q ON q.id=r.source_question_id
 JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=r.source_question_id
 WHERE c.source_question_id=r.source_question_id AND c.destination_subject_id=20
 AND r.decision='ACCEPT' AND r.expected_answer=q.correct_option::text
 AND a.destination_subject_id=20 AND a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN'
 AND a.preliminary_structural_pass
 AND NOT c.release_approved AND NOT q.is_active AND q.media_ready AND c.source_media_ready
 AND c.source_content_review_status<>'HOLD'
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND COALESCE(q.question_media,'{}'::jsonb)='{}'::jsonb;
 GET DIAGNOSTICS updated=ROW_COUNT;
 IF updated<>11 THEN RAISE EXCEPTION 'Expected exactly 11 approved; updated % (all rolled back)',updated; END IF;

 SELECT count(*) INTO after_pool
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=20 AND c.release_approved
 AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
 AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
 AND NOT q.is_active AND q.media_ready;
 IF after_pool<>before_pool+11 THEN
 RAISE EXCEPTION 'Biology release runtime count unexpected: prior % new %',before_pool,after_pool;
 END IF;
 IF EXISTS(
  SELECT 1 FROM cbse_import.advanced_mock_agent4_bio12_review_round5_20261028 r
  JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=r.source_question_id
  WHERE r.decision='SKIP_FIRST_PASS' AND c.release_approved
 ) THEN RAISE EXCEPTION 'A skipped Biology question was released; abort transaction'; END IF;
END $$;
COMMIT;