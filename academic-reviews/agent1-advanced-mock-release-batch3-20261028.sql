-- Agent 1 Batch 3 historical release SQL (executed 2026-10-28)
-- ARCHIVE ONLY. THESE SEVEN IDs HAVE ALREADY BEEN RELEASED; DO NOT RE-RUN.
-- Production Supabase project darfsuqfmmunxqiyqlvn.
-- Authoritative academic evidence: cbse_import.advanced_mock_agent1_review_20261028
-- Exact subject: Class XI Physics, subject_id 19.
-- Original public.questions source rows stay inactive.
DO $agent1_batch3$
DECLARE
 before_physics integer; after_physics integer; before_biology integer; after_biology integer;
 eligible integer; written integer;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('agent1-advanced-mock-subject-19',0));
 SELECT count(*) INTO before_physics
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=19 AND c.release_approved
 AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
 AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
 AND q.is_active=FALSE AND q.media_ready=TRUE;
 SELECT count(*) INTO before_biology
 FROM cbse_import.advanced_mock_stage2_candidates_20261028
 WHERE destination_subject_id=16 AND release_approved;

 SELECT count(*) INTO eligible
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN cbse_import.advanced_mock_agent1_review_20261028 r ON r.source_question_id=c.source_question_id
 JOIN public.questions q ON q.id=c.source_question_id
 JOIN public.chapters ch ON ch.id=c.destination_chapter_id
 JOIN public.subjects s ON s.id=c.destination_subject_id
 WHERE c.source_question_id IN (28102,28188,28670,32979,33025,33153,33163) AND c.destination_subject_id=19
 AND s.class_number=11 AND ch.subject_id=19
 AND r.destination_subject_id=19 AND r.destination_chapter_id=c.destination_chapter_id
 AND r.review_status='ACCEPTED' AND r.release_permitted AND r.independently_checked
 AND c.release_approved=FALSE AND c.academic_verified=FALSE AND c.answer_verified=FALSE
 AND c.duplicate_cleared=FALSE AND c.media_verified=FALSE
 AND c.audit_disposition='MAPPED_READY_FOR_REVIEW'
 AND c.source_media_ready AND NOT c.media_blocked AND NOT c.answer_issue AND NOT c.duplicate_candidate
 AND c.source_content_review_status='PENDING_REVIEW'
 AND q.is_active=FALSE AND q.media_ready=TRUE
 AND q.correct_option IN ('A','B','C','D')
 AND q.explanation IS NOT NULL
 AND q.option_a IS NOT NULL AND q.option_b IS NOT NULL
 AND q.option_c IS NOT NULL AND q.option_d IS NOT NULL;
 IF eligible<>7 THEN
   RAISE EXCEPTION 'Agent1 batch 3 expected 7 eligible IDs, got %, rollback',eligible;
 END IF;

 UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c
 SET academic_verified=TRUE,answer_verified=TRUE,duplicate_cleared=TRUE,media_verified=TRUE,
 release_approved=TRUE,reviewed_at=clock_timestamp(),
 reviewer_note='Agent1 batch 3: individually AI-assisted scientific answer/options/chapter/difficulty/repetition checked. Evidence: cbse_import.advanced_mock_agent1_review_20261028.'
 FROM cbse_import.advanced_mock_agent1_review_20261028 r,public.questions q,public.chapters ch
 WHERE c.source_question_id IN (28102,28188,28670,32979,33025,33153,33163) AND c.destination_subject_id=19
 AND c.source_question_id=r.source_question_id
 AND c.source_question_id=q.id AND c.destination_chapter_id=ch.id AND ch.subject_id=19
 AND r.destination_subject_id=19 AND r.review_status='ACCEPTED'
 AND r.release_permitted AND r.independently_checked
 AND c.release_approved=FALSE AND c.academic_verified=FALSE
 AND c.audit_disposition='MAPPED_READY_FOR_REVIEW'
 AND NOT c.media_blocked AND NOT c.duplicate_candidate AND NOT c.answer_issue
 AND q.is_active=FALSE AND q.media_ready=TRUE;
 GET DIAGNOSTICS written=ROW_COUNT;
 IF written<>7 THEN
   RAISE EXCEPTION 'Agent1 batch3 wrote %, expected 7; rollback',written;
 END IF;

 SELECT count(*) INTO after_physics
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=19 AND c.release_approved
 AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
 AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
 AND q.is_active=FALSE AND q.media_ready=TRUE;
 SELECT count(*) INTO after_biology
 FROM cbse_import.advanced_mock_stage2_candidates_20261028
 WHERE destination_subject_id=16 AND release_approved;
 IF after_physics<>before_physics+7 OR after_biology<>before_biology THEN
   RAISE EXCEPTION 'Agent1 batch3 subject count mismatch; rollback';
 END IF;
END
$agent1_batch3$;
