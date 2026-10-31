-- Read-only repeatable database security check for ExamYari.
-- Confirm the Supabase policy definitions before changing authorization logic.
DO $audit$
DECLARE missing text;
BEGIN
 SELECT string_agg(t.tablename || '.' || t.owner_policy, ', ') INTO missing
 FROM (VALUES ('quiz_attempts','Student can view own attempts'),
              ('practice_sessions','practice_sessions_select_own'),
              ('mock_exam_sessions','mock_exam_sessions_read_own'))
              AS t(tablename,owner_policy)
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
   AND p.tablename=t.tablename AND p.policyname=t.owner_policy
   AND p.permissive='PERMISSIVE' AND p.cmd='SELECT'
   AND p.roles @> ARRAY['authenticated']::name[]
   AND p.qual LIKE '%auth.uid()%'
   AND p.qual LIKE '%student_id%');
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing ownership policy: %',missing; END IF;

 SELECT string_agg(t.tablename || '.' || t.retention_policy, ', ') INTO missing
 FROM (VALUES ('quiz_attempts','history_retention_14_days'),
              ('practice_sessions','practice_retention_14_days'),
              ('mock_exam_sessions','mock_retention_14_days'))
              AS t(tablename,retention_policy)
 WHERE NOT EXISTS (
   SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
   AND p.tablename=t.tablename AND p.policyname=t.retention_policy
   AND p.permissive='RESTRICTIVE' AND p.cmd='SELECT'
   AND p.roles @> ARRAY['authenticated']::name[];
 IF missing IS NOT NULL THEN RAISE EXCEPTION 'Missing restrictive retention policy: %',missing; END IF;
END $audit$;
SELECT 'PASS: ownership and restrictive retention policies verified' AS result;
