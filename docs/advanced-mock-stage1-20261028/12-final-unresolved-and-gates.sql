-- Final Stage 1 read-only reporting and remaining review queue.
-- Production project darfsuqfmmunxqiyqlvn; 28 October 2026.
-- DO NOT perform Stage 2 source question activation, migration or class retirement.
-- Each SELECT can be executed separately, in small bounded calls.

-- 1. Reconcile live final staging counts.
SELECT COUNT(*) source_total,
COUNT(*) FILTER(WHERE proposed_chapter_id IS NOT NULL) provisional_mapped,
COUNT(*) FILTER(WHERE proposed_chapter_id IS NULL) unresolved,
COUNT(*) FILTER(WHERE mapping_note ILIKE '%question-text%') question_text_rule_candidates
FROM cbse_import.advanced_mock_mapping_20261028;

-- 2. All unassigned groups (40 at final checkpoint).
SELECT source_exam,source_subject,source_chapter,match_status,review_status,COUNT(*) n
FROM cbse_import.advanced_mock_mapping_20261028
WHERE proposed_chapter_id IS NULL
GROUP BY 1,2,3,4,5 ORDER BY source_subject,source_exam,source_chapter;

-- 3. Staging academic gates across all source rows (0 released).
SELECT a.disposition,COUNT(*) n,
COUNT(*) FILTER(WHERE a.duplicate_candidate) duplicate_candidates,
COUNT(*) FILTER(WHERE a.media_blocked) media_blocked
FROM cbse_import.advanced_mock_stage1_audit_20261028 a
GROUP BY a.disposition ORDER BY a.disposition;

-- 4. Paged per-question academic eligibility queue. Run in 200-ID chunks.
-- Increment OFFSET on subsequent pages; SQL always read-only.
SELECT m.source_question_id,m.source_exam,m.source_subject,m.source_chapter,
m.proposed_chapter_id,m.review_status,m.mapping_note,
a.disposition,a.duplicate_candidate,a.media_blocked,
q.content_review_status,q.is_active,q.media_ready,
CASE WHEN q.is_active THEN 'UNEXPECTED_ACTIVE_SOURCE_STOP'
 WHEN a.media_blocked OR q.media_ready IS NOT TRUE THEN 'MEDIA_QA_REQUIRED'
 WHEN a.duplicate_candidate THEN 'DUPLICATE_REVIEW_REQUIRED'
 WHEN m.proposed_chapter_id IS NULL THEN 'CHAPTER_REVIEW_REQUIRED'
 WHEN q.content_review_status='HOLD' THEN 'CONTENT_HOLD_REVIEW_REQUIRED'
 ELSE 'ACADEMIC_ANSWER_SYLLABUS_REVIEW_REQUIRED'
END AS stage1_academic_gate
FROM cbse_import.advanced_mock_mapping_20261028 m
JOIN cbse_import.advanced_mock_stage1_audit_20261028 a USING(source_question_id)
JOIN public.questions q ON q.id=m.source_question_id
ORDER BY m.source_question_id LIMIT 200 OFFSET 0;

-- 5. Verify mapping/audit synchronization after any future Stage 1 work.
SELECT COUNT(*) mismatched_rows FROM cbse_import.advanced_mock_mapping_20261028 m
FULL JOIN cbse_import.advanced_mock_stage1_audit_20261028 a USING(source_question_id)
WHERE m.source_question_id IS NULL OR a.source_question_id IS NULL
OR m.proposed_chapter_id IS DISTINCT FROM a.proposed_chapter_id;

-- 6. Verify proposed destination subjects and grades.
SELECT COUNT(*) invalid_destination_rows
FROM cbse_import.advanced_mock_mapping_20261028 m
JOIN public.chapters ch ON ch.id=m.proposed_chapter_id
JOIN public.subjects s ON s.id=ch.subject_id
JOIN public.classes c ON c.id=s.class_id
WHERE c.class_number NOT IN (11,12)
OR s.subject_name IS DISTINCT FROM m.source_subject
OR NOT coalesce(ch.is_active,false)
OR NOT coalesce(s.is_active,false);

-- 7. Confirm zero source questions activated.
SELECT COUNT(*) activated_source_rows
FROM cbse_import.advanced_mock_mapping_20261028 m
JOIN public.questions q ON q.id=m.source_question_id
WHERE q.is_active IS TRUE;

-- 8. Confirm known competitive-class retirement blocker remains visible.
SELECT COUNT(*) competitive_student_profiles
FROM public.student_profiles WHERE class_id IN(6,7,8);

-- 9. Explicit duplicate cross-bank exact-stem pairs resolved in a small scoped audit.
-- The destination IDs below are unchanged active school questions.
SELECT a.source_question_id,a.duplicate_candidate,
       x.school_question_id,q.is_active AS school_question_active
FROM cbse_import.advanced_mock_stage1_audit_20261028 a
JOIN (VALUES(26401::bigint,3967::bigint),
            (26402,3970),(26403,3968),(32830,2213))
     AS x(source_id,school_question_id)
     ON x.source_id=a.source_question_id
JOIN public.questions q ON q.id=x.school_question_id
ORDER BY a.source_question_id;

-- 10. Image-dependent sources only; never assume images are retrievable by URL.
SELECT m.source_question_id,m.source_exam,m.source_subject,
       left(q.question_text,250) question_preview,q.media_ready,
       a.media_blocked
FROM cbse_import.advanced_mock_mapping_20261028 m
JOIN public.questions q ON q.id=m.source_question_id
JOIN cbse_import.advanced_mock_stage1_audit_20261028 a USING(source_question_id)
WHERE a.media_blocked IS TRUE
ORDER BY m.source_question_id LIMIT 100;
