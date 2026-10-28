-- Concurrency-safe revised batch 2: ONLY four still-inactive Class 11 Chemistry questions.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$
DECLARE n int; changed int;
BEGIN
 SELECT count(*) INTO n FROM public.questions q JOIN public.chapters ch ON ch.id=q.chapter_id JOIN public.subjects s ON s.id=ch.subject_id JOIN public.classes c ON c.id=s.class_id
 WHERE q.id IN (14473,14486,14593,14670) AND c.class_number=11 AND s.subject_name='Chemistry' AND q.content_review_status='PENDING_REVIEW' AND NOT q.is_active AND q.media_ready AND ch.is_active AND s.is_active AND c.is_active
 AND ((q.id=14473 AND q.correct_option='D' AND q.option_d='0.5 mol') OR (q.id=14486 AND q.correct_option='C' AND q.option_c='2 mol') OR (q.id IN (14593,14670) AND q.correct_option='C' AND q.option_c='3 mol'));
 IF n<>4 THEN RAISE EXCEPTION 'Preflight mismatch %',n; END IF;
 UPDATE public.questions SET explanation=CASE id
 WHEN 14473 THEN 'The number of moles is mass divided by molar mass: n = 14 g / (28 g/mol) = 0.5 mol of C2H4.'
 WHEN 14486 THEN 'Number of moles n = mass / molar mass = 200 g / (100 g/mol) = 2 mol of CaCO3.'
 WHEN 14593 THEN 'For water of molar mass 18 g/mol, the amount in 54 g is n = 54/18 = 3 mol of H2O.'
 WHEN 14670 THEN 'Use n = m/M. A 120 g sample of NaOH with molar mass 40 g/mol contains 120/40 = 3 mol.'
 ELSE explanation END,content_review_status='TEST_READY',is_active=true,updated_at=now()
 WHERE id IN (14473,14486,14593,14670) AND NOT is_active AND content_review_status='PENDING_REVIEW' AND media_ready;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>4 THEN RAISE EXCEPTION 'Unexpected change count %',changed;END IF;
END $$;
COMMIT;