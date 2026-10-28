-- Controlled Class 11 Chemistry batch 2: 9 verified basic-concept questions.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s';
DO $$
DECLARE n int; changed int;
BEGIN
 SELECT count(*) INTO n FROM public.questions q
 JOIN public.chapters ch ON q.chapter_id=ch.id JOIN public.subjects s ON ch.subject_id=s.id
 JOIN public.classes c ON s.class_id=c.id
 WHERE q.id IN (13934,13977,14030,14083,14117,14473,14486,14593,14670)
 AND c.class_number=11 AND s.subject_name='Chemistry'
 AND NOT q.is_active AND q.content_review_status='PENDING_REVIEW' AND q.media_ready
 AND ch.is_active AND s.is_active AND c.is_active
 AND q.question_type='MCQ' AND q.correct_option IN ('A','B','C','D');
 IF n<>9 THEN RAISE EXCEPTION 'Precondition failed, expected 9 got %',n;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.questions WHERE id=13934 AND correct_option='B' AND option_b='24 g')
 OR NOT EXISTS(SELECT 1 FROM public.questions WHERE id=13977 AND correct_option='B' AND option_b='48 g')
 OR NOT EXISTS(SELECT 1 FROM public.questions WHERE id=14030 AND correct_option='B' AND option_b='400 g')
 OR NOT EXISTS(SELECT 1 FROM public.questions WHERE id=14083 AND correct_option='C' AND option_c='8 elements')
 OR NOT EXISTS(SELECT 1 FROM public.questions WHERE id=14117 AND correct_option='C' AND option_c='8 elements')
 OR NOT EXISTS(SELECT 1 FROM public.questions WHERE id=14473 AND correct_option='D' AND option_d='0.5 mol')
 OR NOT EXISTS(SELECT 1 FROM public.questions WHERE id=14486 AND correct_option='C' AND option_c='2 mol')
 OR NOT EXISTS(SELECT 1 FROM public.questions WHERE id=14593 AND correct_option='C' AND option_c='3 mol')
 OR NOT EXISTS(SELECT 1 FROM public.questions WHERE id=14670 AND correct_option='C' AND option_c='3 mol')
 THEN RAISE EXCEPTION 'Verified keyed answer changed'; END IF;
 UPDATE public.questions SET explanation=CASE id
 WHEN 13934 THEN 'Use mass = amount in moles × molar mass. For 1.5 mol of CH4 with molar mass 16 g/mol, mass = 1.5 × 16 = 24 g.'
 WHEN 13977 THEN 'Use m = nM. Three moles of methane CH4 at 16 g per mole have mass 3 × 16 = 48 g.'
 WHEN 14030 THEN 'Calcium carbonate has the stated molar mass of 100 g/mol. Mass of 4 mol = 4 × 100 = 400 g.'
 WHEN 14083 THEN 'The second period runs from lithium (Li) through neon (Ne): Li, Be, B, C, N, O, F and Ne. It therefore contains eight elements.'
 WHEN 14117 THEN 'The third period contains Na, Mg, Al, Si, P, S, Cl and Ar. Counting these elements gives a total of eight.'
 WHEN 14473 THEN 'The number of moles is mass divided by molar mass: n = 14 g / (28 g/mol) = 0.5 mol of C2H4.'
 WHEN 14486 THEN 'Number of moles n = mass / molar mass = 200 g / (100 g/mol) = 2 mol of CaCO3.'
 WHEN 14593 THEN 'For water of molar mass 18 g/mol, the amount in 54 g is n=54/18 = 3 mol of H2O.'
 WHEN 14670 THEN 'Use n = m/M. A 120 g sample of NaOH with molar mass 40 g/mol contains 120/40 = 3 mol.'
 ELSE explanation END,
 content_review_status='TEST_READY',is_active=true,updated_at=now()
 WHERE id IN (13934,13977,14030,14083,14117,14473,14486,14593,14670)
 AND NOT is_active AND content_review_status='PENDING_REVIEW' AND media_ready;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>9 THEN RAISE EXCEPTION 'Update count %, expected 9',changed;END IF;
 IF (SELECT count(*) FROM public.questions WHERE id IN (13934,13977,14030,14083,14117,14473,14486,14593,14670) AND is_active AND media_ready AND content_review_status='TEST_READY' AND length(btrim(explanation))>=30)<>9
 THEN RAISE EXCEPTION 'Post-update gate failed';END IF;
END $$;
COMMIT;