-- Controlled school MCQ release batch 1; Class 11 Chemistry only.
-- Question-level checks and rollback: BEGIN/COMMIT; records in cbse_import.master_rows.
-- Keep all existing active questions untouched; only named inactive PENDING_REVIEW IDs.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$
DECLARE v_pre integer; v_changed integer; v_post integer;
BEGIN
 SELECT count(*) INTO v_pre FROM public.questions q
 JOIN public.chapters ch ON ch.id=q.chapter_id
 JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes c ON c.id=s.class_id
 WHERE q.id IN (13782,13791,14258,14324,14836,14837,14838)
   AND c.class_number=11 AND s.subject_name='Chemistry'
   AND q.is_active=false AND q.content_review_status='PENDING_REVIEW'
   AND q.media_ready=true AND q.question_type='MCQ'
   AND q.correct_option IN ('A','B','C','D')
   AND q.question_usage IN ('PRACTICE','MOCK','SHARED')
   AND ch.is_active AND s.is_active AND c.is_active;
 IF v_pre<>7 THEN RAISE EXCEPTION 'Preflight count %, expected 7',v_pre; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.questions WHERE id=14258 AND question_text='A 0.2 L solution of H2O has concentration 1 mol L^-1. What is the amount of dissolved H2O?' AND correct_option='B' AND option_b='0.2 mol')
 OR NOT EXISTS(SELECT 1 FROM public.questions WHERE id=14324 AND question_text='A 0.4 L solution of H2O has concentration 0.75 mol L^-1. What is the amount of dissolved H2O?' AND correct_option='C' AND option_c='0.3 mol')
 THEN RAISE EXCEPTION 'H2O question source no longer matches review'; END IF;

 UPDATE public.questions SET
 question_text=CASE id
 WHEN 14258 THEN 'A 0.20 L aqueous solution of sodium chloride (NaCl) has molarity 1.0 mol L^-1. How many moles of NaCl solute are present?'
 WHEN 14324 THEN 'A 0.40 L aqueous solution of sodium chloride (NaCl) has molarity 0.75 mol L^-1. How many moles of NaCl solute are present?'
 ELSE question_text END,
 explanation=CASE id
 WHEN 13782 THEN 'The balanced stoichiometric ratio is 3 mol product per 1 mol limiting reactant. For 2 mol of limiting reactant, the product amount is 3 × 2 = 6 mol.'
 WHEN 13791 THEN 'The reaction yields 4 mol product for each mole of limiting reactant. With 0.5 mol limiting reactant fully consumed, product = 4 × 0.5 = 2 mol.'
 WHEN 14258 THEN 'Molarity M = n/V, so n = M × V. The solution volume is 0.20 L and NaCl molarity is 1.0 mol L^-1; n = 1.0 × 0.20 = 0.20 mol of NaCl.'
 WHEN 14324 THEN 'Use n = M × V, with solution volume in litres: n = 0.75 mol L^-1 × 0.40 L = 0.30 mol of dissolved NaCl.'
 WHEN 14836 THEN 'For hydrogen, E_n = -13.6/n² eV. At principal quantum number n=1, E_1=-13.6/1=-13.6 eV relative to a free electron at infinity.'
 WHEN 14837 THEN 'For the hydrogen atom, E_n=-13.6/n² eV. At n=2, E_2=-13.6/4=-3.4 eV; the negative sign indicates a bound electron.'
 WHEN 14838 THEN 'The Bohr model gives E_n=-13.6/n² eV for hydrogen. At n=4, E_4=-13.6/16=-0.85 eV relative to the ionization limit.'
 ELSE explanation END,
 content_review_status='TEST_READY',
 is_active=true,
 updated_at=now()
 WHERE id IN (13782,13791,14258,14324,14836,14837,14838)
   AND is_active=false AND content_review_status='PENDING_REVIEW'
   AND media_ready=true;
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>7 THEN RAISE EXCEPTION 'Updated %, expected 7',v_changed; END IF;
 SELECT count(*) INTO v_post FROM public.questions
 WHERE id IN (13782,13791,14258,14324,14836,14837,14838)
 AND is_active AND content_review_status='TEST_READY' AND media_ready
 AND length(btrim(explanation))>=30;
 IF v_post<>7 THEN RAISE EXCEPTION 'Post-check %, expected 7',v_post; END IF;
END $$;
COMMIT;