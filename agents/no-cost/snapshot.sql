-- Authorized owner-only academic export. No student/profile/credential tables.
-- Export the single snapshot value as JSON; keep outside this public repository.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '30s';
WITH chapter_map AS (
 SELECT ch.id AS chapter_id, s.id AS subject_id,
 CASE cl.id WHEN 3 THEN 8 WHEN 1 THEN 9 WHEN 2 THEN 10 WHEN 4 THEN 11 WHEN 5 THEN 12 END AS class_number,
 s.subject_name, ch.chapter_name,
 (ch.is_active AND s.is_active AND cl.is_active) AS is_active
 FROM public.chapters ch JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes cl ON cl.id=s.class_id
 WHERE cl.id IN (3,1,2,4,5)
)
SELECT jsonb_build_object(
 'captured_at', now(),
 'chapters', (SELECT coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) FROM chapter_map c),
 'questions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
   'chapter_id', q.chapter_id, 'question_text', q.question_text, 'import_key', q.import_key)), '[]'::jsonb)
   FROM public.questions q)
) AS snapshot;
ROLLBACK;
