-- Agent 4, Class XII Biology ONLY. Standing owner approval, safe Advanced Mock release of 13
-- individually AI-reviewed MCQs from 73-question first-pass round4.
-- All source public.questions records remain INACTIVE and unchanged.
-- No assumptions about global release counts: Agents 1-3 may release other subject IDs concurrently.
BEGIN;
DO $$
DECLARE n integer;ch integer;bad integer;updated integer;runtime_pool integer;
BEGIN
 SELECT COUNT(*),COUNT(DISTINCT c.destination_chapter_id) INTO n,ch
 FROM cbse_import.advanced_mock_agent4_bio12_review_round4_20261028 r
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=r.source_question_id
 JOIN public.questions q ON q.id=r.source_question_id
 JOIN public.chapters pch ON pch.id=c.destination_chapter_id
 JOIN public.subjects s ON s.id=pch.subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 LEFT JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=r.source_question_id
 WHERE r.decision='ACCEPT' AND r.checked_answer=q.correct_option::text
 AND c.destination_subject_id=20 AND s.id=20 AND s.subject_name='Biology' AND cl.class_name='Class 12'
 AND pch.is_active AND s.is_active
 AND a.source_question_id IS NULL OR false;
 -- The above query is deliberately replaced by the complete guarded verification below;
 -- using an impossible branch keeps no partial assumption during the review.
 SELECT count(*),count(DISTINCT c.destination_chapter_id) INTO n,ch
 FROM cbse_import.advanced_mock_agent4_bio12_review_round4_20261028 r
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=r.source_question_id
 JOIN public.questions q ON q.id=r.source_question_id
 JOIN public.chapters pch ON pch.id=c.destination_chapter_id
 JOIN public.subjects s ON s.id=pch.subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 LEFT JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=r.source_question_id
 WHERE r.decision='ACCEPT' AND r.checked_answer=q.correct_option::text
 AND c.destination_subject_id=20 AND s.id=20 AND s.subject_name='Biology' AND cl.class_name='Class 12'
 AND pch.is_active AND s.is_active AND NOT c.release_approved AND NOT q.is_active AND q.media_ready
 AND c.source_media_ready AND c.source_content_review_status<>'HOLD'
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND (a.source_question_id IS NULL OR (a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN' AND a.preliminary_structural_pass))
 AND coalesce(q.question_media,'{}'::jsonb)='{}'::jsonb
 AND q.correct_option::text IN('A','B','C','D')
 AND length(btrim(q.explanation))>=25
 AND q.question_text !~* '\m(jee|neet|iit)\M';
 IF n<>13 OR ch<10 THEN
 RAISE EXCEPTION 'Agent4 release preflight failed: % accepted in % chapters',n,ch;
 END IF;
 IF EXISTS(
 SELECT 1 FROM cbse_import.advanced_mock_agent4_bio12_review_round4_20261028 r
 JOIN public.questions q ON q.id=r.source_question_id
 WHERE r.decision='ACCEPT' AND EXISTS(
 SELECT 1 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions live ON live.id=c.source_question_id
 WHERE c.destination_subject_id=20 AND c.release_approved
 AND lower(regexp_replace(btrim(live.question_text),'[[:space:]]+',' ','g'))
   =lower(regexp_replace(btrim(q.question_text),'[[:space:]]+',' ','g'))
 )
 ) THEN RAISE EXCEPTION 'Already released Biology exact-text question detected'; END IF;
 UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c SET
 academic_verified=true,answer_verified=true,duplicate_cleared=true,media_verified=true,
 reviewer_note='Agent 4 Class XII Biology 2026-10-28: per-question AI-assisted first-pass correct answer, explanation, chapter and Advanced fit; 13 accepted of 73 examined. User standing release authorization; not teacher-certified.',
 reviewed_at=clock_timestamp(),release_approved=true
 FROM cbse_import.advanced_mock_agent4_bio12_review_round4_20261028 r
 JOIN public.questions q ON q.id=r.source_question_id
 LEFT JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=r.source_question_id
 WHERE c.source_question_id=r.source_question_id
 AND r.decision='ACCEPT' AND r.checked_answer=q.correct_option::text
 AND c.destination_subject_id=20 AND NOT c.release_approved
 AND NOT q.is_active AND q.media_ready AND c.source_media_ready
 AND c.source_content_review_status<>'HOLD'
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND coalesce(q.question_media,'{}'::jsonb)='{}'::jsonb
 AND q.question_text !~* '\m(jee|neet|iit)\M'
 AND (a.source_question_id IS NULL OR (a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN' AND a.preliminary_structural_pass));
 GET DIAGNOSTICS updated=ROW_COUNT;
 IF updated<>13 THEN RAISE EXCEPTION 'Expected 13 new Biology releases but updated %',updated; END IF;
 SELECT count(*) INTO runtime_pool
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=20 AND c.release_approved
 AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
 AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
 AND NOT q.is_active AND q.media_ready;
 IF runtime_pool<73 THEN RAISE EXCEPTION 'Biology live pool after release unexpectedly below 73: %',runtime_pool; END IF;
END $$;
COMMIT;