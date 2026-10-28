-- Agent 1 Advanced Mock Class XI Physics production release, 2026-10-28 (IST)
-- ARCHIVED AUDIT COPY. THE TWO TRANSACTIONS HAVE ALREADY BEEN EXECUTED IN PRODUCTION.
-- DO NOT RE-RUN. This script is safe-failing on already-released exact IDs.
-- Source public.questions are intentionally left inactive.
-- Approved review evidence: cbse_import.advanced_mock_agent1_review_20261028
-- No cross-subject, UI, Standard Mock or Practice modifications.

-- batch_1: exact approved source IDs: 28056, 28168, 28677
-- Historical transaction already executed. Re-running aborts unless all exact IDs are eligible and unreleased.
DO $agent1$
DECLARE
  before_physics integer;
  after_physics integer;
  before_biology integer;
  after_biology integer;
  eligible integer;
  changed integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('agent1-advanced-mock-subject-19',0));
  SELECT count(*) INTO before_physics
  FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
  JOIN public.questions q ON q.id=c.source_question_id
  WHERE c.destination_subject_id=19 AND c.release_approved
    AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared
    AND c.media_verified AND c.reviewed_at IS NOT NULL
    AND c.source_content_review_status<>'HOLD' AND q.is_active=FALSE AND q.media_ready=TRUE;
  SELECT count(*) INTO before_biology
  FROM cbse_import.advanced_mock_stage2_candidates_20261028
  WHERE destination_subject_id=16 AND release_approved;
  SELECT count(*) INTO eligible
  FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
  JOIN cbse_import.advanced_mock_agent1_review_20261028 r ON r.source_question_id=c.source_question_id
  JOIN public.questions q ON q.id=c.source_question_id
  JOIN public.chapters ch ON ch.id=c.destination_chapter_id
  JOIN public.subjects s ON s.id=c.destination_subject_id
  WHERE c.source_question_id IN (28056,28168,28677)
    AND c.destination_subject_id=19 AND s.class_number=11 AND ch.subject_id=19
    AND r.destination_subject_id=19 AND r.destination_chapter_id=c.destination_chapter_id
    AND r.review_status='ACCEPTED' AND r.release_permitted AND r.independently_checked
    AND c.release_approved=FALSE AND c.academic_verified=FALSE AND c.answer_verified=FALSE
    AND c.duplicate_cleared=FALSE AND c.media_verified=FALSE
    AND c.audit_disposition='MAPPED_READY_FOR_REVIEW'
    AND c.source_media_ready AND NOT c.media_blocked AND NOT c.answer_issue AND NOT c.duplicate_candidate
    AND c.source_content_review_status='PENDING_REVIEW'
    AND q.is_active=FALSE AND q.media_ready=TRUE AND q.correct_option IN ('A','B','C','D')
    AND q.explanation IS NOT NULL
    AND q.option_a IS NOT NULL AND q.option_b IS NOT NULL AND q.option_c IS NOT NULL AND q.option_d IS NOT NULL;
  IF eligible<>3 THEN RAISE EXCEPTION 'Agent1 batch_1: expected 3 eligible IDs, got %; rollback',eligible; END IF;
  UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c
  SET academic_verified=TRUE, answer_verified=TRUE,
      duplicate_cleared=TRUE, media_verified=TRUE, release_approved=TRUE,
      reviewed_at=clock_timestamp(),
      reviewer_note='Agent1 individual AI-assisted content/options/answer/explanation check; see cbse_import.advanced_mock_agent1_review_20261028'
  FROM cbse_import.advanced_mock_agent1_review_20261028 r, public.questions q, public.chapters ch
  WHERE c.source_question_id IN (28056,28168,28677)
    AND c.destination_subject_id=19
    AND c.source_question_id=r.source_question_id AND c.source_question_id=q.id
    AND c.destination_chapter_id=ch.id AND ch.subject_id=19
    AND r.destination_subject_id=19 AND r.review_status='ACCEPTED'
    AND r.release_permitted AND r.independently_checked
    AND c.release_approved=FALSE AND c.academic_verified=FALSE
    AND c.audit_disposition='MAPPED_READY_FOR_REVIEW'
    AND NOT c.media_blocked AND NOT c.duplicate_candidate AND NOT c.answer_issue
    AND q.is_active=FALSE AND q.media_ready=TRUE;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>3 THEN RAISE EXCEPTION 'Agent1 batch_1: expected 3 updates, got %, rollback',changed; END IF;
  SELECT count(*) INTO after_physics
  FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
  JOIN public.questions q ON q.id=c.source_question_id
  WHERE c.destination_subject_id=19 AND c.release_approved
    AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared
    AND c.media_verified AND c.reviewed_at IS NOT NULL
    AND c.source_content_review_status<>'HOLD' AND q.is_active=FALSE AND q.media_ready=TRUE;
  SELECT count(*) INTO after_biology
  FROM cbse_import.advanced_mock_stage2_candidates_20261028
  WHERE destination_subject_id=16 AND release_approved;
  IF after_physics<>before_physics+3 OR after_biology<>before_biology THEN
    RAISE EXCEPTION 'Agent1 batch_1: subject count changed unexpectedly, rollback';
  END IF;
