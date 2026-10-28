-- USER-APPROVED CONTROLLED RETIREMENT (2026-10-28)
-- Project: darfsuqfmmunxqiyqlvn
-- Source: cbse_import.advanced_mock_mapping_20261028
-- Target: EXACT 1,664 unresolved competitive-source questions, all inactive.
--
-- STATUS: NOT EXECUTED BY CHATGPT (Supabase connector safety-check blocks).
-- Run in the Supabase SQL Editor only if the live 1,664 count still matches.
-- One transaction; any invariant or FK failure rolls back ALL changes including archives.
-- This does NOT activate, migrate, or delete any mapped 7,442 source MCQs.
-- This does NOT change school questions, student profiles, subscription or history.
-- It does NOT start Stage 2.
--
-- Archives are in cbse_import, NOT in student-facing public.questions.
-- Run exactly once. A second run aborts because backup table names already exist.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- 1. Before doing anything, prove the selection is unchanged and inactive.
DO $guard$
DECLARE
  total_count bigint;
  unsafe_count bigint;
  missing_audit_count bigint;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE q.id IS NULL OR q.is_active IS DISTINCT FROM FALSE),
         count(*) FILTER (WHERE a.source_question_id IS NULL)
  INTO total_count, unsafe_count, missing_audit_count
  FROM cbse_import.advanced_mock_mapping_20261028 m
  LEFT JOIN public.questions q ON q.id=m.source_question_id
  LEFT JOIN cbse_import.advanced_mock_stage1_audit_20261028 a ON a.source_question_id=m.source_question_id
  WHERE m.proposed_chapter_id IS NULL;

  IF total_count <> 1664 OR unsafe_count <> 0 OR missing_audit_count <> 0 THEN
    RAISE EXCEPTION 'Abort: unresolved=%, missing/active source=%, missing audit=%; expected 1664/0/0',
      total_count,unsafe_count,missing_audit_count;
  END IF;

  -- Guard recorded answers, coverage and usage.
  IF EXISTS (
    SELECT 1 FROM public.quiz_attempt_answers a
    JOIN cbse_import.advanced_mock_mapping_20261028 m ON m.source_question_id=a.question_id
    WHERE m.proposed_chapter_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.mock_exam_answers a
    JOIN cbse_import.advanced_mock_mapping_20261028 m ON m.source_question_id=a.question_id
    WHERE m.proposed_chapter_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.student_answers a
    JOIN cbse_import.advanced_mock_mapping_20261028 m ON m.source_question_id=a.question_id
    WHERE m.proposed_chapter_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.mock_question_coverage a
    JOIN cbse_import.advanced_mock_mapping_20261028 m ON m.source_question_id=a.question_id
    WHERE m.proposed_chapter_id IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.practice_question_usage a
    JOIN cbse_import.advanced_mock_mapping_20261028 m ON m.source_question_id=a.question_id
    WHERE m.proposed_chapter_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Abort: one or more unresolved questions is referenced by recorded answers, coverage or practice usage';
  END IF;

  -- Array-type paper/session references are not covered by per-element FKs.
  IF EXISTS (
    SELECT 1 FROM public.mock_papers p
    WHERE p.question_ids && ARRAY(
      SELECT source_question_id FROM cbse_import.advanced_mock_mapping_20261028
      WHERE proposed_chapter_id IS NULL
    )
  ) OR EXISTS (
    SELECT 1 FROM public.chapter_mock_papers p
    WHERE p.question_ids && ARRAY(
      SELECT source_question_id FROM cbse_import.advanced_mock_mapping_20261028
      WHERE proposed_chapter_id IS NULL
    )
  ) OR EXISTS (
    SELECT 1 FROM public.practice_sessions p
    WHERE p.question_ids && ARRAY(
      SELECT source_question_id FROM cbse_import.advanced_mock_mapping_20261028
      WHERE proposed_chapter_id IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Abort: one or more unresolved questions is assigned in a saved mock/practice question_id array';
  END IF;
END
$guard$;

-- 2. Durable full backups. CTAS includes the original question text, options,
-- explanations, media info, source chapter, import key and timestamps.
-- Original ID and full provenance stay available for selective recovery.
CREATE TABLE cbse_import.advanced_mock_unresolved_questions_backup_20261028 AS
SELECT q.*
FROM public.questions q
JOIN cbse_import.advanced_mock_mapping_20261028 m
  ON m.source_question_id=q.id
WHERE m.proposed_chapter_id IS NULL AND q.is_active=FALSE;

CREATE TABLE cbse_import.advanced_mock_unresolved_mapping_backup_20261028 AS
SELECT m.*
FROM cbse_import.advanced_mock_mapping_20261028 m
WHERE m.proposed_chapter_id IS NULL;

CREATE TABLE cbse_import.advanced_mock_unresolved_audit_backup_20261028 AS
SELECT a.*
FROM cbse_import.advanced_mock_stage1_audit_20261028 a
JOIN cbse_import.advanced_mock_unresolved_mapping_backup_20261028 m
ON m.source_question_id=a.source_question_id;

-- 3. Enforce archival completeness before any DELETE.
DO $guard$
DECLARE nq bigint; nm bigint; na bigint; nmissing bigint;
BEGIN
  SELECT count(*) INTO nq FROM cbse_import.advanced_mock_unresolved_questions_backup_20261028;
  SELECT count(*) INTO nm FROM cbse_import.advanced_mock_unresolved_mapping_backup_20261028;
  SELECT count(*) INTO na FROM cbse_import.advanced_mock_unresolved_audit_backup_20261028;
  SELECT count(*) INTO nmissing
  FROM cbse_import.advanced_mock_unresolved_mapping_backup_20261028 m
  LEFT JOIN cbse_import.advanced_mock_unresolved_questions_backup_20261028 q ON q.id=m.source_question_id
  LEFT JOIN cbse_import.advanced_mock_unresolved_audit_backup_20261028 a ON a.source_question_id=m.source_question_id
  WHERE q.id IS NULL OR a.source_question_id IS NULL;
  IF nq<>1664 OR nm<>1664 OR na<>1664 OR nmissing<>0 THEN
     RAISE EXCEPTION 'Abort: archive verification failed. questions %, mapping %, audit %, missing %',nq,nm,na,nmissing;
  END IF;
END
$guard$;

-- 4. Delete ONLY archived, currently inactive, still unmapped source questions.
-- Their mapping rows cascade via the existing ON DELETE CASCADE FK.
DO $guard$
DECLARE removed_count bigint;
BEGIN
  DELETE FROM public.questions q
  USING cbse_import.advanced_mock_unresolved_questions_backup_20261028 b,
        cbse_import.advanced_mock_mapping_20261028 m
  WHERE q.id=b.id AND m.source_question_id=q.id
    AND m.proposed_chapter_id IS NULL
    AND q.is_active IS FALSE;
  GET DIAGNOSTICS removed_count=ROW_COUNT;
  IF removed_count<>1664 THEN
    RAISE EXCEPTION 'Abort: attempted source delete affected % rows, expected exactly 1664',removed_count;
  END IF;
END
$guard$;

-- 5. Remove only the corresponding obsolete private Stage 1 audit rows.
DO $guard$
DECLARE removed_count bigint;
BEGIN
  DELETE FROM cbse_import.advanced_mock_stage1_audit_20261028 a
  USING cbse_import.advanced_mock_unresolved_mapping_backup_20261028 b
  WHERE a.source_question_id=b.source_question_id;
  GET DIAGNOSTICS removed_count=ROW_COUNT;
  IF removed_count<>1664 THEN
     RAISE EXCEPTION 'Abort: audit cleanup affected % rows, expected exactly 1664',removed_count;
  END IF;
END
$guard$;

-- 6. Postconditions: no targeted questions remain; preserve all 7,442 mapped.
DO $guard$
DECLARE nq bigint; nm bigint; na bigint; nx bigint;
BEGIN
  SELECT count(*) INTO nq FROM public.questions q
    JOIN cbse_import.advanced_mock_unresolved_questions_backup_20261028 b ON b.id=q.id;
  SELECT count(*) INTO nm FROM cbse_import.advanced_mock_mapping_20261028;
  SELECT count(*) INTO na FROM cbse_import.advanced_mock_stage1_audit_20261028;
  SELECT count(*) INTO nx FROM cbse_import.advanced_mock_mapping_20261028
    WHERE proposed_chapter_id IS NULL;
  IF nq<>0 OR nm<>7442 OR na<>7442 OR nx<>0 THEN
    RAISE EXCEPTION 'Abort: postcheck failed. deleted IDs still present %, mapping %, audit %, unmapped %',
    nq,nm,na,nx;
  END IF;
END
$guard$;

COMMIT;

-- 7. Safe read-only verification after commit (execute separately if preferred):
SELECT (SELECT count(*) FROM cbse_import.advanced_mock_mapping_20261028) AS retained_source_mappings,
       (SELECT count(*) FROM cbse_import.advanced_mock_stage1_audit_20261028) AS retained_stage1_audits,
       (SELECT count(*) FROM cbse_import.advanced_mock_unresolved_questions_backup_20261028) AS archived_removed_questions,
       (SELECT count(*) FROM cbse_import.advanced_mock_mapping_20261028 WHERE proposed_chapter_id IS NULL) AS unresolved_remaining;
