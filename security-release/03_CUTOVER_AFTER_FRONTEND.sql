-- HIGH IMPACT: do not execute until the new frontend is in production,
-- post-deployment smoke tests pass, and an approved rollback/backup is ready.
-- This is the coordinated Change 5A+5B cutover, including practice_sessions DELETE.
BEGIN;
REVOKE SELECT ON TABLE public.questions FROM anon, authenticated, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.practice_sessions FROM anon, authenticated, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.quiz_attempts FROM anon, authenticated, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.quiz_attempt_answers FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_free_question_usage(uuid,bigint,bigint)
  FROM anon, authenticated, PUBLIC;
COMMIT;