END
$agent1$;

-- batch_2: exact approved source IDs: 28043, 28191, 28494, 28521, 28644
-- Historical transaction already executed. Re-running aborts unless all exact IDs are eligible and unreleased.
DO $agent1$
DECLARE
  before_physics integer;
  after_physics integer;
  before_biology integer;
  after_biology integer;
  eligible integer;
  changed integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('agent1-advanced-mock-subject-19',0));
  SELECT count(*) INTO before_physics
  FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
  JOIN public.questions q ON q.id=c.source_question_id
  WHERE c.destination_subject_id=19 AND c.release_approved
    AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared
    AND c.media_verified AND c.reviewed_at IS NOT NULL
    AND c.source_content_review_status<>'HOLD' AND q.is_active=FALSE AND q.media_ready=TRUE;
  SELECT count(*) INTO before_biology
  FROM cbse_import.advanced_mock_stage2_candidates_20261028
  WHERE destination_subject_id=16 AND release_approved;
  SELECT count(*) INTO eligible
  FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
  JOIN cbse_import.advanced_mock_agent1_review_20261028 r ON r.source_question_id=c.source_question_id
  JOIN public.questions q ON q.id=c.source_question_id
  JOIN public.chapters ch ON ch.id=c.destination_chapter_id
  JOIN public.subjects s ON s.id=c.destination_subject_id
  WHERE c.source_question_id IN (28043,28191,28494,28521,28644)
    AND c.destination_subject_id=19 AND s.class_number=11 AND ch.subject_id=19
    AND r.destination_subject_id=19 AND r.destination_chapter_id=c.destination_chapter_id
    AND r.review_status='ACCEPTED' AND r.release_permitted AND r.independently_checked
    AND c.release_approved=FALSE AND c.academic_verified=FALSE AND c.answer_verified=FALSE
    AND c.duplicate_cleared=FALSE AND c.media_verified=FALSE
    AND c.audit_disposition='MAPPED_READY_FOR_REVIEW'
    AND c.source_media_ready AND NOT c.media_blocked AND NOT c.answer_issue AND NOT c.duplicate_candidate
    AND c.source_content_review_status='PENDING_REVIEW'
    AND q.is_active=FALSE AND q.media_ready=TRUE AND q.correct_option IN ('A','B','C','D')
    AND q.explanation IS NOT NULL
    AND q.option_a IS NOT NULL AND q.option_b IS NOT NULL AND q.option_c IS NOT NULL AND q.option_d IS NOT NULL;
  IF eligible<>5 THEN RAISE EXCEPTION 'Agent1 batch_2: expected 5 eligible IDs, got %; rollback',eligible; END IF;
  UPDATE cbse_import.advanced_mock_stage2_candidates_20261028 c
  SET academic_verified=TRUE, answer_verified=TRUE,
      duplicate_cleared=TRUE, media_verified=TRUE, release_approved=TRUE,
      reviewed_at=clock_timestamp(),
      reviewer_note='Agent1 individual AI-assisted content/options/answer/explanation check; see cbse_import.advanced_mock_agent1_review_20261028'
  FROM cbse_import.advanced_mock_agent1_review_20261028 r, public.questions q, public.chapters ch
  WHERE c.source_question_id IN (28043,28191,28494,28521,28644)
    AND c.destination_subject_id=19
    AND c.source_question_id=r.source_question_id AND c.source_question_id=q.id
    AND c.destination_chapter_id=ch.id AND ch.subject_id=19
    AND r.destination_subject_id=19 AND r.review_status='ACCEPTED'
    AND r.release_permitted AND r.independently_checked
    AND c.release_approved=FALSE AND c.academic_verified=FALSE
    AND c.audit_disposition='MAPPED_READY_FOR_REVIEW'
    AND NOT c.media_blocked AND NOT c.duplicate_candidate AND NOT c.answer_issue
    AND q.is_active=FALSE AND q.media_ready=TRUE;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>5 THEN RAISE EXCEPTION 'Agent1 batch_2: expected 5 updates, got %, rollback',changed; END IF;
  SELECT count(*) INTO after_physics
  FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
  JOIN public.questions q ON q.id=c.source_question_id
  WHERE c.destination_subject_id=19 AND c.release_approved
    AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared
    AND c.media_verified AND c.reviewed_at IS NOT NULL
    AND c.source_content_review_status<>'HOLD' AND q.is_active=FALSE AND q.media_ready=TRUE;
  SELECT count(*) INTO after_biology
  FROM cbse_import.advanced_mock_stage2_candidates_20261028
  WHERE destination_subject_id=16 AND release_approved;
  IF after_physics<>before_physics+5 OR after_biology<>before_biology THEN
    RAISE EXCEPTION 'Agent1 batch_2: subject count changed unexpectedly, rollback';
  END IF;
END
$agent1$;
