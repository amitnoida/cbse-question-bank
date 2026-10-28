-- Stage 2 final read-only verification (before/after approved 1,664 cleanup)
-- No records activated, deleted, reclassified or assigned by this script.
SELECT
  (SELECT count(*) FROM cbse_import.advanced_mock_stage2_candidates_20261028) AS stage2_candidates_expected_7442,
  (SELECT count(*) FROM cbse_import.advanced_mock_stage2_candidates_20261028 WHERE release_approved) AS academically_released_expected_0_until_review,
  (SELECT count(*) FROM public.advanced_mock_papers) AS advanced_papers,
  (SELECT count(*) FROM public.advanced_mock_answers) AS advanced_answers,
  (SELECT count(*) FROM cbse_import.advanced_mock_mapping_20261028 WHERE proposed_chapter_id IS NULL) AS unresolved_expected_1664_before_retirement_or_0_after,
  (SELECT count(*) FROM public.mock_papers) AS original_standard_mock_papers;

SELECT c.relname,c.relrowsecurity AS rls_on,
  has_table_privilege('anon',c.oid,'SELECT') AS anonymous_can_read,
  has_table_privilege('authenticated',c.oid,'SELECT') AS students_can_query_raw_tables
FROM pg_class c
WHERE c.oid IN ('public.advanced_mock_papers'::regclass,
                'public.advanced_mock_answers'::regclass,
                'cbse_import.advanced_mock_stage2_candidates_20261028'::regclass)
ORDER BY 1;

SELECT p.proname,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anonymous_can_call,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_can_call
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'advanced_mock_overview_v1','advanced_mock_start_v1','advanced_mock_get_v1',
 'advanced_mock_answer_v1','advanced_mock_finish_v1'
)
ORDER BY 1;

SELECT cl.class_name,s.subject_name,
  count(*) AS candidates,
  count(*) FILTER (WHERE c.release_approved AND c.academic_verified AND c.answer_verified AND
     c.duplicate_cleared AND c.media_verified AND c.reviewed_at IS NOT NULL AND
     c.source_content_review_status<>'HOLD' AND q.media_ready IS TRUE AND q.is_active IS FALSE) AS released_pool,
  count(*) FILTER (WHERE c.media_blocked OR q.media_ready IS NOT TRUE) AS media_attention,
  count(*) FILTER (WHERE c.duplicate_candidate) AS duplicate_attention
FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
JOIN public.questions q ON q.id=c.source_question_id
JOIN public.subjects s ON s.id=c.destination_subject_id
JOIN public.classes cl ON cl.id=c.destination_class_id
GROUP BY 1,2 ORDER BY 1,2;
