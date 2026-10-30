-- Owner's permanent extract/skip/active-only policy, Oct 30 2026.
-- Preserve the existing secured import transaction and change only the import's
-- technical readiness label from APPROVED to TEST_READY.
-- TEST_READY denotes structurally complete, not academically verified.
BEGIN;
DO $$
DECLARE original_definition text;
        patched_definition text;
        expected_fragment text:=chr(39)||'APPROVED'||chr(39)||',true,'||chr(39)||'TEACHER_FILE:';
        replacement_fragment text:=chr(39)||'TEST_READY'||chr(39)||',true,'||chr(39)||'TEACHER_FILE:';
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO original_definition
 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='cbse_import_teacher_mcqs_v1';
 IF original_definition IS NULL
   THEN RAISE EXCEPTION 'Teacher importer function unavailable'; END IF;
 IF strpos(original_definition,expected_fragment)=0
   THEN RAISE EXCEPTION 'Teacher importer changed: review function before patch'; END IF;
 patched_definition:=replace(original_definition,expected_fragment,replacement_fragment);
 EXECUTE patched_definition;
 IF (SELECT count(*) FROM public.questions WHERE NOT is_active OR content_review_status<>'TEST_READY')<>0
   THEN RAISE EXCEPTION 'Unexpected inactive/pending questions: abort changing import behavior'; END IF;
END $$;
COMMIT;
-- Verification query: new imported items should be active TEST_READY.
SELECT (strpos(pg_get_functiondef(p.oid),chr(39)||'TEST_READY'||chr(39)||',true,'||chr(39)||'TEACHER_FILE:')>0) AS new_imports_test_ready
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='cbse_import_teacher_mcqs_v1';
