-- Controlled batch 4: eight Class 11 Chemistry questions verified against calculation, options and chapter.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='45s';
CREATE TEMP TABLE _approved_school_batch(id bigint PRIMARY KEY, answer char(1), answer_text text, reviewed_explanation text) ON COMMIT DROP;
INSERT INTO _approved_school_batch VALUES (14873,'D','13 neutrons','The number of neutrons is the mass number minus the atomic number: N = A - Z = 27 - 14 = 13. Neutrality determines the electron count, not the neutron count.'),
(14899,'C','72 electrons','The maximum electron capacity of a principal shell is 2n². For n = 6, the maximum number of electrons is 2 × 6² = 72.'),
(14902,'B','248 nm','Photon wavelength is lambda = hc/E. With hc approximately 1240 eV nm and E = 5 eV, lambda = 1240/5 = 248 nm.'),
(15235,'A','2520 J','Heat gained by water is q = mcΔT = 200 g × 4.2 J/(g K) × 3 K = 2520 J. A temperature rise of 3 °C equals 3 K.'),
(15244,'C','-200 J','In the chemistry sign convention, work on the expanding system is w = -Pext ΔV. With Pext = 2 bar and ΔV = +1 L, w = -2 L bar = -200 J.'),
(15278,'C','200 J','Energy absorbed by the calorimeter is q = Ccal ΔT = 40 J/K × 5 K = 200 J, using the stated heat capacity and temperature change.'),
(15382,'A','0.5','For the reaction A ⇌ B with one-to-one stoichiometry, the reaction quotient Qc = [B]/[A] = 0.1 M / 0.2 M = 0.5.'),
(15445,'B','1e-06','For MX(s) ⇌ M+(aq) + X-(aq), dissolution in pure water gives [M+] = [X-] = s. Therefore Ksp = s² = (0.001)² = 1 × 10^-6.');
DO $$ DECLARE n integer; BEGIN
 SELECT count(*) INTO n FROM public.questions q JOIN _approved_school_batch b ON b.id=q.id JOIN public.chapters ch ON ch.id=q.chapter_id JOIN public.subjects s ON s.id=ch.subject_id JOIN public.classes c ON c.id=s.class_id
 WHERE c.class_number=11 AND s.subject_name='Chemistry' AND q.is_active=false AND q.content_review_status='PENDING_REVIEW' AND q.media_ready AND q.question_type='MCQ' AND q.correct_option=b.answer AND (CASE b.answer WHEN 'A' THEN q.option_a WHEN 'B' THEN q.option_b WHEN 'C' THEN q.option_c ELSE q.option_d END)=b.answer_text AND ch.is_active AND s.is_active AND c.is_active AND length(b.reviewed_explanation)>=30;
 IF n<>8 THEN RAISE EXCEPTION 'Batch 4 preflight mismatch %, expected 8. No changes.',n; END IF;
 UPDATE public.questions q SET explanation=b.reviewed_explanation,content_review_status='TEST_READY',is_active=true,updated_at=now() FROM _approved_school_batch b WHERE q.id=b.id AND q.is_active=false AND q.content_review_status='PENDING_REVIEW' AND q.media_ready;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>8 THEN RAISE EXCEPTION 'Batch 4 changed % instead of 8',n; END IF;
END $$;
COMMIT;