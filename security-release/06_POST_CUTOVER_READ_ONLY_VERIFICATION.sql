-- Read-only post-cutover verification for Change 5A/5B.
-- Must be executed ONLY AFTER authorized SQL 03 and, if approved, SQL 05.
-- This script makes no mutations. All permission checks must show false.
SELECT t.table_name,t.privilege,
       has_table_privilege('anon','public.'||t.table_name,t.privilege) AS anon_allowed,
       has_table_privilege('authenticated','public.'||t.table_name,t.privilege) AS authenticated_allowed
FROM (VALUES
 ('questions','SELECT'),
 ('practice_sessions','INSERT'),
 ('practice_sessions','UPDATE'),
 ('practice_sessions','DELETE'),
 ('quiz_attempts','INSERT'),
 ('quiz_attempts','UPDATE'),
 ('quiz_attempts','DELETE'),
 ('quiz_attempt_answers','INSERT'),
 ('quiz_attempt_answers','UPDATE'),
 ('quiz_attempt_answers','DELETE')
) AS t(table_name,privilege)
ORDER BY t.table_name,t.privilege;

-- Legacy free-usage RPC must not be callable by an ordinary student.
SELECT has_function_privilege(
  'authenticated',
  'public.record_free_question_usage(uuid,bigint,bigint)',
  'EXECUTE'
) AS legacy_free_usage_executable; -- expected false

-- Authorized replacement RPCs must remain available.
SELECT p.proname AS replacement_rpc,
       has_function_privilege('authenticated',p.oid,'EXECUTE') AS student_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
  'cbse_subject_questions_v1','cbse_start_practice_v1',
  'cbse_practice_session_questions_v1','cbse_question_feedback_v1',
  'cbse_save_practice_progress_v1','cbse_finish_practice_secure_v1',
  'cbse_history_questions_v1','cbse_legacy_mock_review_v1',
  'mock_open_exam','mock_save_answer','mock_finish_exam'
)
ORDER BY p.proname; -- expected true

-- If SQL 05 was approved and applied, anonymous execution must be false:
SELECT p.proname AS hardened_rpc,has_function_privilege('anon',p.oid,'EXECUTE') AS anon_allowed
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN (
 'handle_new_user','start_chapter_mock',
 'start_mock_paper','submit_practice_answer_locked'
);
-- Catalog permissions alone do not prove RLS/auth behavior. Recheck the
-- app with ordinary student, admin, and cross-account negative tests.
