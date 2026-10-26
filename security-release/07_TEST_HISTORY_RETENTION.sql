-- Completed test details are retained for 14 days; progression and quota are independent.
CREATE TABLE public.practice_question_usage (
 student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 subject_id bigint NOT NULL REFERENCES public.subjects(id),
 question_id bigint NOT NULL,
 PRIMARY KEY(student_id,subject_id,question_id)
);
ALTER TABLE public.practice_question_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.practice_question_usage FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.practice_question_usage TO service_role;
COMMENT ON TABLE public.practice_question_usage IS 'Question assignment ledger only: prevents free-question repeats after answer history expires. No answers or scores.';

CREATE OR REPLACE FUNCTION public.cbse_start_practice_v1(p_subject_id bigint, p_chapter_id bigint, p_set_number integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
 v_student uuid := auth.uid(); v_paid boolean; v_used integer := 0;
 v_session public.practice_sessions%ROWTYPE; v_ids bigint[]; v_page integer;
BEGIN
 IF v_student IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF p_set_number IS NULL OR p_set_number<1 OR p_set_number>10000 THEN
   RAISE EXCEPTION 'Invalid set number'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.subjects s JOIN public.student_profiles sp ON sp.class_id=s.class_id
   WHERE s.id=p_subject_id AND sp.id=v_student AND s.is_active
 ) THEN RAISE EXCEPTION 'Subject unavailable' USING ERRCODE='42501'; END IF;
 IF p_chapter_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.chapters c WHERE c.id=p_chapter_id AND c.subject_id=p_subject_id AND c.is_active
 ) THEN RAISE EXCEPTION 'Chapter does not belong to subject'; END IF;
 -- Shared with the finalizer: serialize starts and free-usage charges.
 PERFORM pg_advisory_xact_lock(hashtextextended(v_student::text||':'||p_subject_id::text,0));
 v_paid := public.cbse_is_paid_for_subject_v1(v_student);
 IF NOT v_paid THEN
   SELECT coalesce(f.questions_used,0) INTO v_used FROM public.free_usage f
   WHERE f.student_id=v_student AND f.subject_id=p_subject_id FOR UPDATE;
   v_used := coalesce(v_used,0);
   IF v_used>=10 THEN RAISE EXCEPTION 'Free question limit reached'; END IF;
   IF EXISTS (SELECT 1 FROM public.practice_sessions ps
     WHERE ps.student_id=v_student AND ps.subject_id=p_subject_id
       AND ps.status='IN_PROGRESS'
       AND (ps.set_number<>p_set_number OR ps.chapter_id IS DISTINCT FROM p_chapter_id))
   THEN RAISE EXCEPTION 'Finish your existing practice session first'; END IF;
 END IF;
 SELECT * INTO v_session FROM public.practice_sessions ps
 WHERE ps.student_id=v_student AND ps.subject_id=p_subject_id
 AND ps.set_number=p_set_number AND ps.status='IN_PROGRESS'
 AND ps.chapter_id IS NOT DISTINCT FROM p_chapter_id
 ORDER BY ps.created_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   IF NOT v_paid AND cardinality(v_session.question_ids)>10-v_used THEN
     RAISE EXCEPTION 'Existing free session exceeds remaining allowance'; END IF;
   RETURN to_jsonb(v_session);
 END IF;
 IF NOT v_paid AND p_set_number<>1 THEN RAISE EXCEPTION 'Free question limit reached'; END IF;
 v_page := (p_set_number-1)*60;
 IF v_paid THEN
   SELECT array_agg(id ORDER BY id) INTO v_ids FROM (
     SELECT q.id FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
     WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.question_type='MCQ'
     AND (p_chapter_id IS NULL OR q.chapter_id=p_chapter_id)
     ORDER BY q.id OFFSET v_page LIMIT 60
   ) chosen;
 ELSE
   -- Allocate from the chapter the student actually selected. No bodies are
   -- exposed beforehand and a free student may have only one open subject session.
   -- Charge the immutable assignment at completion (even for skipped questions).
   SELECT array_agg(id ORDER BY id) INTO v_ids FROM (
     SELECT q.id FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
     WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.question_type='MCQ'
       AND (p_chapter_id IS NULL OR q.chapter_id=p_chapter_id)
       AND NOT EXISTS (SELECT 1 FROM public.practice_question_usage used_question
         WHERE used_question.student_id=v_student AND used_question.subject_id=p_subject_id
           AND used_question.question_id=q.id)
       AND NOT EXISTS (SELECT 1 FROM public.practice_sessions completed_session
         WHERE completed_session.student_id=v_student
           AND completed_session.subject_id=p_subject_id
           AND completed_session.status='COMPLETED'
           AND q.id=ANY(completed_session.question_ids))
     ORDER BY q.id LIMIT (10-v_used)
   ) chosen;
 END IF;
 IF coalesce(cardinality(v_ids),0)=0 THEN RAISE EXCEPTION 'No eligible questions in this set'; END IF;
 INSERT INTO public.practice_sessions(student_id,subject_id,chapter_id,set_number,question_ids,answers,current_index,status)
 VALUES(v_student,p_subject_id,p_chapter_id,p_set_number,v_ids,'{}'::jsonb,0,'IN_PROGRESS')
 RETURNING * INTO v_session;
 RETURN to_jsonb(v_session);
