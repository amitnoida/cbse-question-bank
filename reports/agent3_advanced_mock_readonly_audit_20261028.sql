-- Agent 3 final Advanced Mock audit (READ-ONLY)
-- 2026-10-28. Scope strictly destination_subject_id IN (18,22,23).
-- Production project: darfsuqfmmunxqiyqlvn
-- Individual review evidence: cbse_import.advanced_mock_agent3_review_20261028
-- Runtime release flags: cbse_import.advanced_mock_stage2_candidates_20261028
-- No DML or schema changes in this file.

-- A. Per-subject disposition and live-readiness reconciliation
WITH r AS (
  SELECT c.destination_subject_id AS sid, c.source_question_id,
         c.destination_chapter_id, c.release_approved, c.academic_verified,
         c.answer_verified, c.duplicate_cleared, c.media_verified,
         c.reviewed_at, c.media_blocked, c.duplicate_candidate, c.answer_issue,
         a.source_question_id AS review_id, a.review_outcome,
         a.academically_examined_this_round, a.release_approved AS review_released,
         q.is_active AS source_active, q.media_ready AS source_media_ready,
         q.question_text, q.option_a,q.option_b,q.option_c,q.option_d,q.correct_option,
         ch.subject_id AS chapter_subject_id, s.class_number
  FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
  JOIN public.questions q ON q.id=c.source_question_id
  JOIN public.chapters ch ON ch.id=c.destination_chapter_id
  JOIN public.subjects s ON s.id=c.destination_subject_id
  LEFT JOIN cbse_import.advanced_mock_agent3_review_20261028 a
    ON a.source_question_id=c.source_question_id
  WHERE c.destination_subject_id IN (18,22,23)
)
SELECT sid,
 COUNT(*) AS staged,
 COUNT(*) FILTER (WHERE review_id IS NULL) AS unaccounted,
 COUNT(*) FILTER (WHERE academically_examined_this_round) AS individually_examined,
 COUNT(*) FILTER (WHERE review_outcome='PREVIOUS_VERIFIED') AS earlier_verified,
 COUNT(*) FILTER (WHERE review_outcome='ACCEPT') AS accepted,
 COUNT(*) FILTER (WHERE review_outcome='REJECT' AND academically_examined_this_round) AS individual_rejects,
 COUNT(*) FILTER (WHERE review_outcome='REJECT' AND NOT academically_examined_this_round) AS numeric_template_screening_rejects_not_individually_verified,
 COUNT(*) FILTER (WHERE review_outcome='HOLD') AS holds,
 COUNT(*) FILTER (WHERE release_approved) AS live,
 COUNT(*) FILTER (WHERE release_approved AND
   (review_released IS DISTINCT FROM TRUE
    OR review_outcome NOT IN ('ACCEPT','PREVIOUS_VERIFIED')
    OR academic_verified IS DISTINCT FROM TRUE
    OR answer_verified IS DISTINCT FROM TRUE
    OR duplicate_cleared IS DISTINCT FROM TRUE
    OR media_verified IS DISTINCT FROM TRUE
    OR reviewed_at IS NULL OR source_active IS DISTINCT FROM FALSE
    OR source_media_ready IS DISTINCT FROM TRUE OR media_blocked
    OR duplicate_candidate OR answer_issue OR chapter_subject_id<>sid
    OR (sid=18 AND class_number<>11)
    OR (sid IN (22,23) AND class_number<>12)
    OR question_text ILIKE '%JEE%' OR question_text ILIKE '%NEET%')) AS unsafe_live
FROM r GROUP BY sid ORDER BY sid;

-- B. Any identical numeric templates in live sets? Expected: zero.
WITH live AS (
 SELECT c.destination_subject_id AS subject_id,c.destination_chapter_id AS chapter_id,
 c.source_question_id,
 regexp_replace(lower(regexp_replace(q.question_text,'[0-9]+([.][0-9]+)?','#','g')),'[[:space:]]+',' ','g') AS template
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id IN (18,22,23) AND c.release_approved
)
SELECT subject_id,chapter_id,template,count(*) AS n,
 array_agg(source_question_id ORDER BY source_question_id) AS IDs
FROM live GROUP BY subject_id,chapter_id,template HAVING count(*)>1
ORDER BY subject_id,chapter_id;

-- C. Exact question-level decision/evidence register (CSV export from SQL dashboard)
SELECT a.destination_subject_id, a.destination_chapter_id,a.source_question_id,
 a.review_outcome,a.academically_examined_this_round,
 a.review_basis,a.reviewed_at,a.release_approved
FROM cbse_import.advanced_mock_agent3_review_20261028 a
WHERE a.destination_subject_id IN (18,22,23)
ORDER BY a.destination_subject_id,a.destination_chapter_id,a.source_question_id;

-- D. Released exact IDs
SELECT c.destination_subject_id,c.destination_chapter_id,c.source_question_id,
 c.reviewed_at,c.reviewer_note
FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
WHERE c.destination_subject_id IN (18,22,23) AND c.release_approved
ORDER BY c.destination_subject_id,c.destination_chapter_id,c.source_question_id;

-- E. 60-question readiness and approved chapter breadth
SELECT s.id AS subject_id,s.class_number,s.subject_name,
 COUNT(DISTINCT ch.id) FILTER (WHERE ch.is_active) AS active_chapters,
 COUNT(DISTINCT c.destination_chapter_id) FILTER (WHERE c.release_approved) AS live_chapters,
 COUNT(DISTINCT c.source_question_id) FILTER (WHERE c.release_approved) AS live_questions,
 COUNT(DISTINCT c.source_question_id) FILTER (WHERE c.release_approved)>=60 AS meets_60
FROM public.subjects s JOIN public.chapters ch ON ch.subject_id=s.id
LEFT JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c
 ON c.destination_subject_id=s.id AND c.destination_chapter_id=ch.id
WHERE s.id IN (18,22,23)
GROUP BY s.id,s.class_number,s.subject_name ORDER BY s.id;
