BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n
 FROM public.questions q JOIN public.chapters ch ON ch.id=q.chapter_id
 JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes c ON c.id=s.class_id
 WHERE q.id IN (14289,14312,14336,14407)
 AND c.class_number=11 AND s.subject_name='Chemistry'
 AND NOT q.is_active AND q.content_review_status='PENDING_REVIEW'
 AND q.media_ready AND q.question_type='MCQ'
 AND ch.is_active AND s.is_active AND c.is_active
 AND ((q.id=14289 AND q.correct_option='B' AND q.option_b='0.25 mol')
 OR (q.id=14312 AND q.correct_option='C' AND q.option_c='0.4 mol')
 OR (q.id=14336 AND q.correct_option='A' AND q.option_a='37.5 %')
 OR (q.id=14407 AND q.correct_option='A' AND q.option_a='62.5 %'));
 IF n<>4 THEN RAISE EXCEPTION 'Preflight mismatch, found %, expected four',n;END IF;
 UPDATE public.questions q SET explanation=CASE q.id
 WHEN 14289 THEN 'Molarity gives the amount of solute divided by solution volume in litres. Therefore n = M × V = 1.25 mol/L × 0.20 L = 0.25 mol of NH3.'
 WHEN 14312 THEN 'Use n = M × V for dissolved solute. With NaOH concentration 2.0 mol/L and volume 0.20 L, n = 2.0 × 0.20 = 0.40 mol.'
 WHEN 14336 THEN 'The total mass of the compound is 3 g + 5 g = 8 g. Element X contributes 3 g, so its mass percentage is (3/8) × 100 = 37.5%.'
 WHEN 14407 THEN 'The compound has total mass 5 g + 3 g = 8 g. Element X contributes 5 g, giving (5/8) × 100 = 62.5% by mass.'
 ELSE q.explanation END,
 content_review_status='TEST_READY',is_active=true,updated_at=now()
 WHERE q.id IN (14289,14312,14336,14407) AND NOT q.is_active AND q.content_review_status='PENDING_REVIEW' AND q.media_ready;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>4 THEN RAISE EXCEPTION 'Updated %, expected four',n;END IF;
END $$;
COMMIT;