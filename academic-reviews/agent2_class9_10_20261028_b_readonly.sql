-- Agent 2: Class 9/10 academic review handoff; READ ONLY. No production changes.
-- Candidate approvals: 1600,8704,2789. Agent 5 independently verifies before release.
BEGIN READ ONLY;
SELECT q.id,c.class_number,s.subject_name,ch.chapter_name,q.question_text,
       q.option_a,q.option_b,q.option_c,q.option_d,q.correct_option,q.explanation,
       q.content_review_status,q.media_ready,q.is_active
FROM public.questions q
JOIN public.chapters ch ON ch.id=q.chapter_id
JOIN public.subjects s ON s.id=ch.subject_id
JOIN public.classes c ON c.id=s.class_id
WHERE q.id IN (1600,8704,2789)
  AND c.class_number IN (9,10)
  AND q.is_active=false
  AND q.media_ready=true
ORDER BY q.id;
COMMIT;
-- No UPDATE is supplied because these candidates require no corrections,
-- and Agent 2 is not authorized to activate or update production records.
