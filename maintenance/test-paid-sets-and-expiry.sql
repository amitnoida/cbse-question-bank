BEGIN;
DO $test$
DECLARE acct record; sub bigint; p jsonb; m public.mock_papers; ex record; expected integer; paid_n integer;
BEGIN
 FOR acct IN SELECT u.id,u.email,sp.class_id FROM auth.users u JOIN public.student_profiles sp ON sp.id=u.id WHERE u.email ~ '^test_(8|9|10|11|12)_paid@gmail[.]com$' ORDER BY u.email LOOP
  PERFORM set_config('request.jwt.claim.sub',acct.id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',acct.id,'role','authenticated')::text,true);
  SELECT s.id INTO sub FROM public.subjects s JOIN public.chapters c ON c.subject_id=s.id JOIN public.questions q ON q.chapter_id=c.id
   WHERE s.class_id=acct.class_id AND s.is_active AND c.is_active AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD' AND q.question_type='MCQ'
   GROUP BY s.id HAVING count(*) FILTER(WHERE q.question_usage='MOCK')>=48 AND count(*) FILTER(WHERE q.question_usage='SHARED')>=12
   AND count(*) FILTER(WHERE q.question_usage IN ('PRACTICE','SHARED'))>60 ORDER BY s.id LIMIT 1;
  IF sub IS NULL THEN RAISE EXCEPTION 'Missing paid QA pool'; END IF;
  p:=public.cbse_start_practice_v2(sub,'{}',1);
  IF jsonb_array_length(p->'question_ids')<>60 THEN RAISE EXCEPTION 'Paid practice cap mismatch'; END IF;
  PERFORM public.cbse_finish_practice_secure_v1((p->>'id')::uuid);
  p:=public.cbse_start_practice_v2(sub,'{}',2);
  IF jsonb_array_length(p->'question_ids') NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Paid second set blocked'; END IF;
  m:=public.start_next_mock_paper_v3(sub,'{}');
  IF cardinality(m.question_ids)<>60 THEN RAISE EXCEPTION 'Paid mock not 60'; END IF;
  SELECT count(*) FILTER(WHERE question_usage='MOCK') INTO paid_n FROM public.questions WHERE id=ANY(m.question_ids);
  IF paid_n<>48 THEN RAISE EXCEPTION 'Full mock split not 48/12'; END IF;
  SELECT * INTO ex FROM public.mock_open_exam('full',m.id);
  -- Accelerate only the QA clock within this rollback transaction.
  UPDATE public.mock_exam_sessions SET started_at=clock_timestamp()-interval '61 minutes',deadline_at=clock_timestamp()-interval '1 minute' WHERE id=ex.session_id;
  PERFORM public.mock_finish_exam(ex.session_id);
  IF (SELECT status FROM public.mock_exam_sessions WHERE id=ex.session_id)<>'COMPLETED' THEN RAISE EXCEPTION 'Expired paper did not finalize'; END IF;
  m:=public.start_next_mock_paper_v3(sub,'{}');
  IF m.status<>'STARTED' THEN RAISE EXCEPTION 'Paid next mock blocked'; END IF;
  IF EXISTS(SELECT 1 FROM public.free_test_sets WHERE student_id=acct.id) THEN RAISE EXCEPTION 'Paid set consumed free allowance'; END IF;
 END LOOP;
END $test$;
ROLLBACK;
SELECT 'PASS: paid continuation, 60-question cap, 48/12 full mocks, expiry finalization; all five classes; rolled back' AS result;
