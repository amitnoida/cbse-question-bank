-- EMERGENCY ONLY: restores a minimal subset of legacy access until the previous frontend
-- is also redeployed. Do not run for routine troubleshooting.
BEGIN;
GRANT SELECT ON TABLE public.questions TO anon,authenticated;
GRANT INSERT,DELETE ON TABLE public.practice_sessions TO authenticated;
GRANT INSERT,UPDATE,DELETE ON TABLE public.quiz_attempts TO authenticated;
GRANT INSERT,UPDATE,DELETE ON TABLE public.quiz_attempt_answers TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_free_question_usage(uuid,bigint,bigint) TO authenticated;
COMMIT;
-- Do not DROP the newer RPCs while the new frontend may still need them.
