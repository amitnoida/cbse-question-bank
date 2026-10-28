-- Approved by owner 2026-10-28: controlled Class XII Biology Advanced Mock first 60-question release.
-- 42 prior AI-assisted individual FIT reviews + 18 newer AI-assisted FIT reviews.
-- Stages the *existing* inactive public question IDs in Advanced Mock ONLY.
-- The other 1540 selected batch MCQs are NOT approved here.
-- One-time transaction. Do not rerun without new safeguards.
BEGIN;
DO $$
DECLARE v_selected integer; v_chapters integer; v_bad integer; v_updated integer; v_ready integer; v_total integer;
BEGIN
 IF (SELECT count(*) FROM cbse_import.advanced_mock_stage2_candidates_20261028 WHERE release_approved)<>120 THEN
  RAISE EXCEPTION 'Preexisting release count changed unexpectedly; stop before applying';
 END IF;
 IF (SELECT count(*) FROM cbse_import.advanced_mock_stage2_candidates_20261028 WHERE release_approved AND destination_subject_id=20)<>0 THEN
  RAISE EXCEPTION 'Biology has existing release; do not rerun this batch';
 END IF;
 WITH all_reviewed AS (
 SELECT source_question_id FROM cbse_import.advanced_mock_biology12_substantive_review_20261028 WHERE content_assessment='ADVANCED_FIT'
 UNION ALL
 SELECT source_question_id FROM cbse_import.advanced_mock_biology12_substantive_review_round2_20261028 WHERE review_category='FIT'
 UNION ALL
 SELECT source_question_id FROM cbse_import.advanced_mock_biology12_substantive_review_round3_20261028 WHERE suitability='ADVANCED_FIT'
 ), valid AS (
 SELECT r.source_question_id,c.destination_chapter_id
 FROM all_reviewed r JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=r.source_question_id
 JOIN public.questions q ON q.id=c.source_question_id
 JOIN public.chapters ch ON ch.id=c.destination_chapter_id
 JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a USING(source_question_id)
 WHERE c.destination_subject_id=20 AND a.destination_subject_id=20
 AND c.destination_chapter_id=a.destination_chapter_id AND s.id=20 AND s.subject_name='Biology'
 AND cl.class_name='Class 12' AND s.is_active AND ch.is_active
 AND a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN'
 AND a.preliminary_structural_pass
 AND NOT c.release_approved AND NOT q.is_active
 AND c.source_content_review_status<>'HOLD'
 AND c.source_media_ready AND q.media_ready
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND coalesce(q.question_media,'{}'::jsonb)='{}'::jsonb
 AND q.correct_option IN ('A','B','C','D')
 AND length(btrim(q.explanation))>=25
 AND q.question_text !~* '\m(jee|neet|iit)\M'
 )
 SELECT COUNT(*),COUNT(DISTINCT destination_chapter_id) INTO v_selected,v_chapters FROM valid;
 IF v_selected<>60 OR v_chapters<>13 THEN
  RAISE EXCEPTION 'Biology release eligibility unexpected % items / % chapters',v_selected,v_chapters;
 END IF;

 WITH reviewed AS(
 SELECT source_question_id FROM cbse_import.advanced_mock_biology12_substantive_review_20261028 WHERE content_assessment='ADVANCED_FIT'
 UNION ALL
 SELECT source_question_id FROM cbse_import.advanced_mock_biology12_substantive_review_round2_20261028 WHERE review_category='FIT'
 UNION ALL
 SELECT source_question_id FROM cbse_import.advanced_mock_biology12_substantive_review_round3_20261028 WHERE suitability='ADVANCED_FIT'
 )
 UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c SET
 academic_verified=TRUE,answer_verified=TRUE,duplicate_cleared=TRUE,media_verified=TRUE,
 reviewed_at=clock_timestamp(),
 reviewer_note='2026-10-28: First-pass AI-assisted content, option and CBSE Class XII 2026-27 chapter review; 60 Bio questions across 13 chapters. Selected by 3 per-ID review ledgers; no human-teacher certificate. Owner standing approval for successful QA release.',
 release_approved=TRUE
 FROM reviewed r JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=r.source_question_id
 JOIN public.questions q ON q.id=r.source_question_id
 WHERE c.source_question_id=r.source_question_id
 AND c.destination_subject_id=20 AND a.destination_subject_id=20 AND c.destination_chapter_id=a.destination_chapter_id
 AND a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN'
 AND a.preliminary_structural_pass
 AND NOT c.release_approved AND NOT q.is_active AND q.media_ready AND c.source_media_ready
 AND c.source_content_review_status<>'HOLD'
 AND NOT c.media_blocked AND NOT c.duplicate_candidate AND NOT c.answer_issue;
 GET DIAGNOSTICS v_updated=ROW_COUNT;
 IF v_updated<>60 THEN RAISE EXCEPTION 'Expected exactly 60 newly released Biology IDs, got %; rolled back',v_updated; END IF;

 SELECT count(*) INTO v_ready
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=20 AND c.release_approved AND c.academic_verified
 AND c.answer_verified AND c.duplicate_cleared AND c.media_verified AND c.reviewed_at IS NOT NULL
 AND c.source_content_review_status<>'HOLD' AND NOT q.is_active AND q.media_ready;
 SELECT count(*) INTO v_total
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 WHERE release_approved;
 IF v_ready<>60 OR v_total<>180 THEN
  RAISE EXCEPTION 'After-release runtime integrity check failed ready % total %',v_ready,v_total;
 END IF;

 IF EXISTS (
  SELECT 1 FROM cbse_import.advanced_mock_bulk_academic_audit_20261028 a
  JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=a.source_question_id
  WHERE a.destination_subject_id<>20 AND c.release_approved AND a.source_question_id IN
  (SELECT source_question_id FROM cbse_import.advanced_mock_bulk_academic_audit_20261028)
 ) THEN RAISE EXCEPTION 'A non-Biology item in 800-batch was unexpectedly released'; END IF;
END $$;
COMMIT;