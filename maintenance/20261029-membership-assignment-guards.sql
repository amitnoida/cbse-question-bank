
-- Preserve assignment/grading flows while enforcing class-scoped access.
CREATE OR REPLACE FUNCTION public.cbse_chapter_counts_v1(p_subject_id bigint)
 RETURNS TABLE(chapter_id bigint, question_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.subjects sub
    JOIN public.student_profiles sp ON sp.class_id=sub.class_id
    WHERE sub.id=p_subject_id AND sub.is_active AND sp.id=auth.uid() AND cbse_membership.can_access_class(auth.uid(),sub.class_id)) THEN
   RAISE EXCEPTION 'Subject unavailable' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT c.id,count(q.id)::bigint FROM public.chapters c
 LEFT JOIN public.questions q ON q.chapter_id=c.id AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD' AND q.question_usage IN ('PRACTICE','SHARED') AND q.question_type='MCQ'
 WHERE c.subject_id=p_subject_id AND c.is_active GROUP BY c.id ORDER BY c.id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cbse_selection_counts_v1(p_subject_id bigint, p_chapter_ids bigint[])
 RETURNS TABLE(practice_count bigint, mock_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() OR NOT EXISTS(SELECT 1 FROM public.subjects sub JOIN public.student_profiles sp ON sp.class_id=sub.class_id WHERE sub.id=p_subject_id AND sp.id=auth.uid() AND cbse_membership.can_access_class(auth.uid(),sub.class_id) AND sub.is_active)
 THEN RAISE EXCEPTION 'Subject unavailable' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT count(*) FILTER(WHERE q.question_usage IN ('PRACTICE','SHARED')),count(*) FILTER(WHERE q.question_usage IN ('MOCK','SHARED'))
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.media_ready AND q.content_review_status<>'HOLD' AND q.question_type='MCQ'
 AND (coalesce(cardinality(p_chapter_ids),0)=0 OR q.chapter_id=ANY(p_chapter_ids));
END $function$
;
CREATE OR REPLACE FUNCTION public.cbse_start_practice_v2(p_subject_id bigint, p_chapter_ids bigint[], p_set_number integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=auth.uid(); paid boolean; chapters bigint[]; s public.practice_sessions; ids bigint[]; reserved uuid;
BEGIN
 IF u IS NULL OR NOT public.is_active_student() THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subjects sub JOIN public.student_profiles sp ON sp.class_id=sub.class_id
 JOIN public.classes cl ON cl.id=sub.class_id WHERE sub.id=p_subject_id AND sp.id=u AND cbse_membership.can_access_class(u,sub.class_id) AND sub.is_active AND cl.is_active)
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
END $function$
;
CREATE OR REPLACE FUNCTION public.cbse_subject_practice_questions_v2(p_subject_id bigint)
 RETURNS TABLE(id bigint, chapter_id bigint, question_text text, option_a text, option_b text, option_c text, option_d text, correct_option text, explanation text, difficulty text, marks numeric, question_type text, is_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_student uuid := auth.uid();
BEGIN
 IF v_student IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.subjects sub JOIN public.student_profiles sp ON sp.class_id=sub.class_id
   WHERE sub.id=p_subject_id AND sp.id=v_student AND cbse_membership.can_access_class(v_student,sub.class_id) AND sub.is_active
 ) THEN RAISE EXCEPTION 'Subject not available for enrolled class' USING ERRCODE='42501'; END IF;
 IF NOT public.cbse_is_paid_for_subject_v1(v_student) THEN RETURN; END IF;
 RETURN QUERY
 SELECT q.id,q.chapter_id,public.cbse_media_text_v1(q.question_text,q.question_media,'question'),public.cbse_media_text_v1(q.option_a,q.question_media,'A'),public.cbse_media_text_v1(q.option_b,q.question_media,'B'),public.cbse_media_text_v1(q.option_c,q.question_media,'C'),public.cbse_media_text_v1(q.option_d,q.question_media,'D'),
   ''::text,NULL::text,q.difficulty::text,q.marks::numeric,q.question_type::text,(c.is_active AND q.is_active)
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
 WHERE c.subject_id=p_subject_id AND q.question_usage IN ('PRACTICE','SHARED') AND q.question_type='MCQ'
 AND ((c.is_active AND q.is_active) OR EXISTS (
 SELECT 1 FROM public.mock_papers assigned
 WHERE assigned.student_id=v_student AND assigned.subject_id=p_subject_id
 AND assigned.status='STARTED' AND q.id=ANY(assigned.question_ids)
 ))
 ORDER BY q.id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.cbse_subject_questions_v1(p_subject_id bigint)
 RETURNS TABLE(id bigint, chapter_id bigint, question_text text, option_a text, option_b text, option_c text, option_d text, correct_option text, explanation text, difficulty text, marks numeric, question_type text, is_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_student uuid := auth.uid();
BEGIN
 IF v_student IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.subjects sub JOIN public.student_profiles sp ON sp.class_id=sub.class_id
   WHERE sub.id=p_subject_id AND sp.id=v_student AND cbse_membership.can_access_class(v_student,sub.class_id) AND sub.is_active
 ) THEN RAISE EXCEPTION 'Subject not available for enrolled class' USING ERRCODE='42501'; END IF;
 IF NOT public.cbse_is_paid_for_subject_v1(v_student) THEN RETURN; END IF;
 RETURN QUERY
 SELECT q.id,q.chapter_id,public.cbse_media_text_v1(q.question_text,q.question_media,'question'),public.cbse_media_text_v1(q.option_a,q.question_media,'A'),public.cbse_media_text_v1(q.option_b,q.question_media,'B'),public.cbse_media_text_v1(q.option_c,q.question_media,'C'),public.cbse_media_text_v1(q.option_d,q.question_media,'D'),
   ''::text,NULL::text,q.difficulty::text,q.marks::numeric,q.question_type::text,(c.is_active AND q.is_active)
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
 WHERE c.subject_id=p_subject_id AND q.question_type='MCQ'
 AND ((c.is_active AND q.is_active) OR EXISTS (
 SELECT 1 FROM public.mock_papers assigned
 WHERE assigned.student_id=v_student AND assigned.subject_id=p_subject_id
 AND assigned.status='STARTED' AND q.id=ANY(assigned.question_ids)
 ))
 ORDER BY q.id;
END;
$function$
;
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
  IF NOT (SELECT cbse_membership.can_access_class(auth.uid(),sub.class_id) FROM public.subjects sub WHERE sub.id=p_subject) THEN RAISE EXCEPTION 'Class access required' USING ERRCODE='42501'; END IF;
  IF p_status IS DISTINCT FROM 'STARTED' THEN RAISE EXCEPTION 'Paper already completed'; END IF;
  IF NOT (SELECT cbse_membership.paid_for_class(auth.uid(),sub.class_id) FROM public.subjects sub WHERE sub.id=p_subject) AND NOT EXISTS(SELECT 1 FROM public.free_test_sets f WHERE f.student_id=auth.uid() AND f.subject_id=p_subject AND f.test_type='MOCK' AND f.mock_paper_id=p_paper_id) THEN RAISE EXCEPTION 'Mock set access required'; END IF;
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
END $function$
;
CREATE OR REPLACE FUNCTION public.start_next_mock_paper_v3(p_subject_id bigint, p_chapter_ids bigint[])
 RETURNS mock_papers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid:=auth.uid(); paid boolean; chapters bigint[]; paper public.mock_papers; reserved uuid;
 n integer; nm integer; ns integer; take_m integer; take_s integer; ids bigint[]; num integer;
BEGIN
 IF u IS NULL OR NOT public.is_active_student() THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.subjects sub JOIN public.student_profiles sp ON sp.class_id=sub.class_id
 JOIN public.classes cl ON cl.id=sub.class_id WHERE sub.id=p_subject_id AND sp.id=u AND cbse_membership.can_access_class(u,sub.class_id) AND sub.is_active AND cl.is_active)
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
END $function$
;

