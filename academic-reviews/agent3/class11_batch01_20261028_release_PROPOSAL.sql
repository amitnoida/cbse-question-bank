-- Agent 3 batch 01: proposal only, DO NOT execute in Agent 3.
-- Agent 5 only: independently verify and approve before executing.
-- Guard all source text, correct answer, timestamp, scope and inactive flag.
BEGIN;
DO $review$
DECLARE changed integer;
BEGIN
  WITH expected(id,original_text,answer,reviewed_at) AS (
    VALUES
    (14700::bigint,'0.4 mol of C2H6 is dissolved to make 2 L of solution. Calculate molarity.','D'::char(1),'2026-10-27 05:46:18.490876+00'::timestamptz),
    (15238::bigint,'50 g of liquid water gains 6 °C; take c=4.2 J g^-1 K^-1. Find the heat absorbed.','D'::char(1),'2026-10-27 05:46:18.490876+00'::timestamptz)
  ), accepted AS (
    UPDATE public.questions q SET is_active = TRUE, updated_at = now()
    FROM expected e JOIN public.chapters c ON TRUE JOIN public.subjects s ON s.id=c.subject_id
    WHERE q.id=e.id AND q.chapter_id=c.id AND s.class_number=11
      AND lower(s.subject_name) IN ('chemistry','mathematics','physics')
      AND q.is_active IS FALSE AND q.question_text=e.original_text
      AND q.correct_option=e.answer AND q.updated_at=e.reviewed_at
    RETURNING q.id
  ) SELECT count(*) INTO changed FROM accepted;
  IF changed<>2 THEN RAISE EXCEPTION 'Agent 3 batch 01: guarded update expected 2 rows, got %, rolling back',changed; END IF;
END $review$;
COMMIT;
-- Agent 5 post-check: SELECT id,is_active FROM public.questions WHERE id IN (14700,15238) ORDER BY id;
