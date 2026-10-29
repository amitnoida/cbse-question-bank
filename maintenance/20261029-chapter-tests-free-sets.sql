
-- One permanently reserved Practice set and Mock set per student/subject.
-- Old ten-question counters do not consume the new set entitlement.
ALTER TABLE public.practice_sessions ADD COLUMN IF NOT EXISTS chapter_ids bigint[] NOT NULL DEFAULT '{}';
ALTER TABLE public.mock_papers ADD COLUMN IF NOT EXISTS chapter_ids bigint[] NOT NULL DEFAULT '{}';
ALTER TABLE public.mock_papers DROP CONSTRAINT mock_papers_question_ids_check;
ALTER TABLE public.mock_papers ADD CONSTRAINT mock_papers_question_ids_check CHECK(cardinality(question_ids) BETWEEN 1 AND 60);
DROP INDEX public.practice_sessions_one_active_set;
CREATE UNIQUE INDEX practice_sessions_one_active_scope ON public.practice_sessions(student_id,subject_id,coalesce(chapter_id,0),chapter_ids,set_number) WHERE status='IN_PROGRESS';
CREATE TABLE public.free_test_sets (
 student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
 subject_id bigint NOT NULL REFERENCES public.subjects(id),
 test_type text NOT NULL CHECK(test_type IN ('PRACTICE','MOCK')),
 practice_session_id uuid,
 mock_paper_id uuid,
 completed_at timestamptz,
 reserved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(student_id,subject_id,test_type),
 CHECK((test_type='PRACTICE' AND practice_session_id IS NOT NULL AND mock_paper_id IS NULL)
    OR (test_type='MOCK' AND mock_paper_id IS NOT NULL AND practice_session_id IS NULL))
);
ALTER TABLE public.free_test_sets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.free_test_sets FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.free_test_sets TO authenticated;
CREATE POLICY free_test_sets_read_own ON public.free_test_sets FOR SELECT TO authenticated USING(student_id=(SELECT auth.uid()));
-- Allowance rows intentionally outlive 14-day result/session cleanup.
DROP POLICY practice_retention_14_days ON public.practice_sessions;
CREATE POLICY practice_retention_14_days ON public.practice_sessions AS RESTRICTIVE FOR SELECT TO authenticated USING(status='IN_PROGRESS' OR updated_at>=now()-interval '14 days');
-- Session allocation and immutable assignments must only be written through RPCs.
REVOKE INSERT,UPDATE,DELETE ON public.practice_sessions,public.mock_papers FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.cbse_start_practice_v2(p_subject_id bigint,p_chapter_ids bigint[],p_set_number integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE u uuid:=auth.uid(); paid boolean; chapters bigint[]; s public.practice_sessions; ids bigint[]; reserved uuid;
BEGIN
 IF u IS NULL OR NOT public.is_active_student() THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subjects sub JOIN public.student_profiles sp ON sp.class_id=sub.class_id
 JOIN public.classes cl ON cl.id=sub.class_id WHERE sub.id=p_subject_id AND sp.id=u AND sub.is_active AND cl.is_active)
 THEN RAISE EXCEPTION 'Subject unavailable' USING ERRCODE='42501'; END IF;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO chapters FROM unnest(coalesce(p_chapter_ids,'{}')) x;
 IF EXISTS(SELECT 1 FROM unnest(chapters) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM public.chapters c WHERE c.id=x AND c.subject_id=p_subject_id AND c.is_active))
 THEN RAISE EXCEPTION 'Chapter does not belong to subject'; END IF;
 IF p_set_number IS NULL OR p_set_number NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Invalid set number'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':'||p_subject_id::text,0));
 paid:=public.cbse_is_paid_for_subject_v1(u);
 IF NOT paid THEN
  SELECT practice_session_id INTO reserved FROM public.free_test_sets WHERE student_id=u AND subject_id=p_subject_id AND test_type='PRACTICE';
  IF FOUND THEN
   SELECT * INTO s FROM public.practice_sessions WHERE id=reserved AND student_id=u;
   IF s.status='IN_PROGRESS' THEN RETURN to_jsonb(s); END IF;
   RAISE EXCEPTION 'Your free Practice set for this subject is completed. Membership unlocks more sets.' USING ERRCODE='42501';
  END IF;
  IF p_set_number<>1 THEN RAISE EXCEPTION 'One free Practice set per subject'; END IF;
  -- Adopt an unfinished pre-release assignment without discarding its answers.
  SELECT * INTO s FROM public.practice_sessions WHERE student_id=u AND subject_id=p_subject_id AND status='IN_PROGRESS' ORDER BY created_at LIMIT 1;
 ELSE
  SELECT * INTO s FROM public.practice_sessions ps WHERE student_id=u AND subject_id=p_subject_id AND status='IN_PROGRESS'
  AND set_number=p_set_number AND (CASE WHEN cardinality(ps.chapter_ids)>0 THEN ps.chapter_ids WHEN ps.chapter_id IS NOT NULL THEN ARRAY[ps.chapter_id] ELSE '{}'::bigint[] END)=chapters
  ORDER BY created_at DESC LIMIT 1;
 END IF;
 IF s.id IS NULL THEN
  SELECT array_agg(qid ORDER BY qid) INTO ids FROM (
   SELECT q.id qid FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
   WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD'
   AND q.question_type='MCQ' AND q.question_usage IN ('PRACTICE','SHARED')
   AND (cardinality(chapters)=0 OR q.chapter_id=ANY(chapters)) ORDER BY q.id OFFSET ((p_set_number-1)*60) LIMIT 60
  ) chosen;
  IF coalesce(cardinality(ids),0)=0 THEN RAISE EXCEPTION 'No eligible questions in this set'; END IF;
  INSERT INTO public.practice_sessions(student_id,subject_id,chapter_id,chapter_ids,set_number,question_ids,answers,current_index,status)
  VALUES(u,p_subject_id,CASE WHEN cardinality(chapters)=1 THEN chapters[1] ELSE NULL END,chapters,p_set_number,ids,'{}',0,'IN_PROGRESS') RETURNING * INTO s;
 END IF;
 IF NOT paid THEN INSERT INTO public.free_test_sets(student_id,subject_id,test_type,practice_session_id) VALUES(u,p_subject_id,'PRACTICE',s.id); END IF;
 RETURN to_jsonb(s);