END;
$function$

;
CREATE OR REPLACE FUNCTION public.cbse_cleanup_test_history(p_delete_all_completed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $cleanup$
DECLARE cutoff timestamptz := now()-interval '14 days'; n_attempts integer; n_practice integer; n_mock integer;
BEGIN
 -- The function is callable by the database scheduler/operator only, never a client RPC.
 IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Database operator required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cbse-history-cleanup',0));
 INSERT INTO public.practice_question_usage(student_id,subject_id,question_id)
 SELECT ps.student_id,ps.subject_id,assigned.qid
 FROM public.practice_sessions ps CROSS JOIN LATERAL unnest(ps.question_ids) assigned(qid)
 WHERE ps.status='COMPLETED' AND (p_delete_all_completed OR ps.updated_at<cutoff)
 ON CONFLICT DO NOTHING;
 DELETE FROM public.practice_sessions ps
 WHERE ps.status='COMPLETED' AND (p_delete_all_completed OR ps.updated_at<cutoff);
 GET DIAGNOSTICS n_practice=ROW_COUNT;
 -- Preserve numbered assignments, their original question IDs and completion status.
 UPDATE public.mock_papers p SET quiz_attempt_id=NULL
 WHERE p.status='COMPLETED' AND EXISTS (
   SELECT 1 FROM public.quiz_attempts a WHERE a.id::text=p.quiz_attempt_id
   AND a.status IN ('COMPLETED','Submitted','Reviewed')
   AND (p_delete_all_completed OR coalesce(a.submitted_at,a.created_at)<cutoff)
 );
 UPDATE public.chapter_mock_papers p SET quiz_attempt_id=NULL
 WHERE p.status='COMPLETED' AND EXISTS (
   SELECT 1 FROM public.quiz_attempts a WHERE a.id::text=p.quiz_attempt_id
   AND a.status IN ('COMPLETED','Submitted','Reviewed')
   AND (p_delete_all_completed OR coalesce(a.submitted_at,a.created_at)<cutoff)
 );
 DELETE FROM public.mock_exam_sessions s WHERE s.status='COMPLETED'
 AND (p_delete_all_completed OR coalesce(s.completed_at,s.deadline_at)<cutoff);
 GET DIAGNOSTICS n_mock=ROW_COUNT;
 DELETE FROM public.quiz_attempts a WHERE a.status IN ('COMPLETED','Submitted','Reviewed')
 AND (p_delete_all_completed OR coalesce(a.submitted_at,a.created_at)<cutoff)
 AND NOT EXISTS (SELECT 1 FROM public.mock_exam_sessions s WHERE s.quiz_attempt_id=a.id);
 GET DIAGNOSTICS n_attempts=ROW_COUNT;
 -- Answer rows and result-email logs cascade from their attempts; active sessions survive.
 RETURN jsonb_build_object('attempts_deleted',n_attempts,'practice_sessions_deleted',n_practice,'mock_sessions_deleted',n_mock);
END;
$cleanup$;
REVOKE ALL ON FUNCTION public.cbse_cleanup_test_history(boolean) FROM PUBLIC,anon,authenticated,service_role;

-- Retire new chapter-mock allocations while preserving existing data.
CREATE OR REPLACE FUNCTION public.start_chapter_mock(p_subject_id bigint,p_chapter_ids bigint[])
RETURNS public.chapter_mock_papers LANGUAGE plpgsql SET search_path='' AS $disabled$
BEGIN RAISE EXCEPTION 'Chapter-based mock tests have been retired. Use chapter-wise practice or a full-syllabus mock.'; END;
$disabled$;
CREATE OR REPLACE FUNCTION public.mock_get_or_start_chapter(p_subject_id bigint,p_chapter_ids bigint[])
RETURNS public.chapter_mock_papers LANGUAGE plpgsql SET search_path='' AS $disabled$
BEGIN RAISE EXCEPTION 'Chapter-based mock tests have been retired. Use chapter-wise practice or a full-syllabus mock.'; END;
$disabled$;

CREATE OR REPLACE FUNCTION public.cbse_history_questions_v1(p_ids bigint[])
 RETURNS TABLE(id bigint, question_text text, option_a text, option_b text, option_c text, option_d text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_student uuid := auth.uid();
BEGIN
 IF v_student IS NULL THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 IF coalesce(cardinality(p_ids),0)>100 THEN RAISE EXCEPTION 'Too many questions'; END IF;
 RETURN QUERY SELECT q.id,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d
 FROM public.questions q WHERE q.id=ANY(p_ids)
 AND EXISTS (SELECT 1 FROM public.quiz_attempt_answers a
 JOIN public.quiz_attempts t ON t.id=a.attempt_id
 WHERE t.student_id=v_student AND coalesce(t.submitted_at,t.created_at)>=now()-interval '14 days' AND a.question_id=q.id);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cbse_question_feedback_v1(p_ids bigint[])
 RETURNS TABLE(id bigint, correct_option text, explanation text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_student uuid := auth.uid();
BEGIN
 IF v_student IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF coalesce(cardinality(p_ids),0)>60 THEN RAISE EXCEPTION 'Too many questions'; END IF;
 RETURN QUERY SELECT q.id,q.correct_option::text,q.explanation::text
 FROM public.questions q WHERE q.id=ANY(p_ids) AND (
   EXISTS (SELECT 1 FROM public.practice_sessions ps
     WHERE ps.student_id=v_student AND (ps.status='IN_PROGRESS' OR ps.updated_at>=now()-interval '14 days') AND ps.question_ids @> ARRAY[q.id]::bigint[]
       AND ps.answers ? q.id::text AND ps.answers->q.id::text <> 'null'::jsonb)
   OR EXISTS (SELECT 1 FROM public.quiz_attempt_answers a
     JOIN public.quiz_attempts t ON t.id=a.attempt_id
     WHERE t.student_id=v_student AND coalesce(t.submitted_at,t.created_at)>=now()-interval '14 days' AND t.status IN ('Submitted','Reviewed','COMPLETED')
       AND a.question_id=q.id)
 );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cbse_legacy_mock_review_v1(p_attempt_id bigint)
 RETURNS TABLE(question_id bigint, question_text text, option_a text, option_b text, option_c text, option_d text, correct_answer text, selected_answer text, is_correct boolean, marks_obtained numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_ids bigint[];
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.quiz_attempts t
    WHERE t.id=p_attempt_id AND t.student_id=auth.uid()
    AND upper(coalesce(t.quiz_type,''))='MOCK'
    AND coalesce(t.submitted_at,t.created_at)>=now()-interval '14 days'
    AND t.status IN ('COMPLETED','Submitted','Reviewed')) THEN
   RAISE EXCEPTION 'Completed mock attempt unavailable' USING ERRCODE='42501'; END IF;
 SELECT p.question_ids INTO v_ids FROM public.mock_papers p
 WHERE p.student_id=auth.uid() AND p.status='COMPLETED'
   AND p.quiz_attempt_id=p_attempt_id::text LIMIT 1;
 IF v_ids IS NULL THEN
   SELECT p.question_ids INTO v_ids FROM public.chapter_mock_papers p
   WHERE p.student_id=auth.uid() AND p.status='COMPLETED'
     AND p.quiz_attempt_id=p_attempt_id::text LIMIT 1;
 END IF;
 IF v_ids IS NULL OR cardinality(v_ids)>100 THEN RETURN; END IF;
 RETURN QUERY
 SELECT q.id,q.question_text,q.option_a,q.option_b,q.option_c,q.option_d,
   trim(upper(q.correct_option))::text,
   ma.selected_answer::text,
   (ma.selected_answer IS NOT NULL AND ma.selected_answer=trim(upper(q.correct_option)))::boolean,
   CASE WHEN ma.selected_answer=trim(upper(q.correct_option)) THEN q.marks ELSE 0::numeric END
 FROM unnest(v_ids) WITH ORDINALITY v(qid,ord)
 JOIN public.questions q ON q.id=v.qid
 LEFT JOIN public.mock_exam_sessions ms ON ms.quiz_attempt_id=p_attempt_id
   AND ms.student_id=auth.uid() AND ms.status='COMPLETED'
 LEFT JOIN public.mock_exam_answers ma ON ma.session_id=ms.id AND ma.question_id=q.id
 ORDER BY v.ord;
END;
$function$
;

-- Restrictive SELECT policies compose with existing ownership policies.
CREATE POLICY history_retention_14_days ON public.quiz_attempts AS RESTRICTIVE FOR SELECT TO authenticated
USING (status NOT IN ('COMPLETED','Submitted','Reviewed') OR coalesce(submitted_at,created_at)>=now()-interval '14 days');
CREATE POLICY practice_retention_14_days ON public.practice_sessions AS RESTRICTIVE FOR SELECT TO authenticated
USING (status='IN_PROGRESS' OR updated_at>=now()-interval '14 days');
CREATE POLICY mock_retention_14_days ON public.mock_exam_sessions AS RESTRICTIVE FOR SELECT TO authenticated
USING (status='STARTED' OR coalesce(completed_at,deadline_at)>=now()-interval '14 days');

CREATE OR REPLACE FUNCTION public.admin_student_dashboard_readonly(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Reuse the application's existing server-side administrator authorization gate.
  PERFORM public.admin_dashboard_summary();

  IF NOT EXISTS (SELECT 1 FROM public.student_profiles WHERE id = p_student_id) THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  SELECT jsonb_build_object(
    'completed_tests', COUNT(*) FILTER (WHERE status = 'COMPLETED'),
    'answered_questions', COALESCE(SUM(answered_questions) FILTER (WHERE status = 'COMPLETED'), 0),
    'correct_answers', COALESCE(SUM(correct_answers) FILTER (WHERE status = 'COMPLETED'), 0),
    'accuracy', CASE WHEN COALESCE(SUM(answered_questions) FILTER (WHERE status = 'COMPLETED'), 0) > 0
      THEN ROUND(100.0 * COALESCE(SUM(correct_answers) FILTER (WHERE status = 'COMPLETED'), 0)
        / SUM(answered_questions) FILTER (WHERE status = 'COMPLETED'))
      ELSE 0 END,
    'attempts', COALESCE((
      SELECT jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC)
      FROM (SELECT id, quiz_type, status, answered_questions, correct_answers, percentage, submitted_at, created_at
        FROM public.quiz_attempts WHERE student_id = p_student_id AND coalesce(submitted_at,created_at)>=now()-interval '14 days' ORDER BY created_at DESC LIMIT 1000) t
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.quiz_attempts
  WHERE student_id = p_student_id AND coalesce(submitted_at,created_at)>=now()-interval '14 days';

  RETURN v_result;
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
  IF NOT EXISTS(SELECT 1 FROM public.subscriptions sub WHERE sub.student_id=auth.uid() AND sub.status='ACTIVE' AND (sub.end_date IS NULL OR sub.end_date>=clock_timestamp())) THEN RAISE EXCEPTION 'Active membership required'; END IF;
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

