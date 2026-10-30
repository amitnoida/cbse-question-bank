-- CBSE Class XI Physics -- exact 60 AI-reviewed Advanced Mock questions across 14 chapters.
-- Isolated release ledger only. Source questions remain inactive.
-- Other subjects, standard mocks, free usage, memberships and student history untouched.
BEGIN;
DO $$
DECLARE n_total integer; n_chapters integer; n_updated integer; n_eligible integer;
BEGIN
 SELECT count(*),count(DISTINCT r.destination_chapter_id)
 INTO n_total,n_chapters
 FROM cbse_import.advanced_mock_release_review_20261028 r
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=r.source_question_id
 JOIN public.questions q ON q.id=r.source_question_id
 JOIN public.chapters ch ON ch.id=r.destination_chapter_id
 JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 WHERE r.destination_subject_id=19 AND r.class_name='Class 11' AND r.subject_name='Physics'
 AND cl.class_name='Class 11' AND s.subject_name='Physics'
 AND r.review_status='VERIFIED' AND r.verified_at IS NOT NULL
 AND c.destination_subject_id=19 AND c.destination_chapter_id=r.destination_chapter_id
 AND NOT c.release_approved AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND c.source_content_review_status<>'HOLD'
 AND c.source_media_ready AND q.media_ready AND NOT q.is_active
 AND (q.question_media IS NULL OR q.question_media='{}'::jsonb)
 AND q.correct_option IN ('A','B','C','D') AND length(btrim(q.explanation))>=25;
 IF n_total<>60 OR n_chapters<>14 THEN
  RAISE EXCEPTION 'Physics pre-release check failed: % qualifying / % chapters',n_total,n_chapters;
 END IF;
 IF EXISTS (
  SELECT 1 FROM cbse_import.advanced_mock_release_review_20261028 r
  WHERE r.destination_subject_id=19
  GROUP BY r.destination_chapter_id HAVING count(*) NOT BETWEEN 4 AND 5
 ) THEN RAISE EXCEPTION 'Class XI Physics chapter allocation must remain 4–5 items per chapter'; END IF;
 IF (SELECT count(*) FROM cbse_import.advanced_mock_stage2_candidates_20261028 WHERE destination_subject_id=19 AND release_approved)<>0 THEN
 RAISE EXCEPTION 'Physics subject already released; do not rerun'; END IF;

 UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c
 SET academic_verified=TRUE,answer_verified=TRUE,duplicate_cleared=TRUE,media_verified=TRUE,
     reviewed_at=clock_timestamp(),
     reviewer_note='AI-assisted individual Class 11 Physics worked-answer and 2026-27 CBSE chapter review, 60 exact IDs across all 14 chapters. Isolated Advanced Mock only; source question remains inactive.',
     release_approved=TRUE
 FROM cbse_import.advanced_mock_release_review_20261028 r
 WHERE c.source_question_id=r.source_question_id AND c.destination_subject_id=19
 AND r.destination_subject_id=19 AND r.review_status='VERIFIED'
 AND r.verified_at IS NOT NULL AND c.destination_chapter_id=r.destination_chapter_id
 AND c.source_content_review_status<>'HOLD' AND c.source_media_ready
 AND NOT c.release_approved AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue;
 GET DIAGNOSTICS n_updated=ROW_COUNT;
 IF n_updated<>60 THEN RAISE EXCEPTION 'Physics release count %, not 60; rolled back',n_updated; END IF;
 SELECT count(*) INTO n_eligible
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=19 AND c.release_approved AND c.academic_verified
 AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
 AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
 AND q.is_active=FALSE AND q.media_ready;
 IF n_eligible<>60 THEN RAISE EXCEPTION 'Physics eligible runtime count %, not 60; rolled back',n_eligible; END IF;
END $$;
COMMIT;