END $fn$;
CREATE OR REPLACE FUNCTION public.cbse_start_practice_v1(p_subject_id bigint,p_chapter_id bigint,p_set_number integer)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$
 SELECT public.cbse_start_practice_v2(p_subject_id,CASE WHEN p_chapter_id IS NULL THEN '{}'::bigint[] ELSE ARRAY[p_chapter_id] END,p_set_number);
$fn$;

CREATE OR REPLACE FUNCTION public.start_next_mock_paper_v3(p_subject_id bigint,p_chapter_ids bigint[])
RETURNS public.mock_papers LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE u uuid:=auth.uid(); paid boolean; chapters bigint[]; paper public.mock_papers; reserved uuid;
 n integer; nm integer; ns integer; take_m integer; take_s integer; ids bigint[]; num integer;
BEGIN
 IF u IS NULL OR NOT public.is_active_student() THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subjects sub JOIN public.student_profiles sp ON sp.class_id=sub.class_id
 JOIN public.classes cl ON cl.id=sub.class_id WHERE sub.id=p_subject_id AND sp.id=u AND sub.is_active AND cl.is_active)
 THEN RAISE EXCEPTION 'Subject unavailable' USING ERRCODE='42501'; END IF;
 SELECT coalesce(array_agg(DISTINCT x ORDER BY x),'{}') INTO chapters FROM unnest(coalesce(p_chapter_ids,'{}')) x;
 IF EXISTS(SELECT 1 FROM unnest(chapters) x WHERE x IS NULL OR NOT EXISTS(SELECT 1 FROM public.chapters c WHERE c.id=x AND c.subject_id=p_subject_id AND c.is_active)) THEN RAISE EXCEPTION 'Chapter does not belong to subject'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(u::text||':mock:'||p_subject_id::text,0));
 paid:=public.cbse_is_paid_for_subject_v1(u);
 IF NOT paid THEN
  SELECT mock_paper_id INTO reserved FROM public.free_test_sets WHERE student_id=u AND subject_id=p_subject_id AND test_type='MOCK';
  IF FOUND THEN
   SELECT * INTO paper FROM public.mock_papers WHERE id=reserved AND student_id=u;
   IF paper.status='STARTED' THEN RETURN paper; END IF;
   RAISE EXCEPTION 'Your free Mock set for this subject is completed. Membership unlocks more sets.' USING ERRCODE='42501';
  END IF;
 END IF;
 -- Always resume an open subject mock, even when the filter has changed.
 SELECT * INTO paper FROM public.mock_papers WHERE student_id=u AND subject_id=p_subject_id AND status='STARTED' ORDER BY started_at LIMIT 1;
 IF paper.id IS NULL THEN
  SELECT count(*) FILTER(WHERE q.question_usage='MOCK'),count(*) FILTER(WHERE q.question_usage='SHARED') INTO nm,ns
  FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
  WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD'
  AND q.question_type='MCQ' AND (cardinality(chapters)=0 OR q.chapter_id=ANY(chapters));
  n:=least(60,nm+ns);
  IF n=0 THEN RAISE EXCEPTION 'No eligible mock questions in this selection'; END IF;
  -- Prefer the 80/20 split, filling shortages from the other eligible category.
  take_s:=least(ns,round(n*0.2)::integer); take_m:=least(nm,n-take_s); take_s:=least(ns,n-take_m);
  WITH ranked AS (
   SELECT q.id,q.question_usage,row_number() OVER(PARTITION BY q.question_usage ORDER BY
    CASE WHEN EXISTS(SELECT 1 FROM public.mock_question_coverage cv WHERE cv.student_id=u AND cv.subject_id=p_subject_id AND cv.question_id=q.id)
    OR EXISTS(SELECT 1 FROM public.mock_papers prev WHERE prev.student_id=u AND prev.subject_id=p_subject_id AND q.id=ANY(prev.question_ids)) THEN 1 ELSE 0 END,random()) rn
   FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
   WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD'
   AND q.question_type='MCQ' AND q.question_usage IN ('MOCK','SHARED') AND (cardinality(chapters)=0 OR q.chapter_id=ANY(chapters))
  ) SELECT array_agg(id ORDER BY random()) INTO ids FROM ranked WHERE (question_usage='MOCK' AND rn<=take_m) OR (question_usage='SHARED' AND rn<=take_s);
  IF cardinality(ids)<>n OR n<>(SELECT count(DISTINCT x) FROM unnest(ids)x) THEN RAISE EXCEPTION 'Invalid mock assignment'; END IF;
  SELECT coalesce(max(paper_number),0)+1 INTO num FROM public.mock_papers WHERE student_id=u AND subject_id=p_subject_id;
  INSERT INTO public.mock_papers(student_id,subject_id,paper_number,question_ids,status,allocation_version,chapter_ids)
  VALUES(u,p_subject_id,num,ids,'STARTED',3,chapters) RETURNING * INTO paper;
  INSERT INTO public.mock_question_coverage(student_id,subject_id,question_id) SELECT u,p_subject_id,x FROM unnest(ids)x ON CONFLICT DO NOTHING;
 END IF;
 IF NOT paid THEN INSERT INTO public.free_test_sets(student_id,subject_id,test_type,mock_paper_id) VALUES(u,p_subject_id,'MOCK',paper.id); END IF;
 RETURN paper;
