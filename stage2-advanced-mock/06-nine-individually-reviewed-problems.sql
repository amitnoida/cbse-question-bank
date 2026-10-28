-- Nine individually recalculated problem/answer reviews.
-- Only changes PRIVATE cbse_import review queue. Does not release or activate MCQs.
BEGIN;
DO $$
DECLARE changed integer;
BEGIN
 UPDATE cbse_import.advanced_mock_release_review_20261028 AS r
 SET review_status='VERIFIED',
     verified_at=clock_timestamp(),
     reviewer_note='Independent solution/content check 2026-10-28; '||v.evidence||
       '. This is reviewer-queue status only; Stage 2 release_approved remains FALSE.'
 FROM (VALUES
 (27445::bigint,'A'::text,'Parabola tangent ty=x+a*t^2 has intercepts -a*t^2 and a*t; area a^2*abs(t)^3/2'),
 (32980,'A','Atwood acceleration=(9-4)*10/(9+4)=50/13=3.846 m/s^2'),
 (34207,'A','Consecutive closed tube resonances differ by 0.32 m=half wavelength; v=2*520*0.32=332.8 m/s'),
 (31846,'D','Nernst E=0.8-0.0591*(-2)=0.9182 V'),
 (31988,'D','Kinetic-rate multiplier=2^2*5^2=100'),
 (27624,'D','Continuity limit a^2/2=2 implies a=+2 or -2'),
 (27856,'D','Substitute v=y/x: x dv/dx=v^2, v=1/(1-ln x); at x=sqrt(e), y=2sqrt(e)'),
 (33619,'D','Fixed-charge dielectric energy=(0.5*5e-6*80^2)/3=5.333 mJ'),
 (34177,'B','Zener current=(10-6)/300-6/1500=9.333 mA')
 ) AS v(source_question_id,expected_answer,evidence)
 JOIN public.questions q ON q.id=v.source_question_id
 WHERE r.source_question_id=v.source_question_id
   AND r.review_status='PENDING_ACADEMIC_REVIEW'
   AND q.correct_option::text=v.expected_answer
   AND q.is_active=FALSE;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed<>9 THEN
  RAISE EXCEPTION 'Expected exactly nine separately checked queue rows, changed % (rolled back)',changed;
 END IF;
END $$;
COMMIT;