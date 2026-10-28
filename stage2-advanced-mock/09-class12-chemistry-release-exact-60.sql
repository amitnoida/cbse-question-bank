-- Release exact 60 Class XII Chemistry reviewed questions into isolated Advanced Mock runtime.
-- NEVER UPDATE public.questions, memberships, practice, or standard mock tables.
-- Existing source question content remains inactive: q.is_active = FALSE.
BEGIN;
DO $$
DECLARE n_review integer; n_chapters integer; n_changed integer; n_released integer;
BEGIN
 SELECT count(*),count(DISTINCT r.destination_chapter_id)
 INTO n_review,n_chapters
 FROM cbse_import.advanced_mock_release_review_20261028 r
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=r.source_question_id
 JOIN public.questions q ON q.id=r.source_question_id
 JOIN public.chapters ch ON ch.id=r.destination_chapter_id
 JOIN public.subjects s ON s.id=r.destination_subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 WHERE r.destination_subject_id=21
 AND r.class_name='Class 12' AND r.subject_name='Chemistry'
 AND s.subject_name='Chemistry' AND cl.class_name='Class 12'
 AND r.review_status='VERIFIED' AND r.verified_at IS NOT NULL
 AND r.destination_subject_id=c.destination_subject_id
 AND r.destination_chapter_id=c.destination_chapter_id
 AND ch.subject_id=s.id
 AND NOT c.release_approved
 AND c.source_content_review_status <> 'HOLD'
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND c.source_media_ready AND q.media_ready AND q.is_active=FALSE
 AND (q.question_media IS NULL OR q.question_media='{}'::jsonb)
 AND q.correct_option IN ('A','B','C','D')
 AND length(btrim(q.explanation))>=25;
 IF n_review<>60 OR n_chapters<>10 THEN
   RAISE EXCEPTION 'Release preconditions failed: % qualifying questions, % chapters',n_review,n_chapters;
 END IF;
 IF EXISTS (
   SELECT 1 FROM cbse_import.advanced_mock_release_review_20261028 r
   WHERE r.destination_subject_id=21 GROUP BY r.destination_chapter_id HAVING COUNT(*)<>6
 ) THEN
  RAISE EXCEPTION 'Class 12 Chemistry requires six questions across each of ten units';
 END IF;
 UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c
 SET academic_verified=TRUE, answer_verified=TRUE, duplicate_cleared=TRUE,
     media_verified=TRUE,
     reviewed_at=clock_timestamp(),
     reviewer_note='Class 12 Chemistry 2026-27 CBSE 10-unit review, 60 individually AI-checked stems, options and answers; academic review source: private 20261028 queue; gate-limited to Advanced Mock only.',
     release_approved=TRUE
 FROM cbse_import.advanced_mock_release_review_20261028 r
 WHERE c.source_question_id=r.source_question_id
  AND c.destination_subject_id=21 AND r.destination_subject_id=21
  AND c.destination_chapter_id=r.destination_chapter_id
  AND r.review_status='VERIFIED' AND r.verified_at IS NOT NULL
  AND c.source_content_review_status<>'HOLD'
  AND NOT c.release_approved
  AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
  AND c.source_media_ready;
 GET DIAGNOSTICS n_changed=ROW_COUNT;
 IF n_changed<>60 THEN
  RAISE EXCEPTION 'Release changed %, expected exactly 60. Transaction rolled back',n_changed;
 END IF;
 SELECT count(*) INTO n_released FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=21 AND c.release_approved
 AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared
 AND c.media_verified AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
 AND q.is_active=FALSE AND q.media_ready;
 IF n_released<>60 THEN
  RAISE EXCEPTION 'Runtime eligible count %, expected 60; rolled back',n_released;
 END IF;
END $$;
COMMIT;