END $fn$;
CREATE OR REPLACE FUNCTION public.start_next_mock_paper_v2(p_subject_id bigint)
RETURNS public.mock_papers LANGUAGE sql SECURITY INVOKER SET search_path='' AS $fn$
 SELECT public.start_next_mock_paper_v3(p_subject_id,'{}'::bigint[]);
$fn$;

CREATE OR REPLACE FUNCTION public.cbse_selection_counts_v1(p_subject_id bigint,p_chapter_ids bigint[])
RETURNS TABLE(practice_count bigint,mock_count bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() OR NOT EXISTS(SELECT 1 FROM public.subjects sub JOIN public.student_profiles sp ON sp.class_id=sub.class_id WHERE sub.id=p_subject_id AND sp.id=auth.uid() AND sub.is_active)
 THEN RAISE EXCEPTION 'Subject unavailable' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT count(*) FILTER(WHERE q.question_usage IN ('PRACTICE','SHARED')),count(*) FILTER(WHERE q.question_usage IN ('MOCK','SHARED'))
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD' AND q.question_type='MCQ'
 AND (coalesce(cardinality(p_chapter_ids),0)=0 OR q.chapter_id=ANY(p_chapter_ids));
END $fn$;

CREATE OR REPLACE FUNCTION public.cbse_finish_practice_secure_v1(p_session_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  s public.practice_sessions%ROWTYPE;
  v_student uuid := auth.uid();
  v_attempt bigint;
  v_paid boolean;
  v_n integer;
  v_used integer;
  v_correct integer;
  v_answered integer;
  v_total numeric;
  v_marks numeric;
  v_chapter bigint;
BEGIN
  IF v_student IS NULL OR NOT public.is_active_student() THEN
    RAISE EXCEPTION 'Active student account required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM public.practice_sessions
  WHERE id=p_session_id AND student_id=v_student FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Practice session not found' USING ERRCODE='42501'; END IF;
  -- A second submit returns the existing result rather than charging twice.
  IF s.status='COMPLETED' THEN
    SELECT id INTO v_attempt FROM public.quiz_attempts
    WHERE student_id=v_student AND quiz_type='PRACTICE'
      AND started_at=s.started_at AND subject_id=s.subject_id
    ORDER BY id DESC LIMIT 1;
    IF v_attempt IS NULL THEN RAISE EXCEPTION 'Completed session has no history'; END IF;
    RETURN v_attempt;
  END IF;
  IF s.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'Invalid session status'; END IF;
  v_n:=cardinality(s.question_ids);
  IF v_n<1 OR (s.chapter_id IS NULL AND v_n>60) OR v_n<>(SELECT count(DISTINCT id) FROM unnest(s.question_ids) AS ids(id)) THEN
    RAISE EXCEPTION 'Invalid question assignment';
  END IF;
  IF v_n<>(SELECT count(*) FROM unnest(s.question_ids) ids(id)
    JOIN public.questions q ON q.id=ids.id
    JOIN public.chapters c ON c.id=q.chapter_id AND c.subject_id=s.subject_id
    WHERE s.chapter_id IS NULL OR q.chapter_id=s.chapter_id) THEN
    RAISE EXCEPTION 'Question assignment does not match the subject/chapter';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(s.answers) keys(key)
    WHERE NOT EXISTS (SELECT 1 FROM unnest(s.question_ids) ids(id) WHERE ids.id::text=keys.key)) THEN
    RAISE EXCEPTION 'Answers contain unassigned questions';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_each(s.answers) kv(key,value)
    WHERE kv.value <> 'null'::jsonb AND kv.value NOT IN ('"A"'::jsonb,'"B"'::jsonb,'"C"'::jsonb,'"D"'::jsonb)) THEN
    RAISE EXCEPTION 'Invalid answer value';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.subscriptions sub
    WHERE sub.student_id=v_student AND sub.status='ACTIVE'
      AND sub.start_date<=now() AND (sub.end_date IS NULL OR sub.end_date>now())) INTO v_paid;
  SELECT count(*) FILTER(WHERE a.selected IS NOT NULL),
         count(*) FILTER(WHERE a.selected=trim(upper(q.correct_option))),
         coalesce(sum(q.marks),0),
         coalesce(sum(CASE WHEN a.selected=trim(upper(q.correct_option)) THEN q.marks ELSE 0 END),0),
         CASE WHEN count(DISTINCT q.chapter_id)=1 THEN min(q.chapter_id) ELSE NULL END
  INTO v_answered,v_correct,v_total,v_marks,v_chapter
  FROM unnest(s.question_ids) ids(id)
  JOIN public.questions q ON q.id=ids.id
  CROSS JOIN LATERAL (SELECT nullif(trim(upper(s.answers->>q.id::text)),'') AS selected) a;
  INSERT INTO public.quiz_attempts(student_id,subject_id,chapter_id,quiz_type,total_questions,
    answered_questions,correct_answers,wrong_answers,unanswered_questions,total_marks,obtained_marks,
    percentage,status,started_at,submitted_at,time_taken_seconds)
  VALUES(v_student,s.subject_id,v_chapter,'PRACTICE',v_n,v_answered,v_correct,
    v_answered-v_correct,v_n-v_answered,v_total,v_marks,
    CASE WHEN v_total>0 THEN round(100*v_marks/v_total,2) ELSE 0 END,
    'COMPLETED',s.started_at,now(),greatest(0,extract(epoch FROM now()-s.started_at)::integer))
  RETURNING id INTO v_attempt;
  INSERT INTO public.quiz_attempt_answers(attempt_id,question_id,selected_answer,correct_answer,
    is_correct,marks_obtained,answered_at)
  SELECT v_attempt,q.id,a.selected,trim(upper(q.correct_option)),
    a.selected IS NOT NULL AND a.selected=trim(upper(q.correct_option)),
    CASE WHEN a.selected=trim(upper(q.correct_option)) THEN q.marks ELSE 0 END,
    CASE WHEN a.selected IS NOT NULL THEN now() ELSE NULL END
  FROM unnest(s.question_ids) ids(id)
  JOIN public.questions q ON q.id=ids.id
  CROSS JOIN LATERAL (SELECT nullif(trim(upper(s.answers->>q.id::text)),'') AS selected) a;
  UPDATE public.practice_sessions SET status='COMPLETED',updated_at=now() WHERE id=s.id;
  UPDATE public.free_test_sets SET completed_at=now() WHERE practice_session_id=s.id AND student_id=v_student AND test_type='PRACTICE';
  RETURN v_attempt;
