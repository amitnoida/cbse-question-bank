-- Stage 2 read-only verification (safe before and after the 8 PM IST cleanup).
-- BEFORE: unresolved=1664, stage2_candidates=7442.
-- AFTER SUCCESSFUL approved cleanup: unresolved=0, stage2_candidates=7442.
-- This script never updates, deletes, activates or inserts data.

SELECT
  (SELECT count(*) FROM cbse_import.advanced_mock_stage2_candidates_20261028) AS stage2_candidates,
  (SELECT count(*) FROM cbse_import.advanced_mock_stage2_candidates_20261028
   WHERE release_approved) AS release_approved,
  (SELECT count(*) FROM cbse_import.advanced_mock_mapping_20261028
   WHERE proposed_chapter_id IS NULL) AS unresolved_awaiting_retirement,
  (SELECT count(*) FROM cbse_import.advanced_mock_mapping_20261028
   WHERE proposed_chapter_id IS NOT NULL) AS still_mapped,
  (SELECT count(*) FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
   JOIN cbse_import.advanced_mock_mapping_20261028 m
     ON m.source_question_id=c.source_question_id
   WHERE m.proposed_chapter_id IS NULL) AS forbidden_overlap,
  (SELECT count(*) FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
   JOIN public.questions q ON q.id=c.source_question_id
   WHERE q.is_active IS TRUE) AS unexpectedly_active_source;

-- Check whether completed archive exists and how many records are stored.
SELECT table_name
FROM information_schema.tables
WHERE table_schema='cbse_import'
  AND table_name IN (
    'advanced_mock_unresolved_questions_backup_20261028',
    'advanced_mock_unresolved_mapping_backup_20261028',
    'advanced_mock_unresolved_audit_backup_20261028'
  )
ORDER BY table_name;

-- Security advisory: Supabase inventory flagged six legacy cbse_import
-- staging/backup tables with RLS disabled (not altered by Stage 2).
-- BELOW IS A REVIEW-ONLY PROPOSAL: Do not run without verifying schema/API role
-- exposure and importer/admin permissions. Enabling RLS with no policies denies
-- access to client roles and can break any currently dependent app workflows.
/*
ALTER TABLE cbse_import.question_classifications_before_cutover_20261027 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbse_import.preliminary_activation_20261027 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbse_import.inactive_school_questions_backup_20261028 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbse_import.removed_jee_main_questions_backup_20261028 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbse_import.advanced_mock_mapping_20261028 ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbse_import.advanced_mock_stage1_audit_20261028 ENABLE ROW LEVEL SECURITY;
*/
