-- Dedicated QA accounts only. Every mutation is rolled back, including attempts.
BEGIN;
DO $test$
DECLARE acct record; sub bigint; chapters bigint[]; p jsonb; resumed jsonb; m public.mock_papers; m2 public.mock_papers;
 exam record; q bigint; aid bigint; expected integer; denied boolean; n integer; other_subject bigint;
BEGIN
 FOR acct IN SELECT u.id,u.email,sp.class_id FROM auth.users u JOIN public.student_profiles sp ON sp.id=u.id
 WHERE u.email ~ '^test_(8|9|10|11|12)_free@gmail[.]com$' ORDER BY u.email LOOP
  PERFORM set_config('request.jwt.claim.sub',acct.id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',acct.id,'role','authenticated')::text,true);
  SELECT c.subject_id,ARRAY[c.id] INTO sub,chapters FROM public.chapters c JOIN public.subjects s ON s.id=c.subject_id
  JOIN public.questions qs ON qs.chapter_id=c.id WHERE s.class_id=acct.class_id AND s.is_active AND c.is_active
   AND qs.is_active AND qs.media_ready AND qs.content_review_status<>'HOLD' AND qs.question_type='MCQ'
  GROUP BY c.subject_id,c.id HAVING count(*) FILTER(WHERE qs.question_usage IN ('PRACTICE','SHARED'))>0
   AND count(*) FILTER(WHERE qs.question_usage IN ('MOCK','SHARED'))>0 ORDER BY count(*),c.id LIMIT 1;
  IF sub IS NULL THEN RAISE EXCEPTION 'No eligible QA pool for %',acct.email; END IF;
  DELETE FROM public.free_test_sets WHERE student_id=acct.id;
  SELECT least(60,practice_count)::integer INTO expected FROM public.cbse_selection_counts_v1(sub,chapters);
  p:=public.cbse_start_practice_v2(sub,chapters,1);
  IF jsonb_array_length(p->'question_ids')<>expected THEN RAISE EXCEPTION 'Practice size mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.questions WHERE id IN(SELECT value::bigint FROM jsonb_array_elements_text(p->'question_ids')) AND (NOT chapter_id=ANY(chapters) OR question_usage='MOCK')) THEN RAISE EXCEPTION 'Practice escaped chapter/category'; END IF;
  resumed:=public.cbse_start_practice_v2(sub,'{}',1);
  IF resumed->>'id'<>p->>'id' THEN RAISE EXCEPTION 'Changed filters bypassed free reservation'; END IF;
  aid:=public.cbse_finish_practice_secure_v1((p->>'id')::uuid);
  IF public.cbse_finish_practice_secure_v1((p->>'id')::uuid)<>aid THEN RAISE EXCEPTION 'Non-idempotent practice finish'; END IF;
  denied:=false; BEGIN PERFORM public.cbse_start_practice_v2(sub,'{}',1); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Second free Practice allowed'; END IF;
  -- The independent Mock allowance remains usable after Practice is consumed.
  SELECT least(60,mock_count)::integer INTO expected FROM public.cbse_selection_counts_v1(sub,chapters);
  m:=public.start_next_mock_paper_v3(sub,chapters);
  IF cardinality(m.question_ids)<>expected THEN RAISE EXCEPTION 'Mock size mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM public.questions WHERE id=ANY(m.question_ids) AND (NOT chapter_id=ANY(chapters) OR question_usage='PRACTICE')) THEN RAISE EXCEPTION 'Mock escaped chapter/category'; END IF;
  m2:=public.start_next_mock_paper_v3(sub,'{}');
  IF m.id<>m2.id THEN RAISE EXCEPTION 'Changed filters bypassed free Mock'; END IF;
  SELECT * INTO exam FROM public.mock_open_exam('full',m.id);
  denied:=false; BEGIN PERFORM public.mock_finish_exam(exam.session_id); EXCEPTION WHEN raise_exception THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Early incomplete mock submitted'; END IF;
  FOREACH q IN ARRAY m.question_ids LOOP PERFORM public.mock_save_answer(exam.session_id,q,'A'); END LOOP;
  aid:=public.mock_finish_exam(exam.session_id);
  IF public.mock_finish_exam(exam.session_id)<>aid THEN RAISE EXCEPTION 'Non-idempotent mock finish'; END IF;
  denied:=false; BEGIN PERFORM public.start_next_mock_paper_v3(sub,'{}'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Second free Mock allowed'; END IF;
  IF (SELECT count(*) FROM public.free_test_sets WHERE student_id=acct.id AND subject_id=sub AND completed_at IS NOT NULL)<>2 THEN RAISE EXCEPTION 'Completion ledger mismatch'; END IF;
  SELECT id INTO other_subject FROM public.subjects WHERE class_id<>acct.class_id AND is_active LIMIT 1;
  denied:=false; BEGIN PERFORM public.cbse_start_practice_v2(other_subject,'{}',1); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-class Practice allowed'; END IF;
  denied:=false; BEGIN PERFORM public.start_next_mock_paper_v3(other_subject,'{}'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Cross-class Mock allowed'; END IF;
  RAISE NOTICE '%: chapter cap, category isolation, resume, independent allowances, idempotence and access guards PASS',acct.email;
 END LOOP;
END $test$;
ROLLBACK;
SELECT 'PASS: all five free class accounts; mutations rolled back' AS result;