END;
$function$;

CREATE OR REPLACE FUNCTION public._mock_finalize_locked(p_session_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.mock_exam_sessions%ROWTYPE; ids bigint[]; n integer; a_id bigint; paper_status text;
BEGIN
 SELECT * INTO s FROM public.mock_exam_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
 IF s.status='COMPLETED' THEN RETURN s.quiz_attempt_id; END IF;
 IF s.kind='full' THEN SELECT question_ids,status INTO ids,paper_status FROM public.mock_papers WHERE id=s.paper_id AND student_id=s.student_id FOR UPDATE;
 ELSE SELECT question_ids,status INTO ids,paper_status FROM public.chapter_mock_papers WHERE id=s.paper_id AND student_id=s.student_id FOR UPDATE; END IF;
 IF paper_status IS DISTINCT FROM 'STARTED' THEN RAISE EXCEPTION 'Paper has already been completed outside this session'; END IF;
 IF ids IS NULL THEN RAISE EXCEPTION 'Assigned paper not found'; END IF;
 n:=cardinality(ids);
 IF n < 1 OR (s.kind='full' AND n>60) OR n<> (SELECT count(DISTINCT qid) FROM unnest(ids) AS qid) THEN
  RAISE EXCEPTION 'Invalid assigned question set';
 END IF;
 IF (SELECT count(*) FROM public.questions q WHERE q.id=ANY(ids)) <> n THEN
  RAISE EXCEPTION 'One or more assigned questions are missing';
 END IF;
 -- The entire result, its answer rows and the paper completion are one transaction.
 WITH scores AS (
  SELECT q.id,q.chapter_id,COALESCE(q.marks,1) AS marks,trim(upper(q.correct_option)) AS correct,
   a.selected_answer
  FROM unnest(ids) x(id) JOIN public.questions q ON q.id=x.id
  LEFT JOIN public.mock_exam_answers a ON a.session_id=s.id AND a.question_id=q.id
 )
 INSERT INTO public.quiz_attempts(student_id,subject_id,chapter_id,quiz_type,total_questions,
  answered_questions,correct_answers,wrong_answers,unanswered_questions,total_marks,obtained_marks,percentage,
  status,started_at,submitted_at,time_taken_seconds)
 SELECT s.student_id,s.subject_id,
  CASE WHEN count(DISTINCT chapter_id)=1 THEN min(chapter_id) ELSE NULL END,
  'MOCK',n,count(selected_answer),count(*) FILTER(WHERE selected_answer=correct),
  count(*) FILTER(WHERE selected_answer IS NOT NULL AND selected_answer<>correct),
  count(*) FILTER(WHERE selected_answer IS NULL),COALESCE(sum(marks),0),
  COALESCE(sum(CASE WHEN selected_answer=correct THEN marks ELSE 0 END),0),
  CASE WHEN COALESCE(sum(marks),0)>0 THEN round(100*sum(CASE WHEN selected_answer=correct THEN marks ELSE 0 END)/sum(marks),2) ELSE 0 END,
  'COMPLETED',s.started_at,LEAST(clock_timestamp(),s.deadline_at),
  LEAST(EXTRACT(EPOCH FROM(s.deadline_at-s.started_at))::integer,GREATEST(0,EXTRACT(EPOCH FROM(clock_timestamp()-s.started_at))::integer))
 FROM scores RETURNING id INTO a_id;
 INSERT INTO public.quiz_attempt_answers(attempt_id,question_id,selected_answer,correct_answer,is_correct,marks_obtained,answered_at)
 SELECT a_id,q.id,a.selected_answer,trim(upper(q.correct_option)),
  a.selected_answer IS NOT NULL AND a.selected_answer=trim(upper(q.correct_option)),
  CASE WHEN a.selected_answer=trim(upper(q.correct_option)) THEN COALESCE(q.marks,1) ELSE 0 END,a.answered_at
 FROM unnest(ids) x(id) JOIN public.questions q ON q.id=x.id
 LEFT JOIN public.mock_exam_answers a ON a.session_id=s.id AND a.question_id=q.id;
 IF s.kind='full' THEN
  UPDATE public.mock_papers SET status='COMPLETED',completed_at=clock_timestamp(),quiz_attempt_id=a_id::text WHERE id=s.paper_id AND student_id=s.student_id;
 ELSE
  UPDATE public.chapter_mock_papers SET status='COMPLETED',completed_at=clock_timestamp(),quiz_attempt_id=a_id::text WHERE id=s.paper_id AND student_id=s.student_id;
 END IF;
 UPDATE public.mock_exam_sessions SET status='COMPLETED',completed_at=clock_timestamp(),quiz_attempt_id=a_id WHERE id=s.id;
 UPDATE public.free_test_sets SET completed_at=now() WHERE mock_paper_id=s.paper_id AND student_id=s.student_id AND test_type='MOCK';
 RETURN a_id;
END $function$;

CREATE OR REPLACE FUNCTION public.mock_open_exam(p_kind text, p_paper_id uuid)
 RETURNS TABLE(session_id uuid, started_at timestamp with time zone, deadline_at timestamp with time zone, status text, quiz_attempt_id bigint, answers jsonb, server_now timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.mock_exam_sessions%ROWTYPE; p_subject bigint; p_ids bigint[]; p_status text; dur integer;
BEGIN

 IF NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
 IF p_kind='full' THEN SELECT mp.subject_id,mp.question_ids,mp.status INTO p_subject,p_ids,p_status FROM public.mock_papers mp WHERE id=p_paper_id AND student_id=auth.uid();
 ELSIF p_kind='chapters' THEN SELECT cp.subject_id,cp.question_ids,cp.status INTO p_subject,p_ids,p_status FROM public.chapter_mock_papers cp WHERE id=p_paper_id AND student_id=auth.uid();
 ELSE RAISE EXCEPTION 'Invalid exam kind'; END IF;
 IF p_ids IS NULL THEN RAISE EXCEPTION 'Paper not found'; END IF;
 -- Legacy assignments with STARTED status are deliberately not changed here.
 -- An exam session is created only on the student's first post-migration open.
 -- A session can only start for an assigned STARTED paper; existing sessions may be viewed after completion.
 SELECT * INTO s FROM public.mock_exam_sessions ms WHERE ms.kind=p_kind AND ms.paper_id=p_paper_id FOR UPDATE;
 IF NOT FOUND THEN
  IF p_status IS DISTINCT FROM 'STARTED' THEN RAISE EXCEPTION 'Paper already completed'; END IF;
  IF NOT public.cbse_is_paid_for_subject_v1(auth.uid()) AND NOT EXISTS(SELECT 1 FROM public.free_test_sets f WHERE f.student_id=auth.uid() AND f.subject_id=p_subject AND f.test_type='MOCK' AND f.mock_paper_id=p_paper_id) THEN RAISE EXCEPTION 'Mock set access required'; END IF;
  -- Option A: first open of any historical STARTED assignment begins a fresh 60-minute clock.
  -- The existing paper ID and question_ids are preserved, including chapter papers.
  dur:=3600;
  INSERT INTO public.mock_exam_sessions(student_id,kind,paper_id,subject_id,started_at,deadline_at)
  SELECT auth.uid(),p_kind,p_paper_id,p_subject,t.started,t.started+make_interval(secs=>dur) FROM (SELECT clock_timestamp() AS started) t
  ON CONFLICT(kind,paper_id) DO NOTHING;
  SELECT * INTO s FROM public.mock_exam_sessions ms WHERE ms.kind=p_kind AND ms.paper_id=p_paper_id FOR UPDATE;
 END IF;
 IF s.status='COMPLETED' AND coalesce(s.completed_at,s.deadline_at)<now()-interval '14 days' THEN RAISE EXCEPTION 'Test history has expired after 14 days'; END IF;
 IF s.student_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Access denied'; END IF;
 IF s.status='STARTED' AND clock_timestamp()>=s.deadline_at THEN
  PERFORM public._mock_finalize_locked(s.id);
  SELECT * INTO s FROM public.mock_exam_sessions ms WHERE ms.id=s.id;
 END IF;
 RETURN QUERY SELECT s.id,s.started_at,s.deadline_at,s.status,s.quiz_attempt_id,
  COALESCE((SELECT jsonb_object_agg(a.question_id::text,a.selected_answer) FROM public.mock_exam_answers a WHERE a.session_id=s.id),'{}'::jsonb),clock_timestamp();
END $function$;

CREATE OR REPLACE FUNCTION public.mock_finish_exam(p_session_id uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.mock_exam_sessions%ROWTYPE;
BEGIN

 IF NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM public.mock_exam_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR s.student_id<>auth.uid() THEN RAISE EXCEPTION 'Session not found'; END IF;
 IF s.status='STARTED' AND clock_timestamp()<s.deadline_at AND (SELECT count(*) FROM public.mock_exam_answers a WHERE a.session_id=s.id)<(CASE WHEN s.kind='full' THEN (SELECT cardinality(question_ids) FROM public.mock_papers WHERE id=s.paper_id) ELSE (SELECT cardinality(question_ids) FROM public.chapter_mock_papers WHERE id=s.paper_id) END) THEN RAISE EXCEPTION 'Answer all questions before submitting, or wait for the timer to expire'; END IF;
 RETURN public._mock_finalize_locked(p_session_id);
END $function$;

REVOKE EXECUTE ON FUNCTION public.start_mock_paper(bigint,integer),public.start_chapter_mock(bigint,bigint[]),public.mock_get_or_start_chapter(bigint,bigint[]) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.cbse_start_practice_v2(bigint,bigint[],integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cbse_start_practice_v2(bigint,bigint[],integer) TO authenticated;
REVOKE ALL ON FUNCTION public.start_next_mock_paper_v3(bigint,bigint[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_next_mock_paper_v3(bigint,bigint[]) TO authenticated;
REVOKE ALL ON FUNCTION public.cbse_selection_counts_v1(bigint,bigint[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cbse_selection_counts_v1(bigint,bigint[]) TO authenticated;
NOTIFY pgrst,'reload schema';
