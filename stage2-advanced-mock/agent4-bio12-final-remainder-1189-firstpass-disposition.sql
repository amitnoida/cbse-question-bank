-- Agent 4 / Class XII Biology only (destination_subject_id=20): close first-pass selection queue.
-- This is triage, NOT independent per-MCQ academic verification of remaining 1189 questions.
-- User instruction: do not spend time correcting ambiguous/basic/repetitive questions.
-- No modification of public.questions or Stage2 candidate release flags.
BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 (
 source_question_id bigint PRIMARY KEY,
 destination_chapter_id bigint NOT NULL,
 first_pass_disposition text NOT NULL CHECK (first_pass_disposition IN (
  'SKIP_FOUR_STATEMENT_DIVERSITY_CAP','SKIP_TWO_STATEMENT_TOO_BASIC',
  'SKIP_DIRECT_DEFINITION','SKIP_REPEATED_FORMULA','SKIP_OTHER_NOT_SELECTED',
  'HOLD_EXISTING_SOURCE_BLOCKER')),
 individual_academic_answer_verified boolean NOT NULL DEFAULT FALSE
    CHECK (individual_academic_answer_verified=FALSE),
 reviewed_basis text NOT NULL DEFAULT 'GROUPED_FIRSTPASS_SELECTION_NOT_INDIVIDUAL_ANSWER_VERIFICATION',
 human_teacher_certified boolean NOT NULL DEFAULT FALSE CHECK(human_teacher_certified=FALSE),
 release_approved boolean NOT NULL DEFAULT FALSE CHECK(release_approved=FALSE),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 FROM PUBLIC,anon,authenticated;
WITH prev AS (
 SELECT source_question_id FROM cbse_import.advanced_mock_biology12_substantive_review_20261028
 UNION SELECT source_question_id FROM cbse_import.advanced_mock_biology12_substantive_review_round2_20261028
 UNION SELECT source_question_id FROM cbse_import.advanced_mock_biology12_substantive_review_round3_20261028
 UNION SELECT source_question_id FROM cbse_import.advanced_mock_agent4_bio12_review_round4_20261028
 UNION SELECT source_question_id FROM cbse_import.advanced_mock_agent4_bio12_review_round5_20261028
 UNION SELECT source_question_id FROM cbse_import.advanced_mock_agent4_bio12_review_round6_20261028
 UNION SELECT source_question_id FROM cbse_import.advanced_mock_agent4_bio12_review_round7_20261028
), pending AS (
 SELECT c.source_question_id,c.destination_chapter_id,q.question_text,q.media_ready,c.source_media_ready,
 c.media_blocked,c.answer_issue,c.duplicate_candidate,c.source_content_review_status,q.question_media
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id LEFT JOIN prev p USING(source_question_id)
 WHERE c.destination_subject_id=20 AND p.source_question_id IS NULL AND NOT c.release_approved
), classified AS (
 SELECT source_question_id,destination_chapter_id,
 CASE
 WHEN question_text LIKE 'Which of the following statements are correct?%' THEN 'SKIP_FOUR_STATEMENT_DIVERSITY_CAP'
 WHEN question_text LIKE 'Read Statements I and II%' THEN 'SKIP_TWO_STATEMENT_TOO_BASIC'
 WHEN media_blocked OR answer_issue OR duplicate_candidate OR source_content_review_status='HOLD' OR NOT media_ready OR NOT source_media_ready THEN 'HOLD_EXISTING_SOURCE_BLOCKER'
 WHEN question_text ILIKE 'Identify the biological term described as:%' THEN 'SKIP_DIRECT_DEFINITION'
 WHEN question_text ILIKE 'A PCR reaction starts%' OR question_text ILIKE 'Producer GPP%' OR
      question_text ILIKE 'At an autosomal two-allele locus%' OR question_text ILIKE 'A double-stranded DNA molecule%' OR
      question_text ILIKE 'DNA initially labelled on both strands%' OR question_text ILIKE 'If % primary spermatocytes%' OR
      question_text ILIKE 'A population initially contains%' OR question_text ILIKE 'AaBb plants self-pollinate%'
 THEN 'SKIP_REPEATED_FORMULA'
 ELSE 'SKIP_OTHER_NOT_SELECTED' END disposition
 FROM pending
)
INSERT INTO cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028
 (source_question_id,destination_chapter_id,first_pass_disposition)
SELECT source_question_id,destination_chapter_id,disposition FROM classified
ON CONFLICT(source_question_id) DO NOTHING;
DO $$
DECLARE n integer; ch integer; active_or_live integer; all_total integer; reviewed_total integer;
BEGIN
 SELECT COUNT(*),COUNT(DISTINCT destination_chapter_id) INTO n,ch
 FROM cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028;
 IF n<>1189 OR ch<>13 THEN
  RAISE EXCEPTION 'Biology remainder must have 1189 IDs across 13 chapters; got % in %',n,ch;
 END IF;
 IF (SELECT COUNT(*) FROM cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 WHERE first_pass_disposition='HOLD_EXISTING_SOURCE_BLOCKER')<>96
 OR (SELECT COUNT(*) FROM cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 WHERE first_pass_disposition='SKIP_FOUR_STATEMENT_DIVERSITY_CAP')<>349
 OR (SELECT COUNT(*) FROM cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 WHERE first_pass_disposition='SKIP_TWO_STATEMENT_TOO_BASIC')<>491
 OR (SELECT COUNT(*) FROM cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 WHERE first_pass_disposition='SKIP_DIRECT_DEFINITION')<>122
 OR (SELECT COUNT(*) FROM cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 WHERE first_pass_disposition='SKIP_REPEATED_FORMULA')<>57
 OR (SELECT COUNT(*) FROM cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 WHERE first_pass_disposition='SKIP_OTHER_NOT_SELECTED')<>74
 THEN RAISE EXCEPTION 'Remainder category counts changed; rollback'; END IF;
 SELECT COUNT(*) INTO active_or_live
 FROM cbse_import.advanced_mock_agent4_bio12_remainder_disposition_20261028 r
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c USING(source_question_id)
 WHERE c.release_approved OR c.destination_subject_id<>20;
 IF active_or_live<>0 THEN RAISE EXCEPTION 'Triage inadvertently contains approved/wrong-subject candidate rows'; END IF;
 SELECT count(*) INTO all_total FROM cbse_import.advanced_mock_stage2_candidates_20261028 WHERE destination_subject_id=20;
 IF all_total<>1462 THEN RAISE EXCEPTION 'Biology pool unexpectedly changed: %',all_total; END IF;
END $$;
COMMIT;