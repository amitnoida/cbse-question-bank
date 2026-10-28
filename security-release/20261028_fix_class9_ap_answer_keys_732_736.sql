-- Production answer-key corrections found by independent arithmetic audit, 28 Oct 2026.
-- The saved quiz_attempt_answers row for QID 732 contains correct_answer='D'
-- with selected_answer=NULL. Historical attempt snapshots are deliberately
-- untouched: only the source question bank's future answer key is corrected.
-- Original values: QID 732 correct_option D, QID 736 correct_option A.
-- New values: QID 732 A (8+4*3=20), QID 736 B (2+9*3=29).
BEGIN;
DO $guard$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM public.questions
  WHERE (id=732 AND chapter_id=183 AND correct_option='D'
     AND question_text='The 1st term of an AP is 8 and d=3. The 5th term is'
     AND option_a='20' AND explanation='a5=8+4×3=20.' AND is_active)
     OR (id=736 AND chapter_id=183 AND correct_option='A'
     AND question_text='The 10th term of 2,5,8,... is'
     AND option_b='29' AND explanation='a10=2+9×3=29.' AND is_active);
  IF n <> 2 THEN
    RAISE EXCEPTION 'Source questions changed since verification; found %, expected 2', n;
  END IF;
  UPDATE public.questions SET
    correct_option=CASE id WHEN 732 THEN 'A'::char(1) WHEN 736 THEN 'B'::char(1) ELSE correct_option END,
    updated_at=now()
  WHERE id IN (732,736);
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>2 THEN
    RAISE EXCEPTION 'Update count %, expected 2', n;
  END IF;
END
$guard$;
COMMIT;
