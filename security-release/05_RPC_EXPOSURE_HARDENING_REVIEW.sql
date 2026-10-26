-- Change 5A/5B ancillary RPC hardening. REVIEW ONLY.
-- Not part of automatic SQL 03 execution. Apply separately after approval.
-- Preserve authenticated calls required by existing student mock and practice flows.
BEGIN;

-- These two are intended for signed-in students and validate auth.uid().
-- Remove anonymous and inherited PUBLIC execution; grant authenticated explicitly.
REVOKE EXECUTE ON FUNCTION public.start_chapter_mock(bigint,bigint[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_chapter_mock(bigint,bigint[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.start_mock_paper(bigint,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_mock_paper(bigint,integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_practice_answer_locked(uuid,bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_practice_answer_locked(uuid,bigint,text) TO authenticated;

-- Auth user-creation trigger; no public RPC invocation is required.
-- Verify trigger behavior after this permission change in a validation environment.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Fix two mutable search_path warnings without replacing function bodies.
-- Both functions use only PL/pgSQL record fields and pg_catalog builtins.
ALTER FUNCTION public.cbse_protect_practice_answers() SET search_path = pg_catalog;
ALTER FUNCTION public.get_financial_year_end(timestamptz) SET search_path = pg_catalog;

COMMIT;

-- After deployment, rerun security advisors and verify sign-up, paid/free mock
-- initiation, locked answers, history review, and subscription calculations.
