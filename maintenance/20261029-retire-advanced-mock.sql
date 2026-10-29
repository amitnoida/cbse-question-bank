-- Retire the separate Advanced Mock runtime. Historical papers/answers are retained.
-- Standard practice, Real Mock and public.questions are not changed.
BEGIN;
REVOKE EXECUTE ON FUNCTION
 public.advanced_mock_answer_v1(uuid,bigint,text),
 public.advanced_mock_finish_v1(uuid),
 public.advanced_mock_get_v1(uuid),
 public.advanced_mock_overview_v1(bigint),
 public.advanced_mock_start_v1(bigint)
FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON TABLE public.advanced_mock_answers,public.advanced_mock_papers
FROM PUBLIC,anon,authenticated;
COMMIT;
