-- Stage 1 audit utilities (28 Oct 2026). READ ONLY.
-- No UPDATE, INSERT, DELETE, CREATE, ALTER, DROP or Stage 2 execution.
-- Supabase project darfsuqfmmunxqiyqlvn.
-- Queries are separated intentionally: execute one small diagnostic at a time.

-- 1. Staging inventory and chapter mapping status.
SELECT m.match_status,m.review_status,count(*) AS question_count
FROM cbse_import.advanced_mock_mapping_20261028 m
GROUP BY 1,2 ORDER BY 1,2;

-- 2. Destination invariants: Class 11 or 12, matching subject, active destination.
SELECT count(*) AS mapped_count,
 count(*) FILTER (WHERE c.class_number NOT IN (11,12) OR c.class_number IS NULL) AS invalid_class_count,
 count(*) FILTER (WHERE s.subject_name IS DISTINCT FROM m.source_subject) AS subject_mismatch_count,
 count(*) FILTER (WHERE ch.is_active IS NOT TRUE OR s.is_active IS NOT TRUE) AS inactive_destination_count
FROM cbse_import.advanced_mock_mapping_20261028 m
JOIN public.chapters ch ON ch.id=m.proposed_chapter_id
JOIN public.subjects s ON s.id=ch.subject_id
JOIN public.classes c ON c.id=s.class_id
WHERE m.proposed_chapter_id IS NOT NULL;

-- 3. Unresolved source topic counts. Interpret composite chapters as needing question-level classification.
SELECT source_exam,source_subject,source_chapter,match_status,count(*) n
FROM cbse_import.advanced_mock_mapping_20261028
WHERE proposed_chapter_id IS NULL
GROUP BY 1,2,3,4 ORDER BY 2,1,3;

-- 4. Conservative per-question academic release gate (authoritative non-approvals).
-- "MAPPED_READY_FOR_REVIEW" DOES NOT MEAN APPROVED FOR STUDENTS.
SELECT m.source_question_id,m.source_exam,m.source_subject,m.source_chapter,
       m.proposed_chapter_id,m.match_status,m.review_status,
       a.disposition,a.duplicate_candidate,a.media_blocked,a.answer_issue,
       q.content_review_status,q.media_ready,q.is_active,
       CASE WHEN q.is_active IS TRUE THEN 'INVARIANT_BREACH_ACTIVE_SOURCE'
            WHEN a.answer_issue IS TRUE THEN 'BLOCKED_ANSWER_FORMAT'
            WHEN a.media_blocked IS TRUE OR q.media_ready IS NOT TRUE THEN 'BLOCKED_MEDIA'
            WHEN a.duplicate_candidate IS TRUE THEN 'BLOCKED_DUPLICATE_CANDIDATE'
            WHEN q.content_review_status='HOLD' THEN 'BLOCKED_EXISTING_HOLD'
            WHEN m.proposed_chapter_id IS NULL THEN 'BLOCKED_CHAPTER_UNRESOLVED'
            ELSE 'AWAITING_QUESTION_LEVEL_ACADEMIC_APPROVAL' END AS stage1_release_gate
FROM cbse_import.advanced_mock_mapping_20261028 m
JOIN cbse_import.advanced_mock_stage1_audit_20261028 a USING(source_question_id)
JOIN public.questions q ON q.id=m.source_question_id
ORDER BY m.source_question_id;
-- For connector limits, add source_question_id BETWEEN :start_id AND :end_id and page in batches.

-- 5. Validity by shape (NOT academic answer-key proof).
SELECT count(*) FILTER(WHERE q.correct_option NOT IN ('A','B','C','D') OR q.correct_option IS NULL) invalid_keys,
 count(*) FILTER(WHERE q.question_text IS NULL OR btrim(q.question_text)='') blank_stems,
 count(*) FILTER(WHERE q.option_a IS NULL OR q.option_b IS NULL OR q.option_c IS NULL OR q.option_d IS NULL OR btrim(q.option_a)='' OR btrim(q.option_b)='' OR btrim(q.option_c)='' OR btrim(q.option_d)='') missing_options
FROM cbse_import.advanced_mock_mapping_20261028 m
JOIN public.questions q ON q.id=m.source_question_id;

-- 6. Duplicate flags and media reference format.
SELECT count(*) AS total,
 count(*) FILTER(WHERE a.duplicate_candidate) preliminary_duplicate_candidates,
 count(*) FILTER(WHERE a.media_blocked) flagged_media_blocked,
 count(*) FILTER(WHERE q.question_text ILIKE '%](assets/%') markdown_relative_assets,
 count(*) FILTER(WHERE q.question_text ILIKE '%<img%') html_image_refs,
 count(*) FILTER(WHERE q.is_active) source_active
FROM cbse_import.advanced_mock_mapping_20261028 m
JOIN cbse_import.advanced_mock_stage1_audit_20261028 a USING(source_question_id)
JOIN public.questions q ON q.id=m.source_question_id;

-- 7. Only strict normalized exact duplicates among source rows; not semantic duplicates.
WITH x AS (
 SELECT regexp_replace(lower(btrim(q.question_text)),E'\\s+',' ','g') norm
 FROM cbse_import.advanced_mock_mapping_20261028 m
 JOIN public.questions q ON q.id=m.source_question_id
), repeated AS (SELECT count(*) n FROM x GROUP BY norm HAVING count(*)>1)
SELECT count(*) duplicate_groups,coalesce(sum(n-1),0) redundant_copies FROM repeated;

-- 8. Student profiles remain linked to competitive classes (retirement blocker).
SELECT count(*) AS competitive_class_student_profiles
FROM public.student_profiles WHERE class_id IN (6,7,8);
