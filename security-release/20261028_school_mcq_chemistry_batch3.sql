-- Class 11 Chemistry, controlled release batch 3; nine independently checked items.
-- Only previously inactive PENDING_REVIEW questions are modified. Existing active bank untouched.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
DO $guard$
DECLARE n integer; changed integer;
BEGIN
 SELECT count(*) INTO n FROM public.questions q
 JOIN public.chapters ch ON ch.id=q.chapter_id
 JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes c ON c.id=s.class_id
 WHERE q.id IN (14839,14872,14893,14898,14900,15043,15234,15240,15243)
 AND c.class_number=11 AND s.subject_name='Chemistry'
 AND q.content_review_status='PENDING_REVIEW' AND NOT q.is_active
 AND q.media_ready AND ch.is_active AND s.is_active AND c.is_active
 AND q.question_type='MCQ'
 AND ((q.id=14839 AND q.correct_option='C' AND q.option_c='-0.377778 eV')
 OR (q.id=14872 AND q.correct_option='A' AND q.option_a='23 neutrons')
 OR (q.id=14893 AND q.correct_option='A' AND q.option_a='Wavelength with momentum')
 OR (q.id=14898 AND q.correct_option='C' AND q.option_c='32 electrons')
 OR (q.id=14900 AND q.correct_option='C' AND q.option_c='1240 nm')
 OR (q.id=15043 AND q.correct_option='A' AND q.option_a='Calcium')
 OR (q.id=15234 AND q.correct_option='A' AND q.option_a='5040 J')
 OR (q.id=15240 AND q.correct_option='B' AND q.option_b='2 J K^-1')
 OR (q.id=15243 AND q.correct_option='C' AND q.option_c='-200 J'));
 IF n<>9 THEN RAISE EXCEPTION 'Preflight mismatch %, expected 9; no changes',n; END IF;
 UPDATE public.questions SET explanation=CASE id
 WHEN 14839 THEN 'For a hydrogen atom, E_n = -13.6/n² eV. At n=6, E_6 = -13.6/36 = approximately -0.377778 eV; the negative energy indicates a bound state.'
 WHEN 14872 THEN 'Neutron number equals mass number minus atomic number: N = A - Z = 35 - 12 = 23 neutrons. Electrical neutrality affects electron count, not this result.'
 WHEN 14893 THEN 'The de Broglie relation is λ = h/p. It connects the wavelength associated with a particle to its momentum, with Planck constant h.'
 WHEN 14898 THEN 'A principal electron shell of quantum number n can hold at most 2n² electrons. For n=4, the maximum is 2 × 4² = 32 electrons.'
 WHEN 14900 THEN 'The photon-energy relation is E = hc/λ. Therefore λ = hc/E = (1240 eV nm)/(1 eV) = 1240 nm.'
 WHEN 15043 THEN 'Calcium (Ca) is a Group 2 alkaline-earth metal. Potassium is Group 1, aluminium is Group 13, and chlorine is Group 17.'
 WHEN 15234 THEN 'Heat absorbed at constant specific heat is q = mcΔT = (150 g)(4.2 J g^-1 K^-1)(8 K) = 5040 J. The temperature rise of 8 °C equals 8 K.'
 WHEN 15240 THEN 'For a reversible isothermal heat transfer, entropy change is ΔS = q_rev/T = 500 J / 250 K = +2 J K^-1 for the system absorbing heat.'
 WHEN 15243 THEN 'Using the chemistry sign convention, pressure-volume work on the system is w = -P_extΔV = -(1 bar)(2 L) = -2 L bar = -200 J. Expansion does negative work on the system.'
 ELSE explanation END,
 content_review_status='TEST_READY',is_active=true,updated_at=now()
 WHERE id IN (14839,14872,14893,14898,14900,15043,15234,15240,15243)
 AND content_review_status='PENDING_REVIEW' AND NOT is_active AND media_ready;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>9 THEN RAISE EXCEPTION 'Actual updates %, expected 9; rollback',changed; END IF;
 IF (SELECT count(*) FROM public.questions WHERE id IN (14839,14872,14893,14898,14900,15043,15234,15240,15243)
 AND is_active AND media_ready AND content_review_status='TEST_READY' AND length(btrim(explanation))>=30)<>9
 THEN RAISE EXCEPTION 'Post-release validation failed'; END IF;
END $guard$;
COMMIT;