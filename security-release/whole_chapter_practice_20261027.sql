-- Existing authenticated RPCs and grants are retained. Assignment ownership and free quota checks remain.
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
     ORDER BY q.id
     OFFSET (CASE WHEN p_chapter_id IS NULL THEN v_page ELSE 0 END)
     LIMIT (CASE WHEN p_chapter_id IS NULL THEN 60 ELSE NULL END)
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
$function$;

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
  IF NOT v_paid THEN
    -- Shared lock with practice-session creation; serializes starts and charges.
    PERFORM pg_advisory_xact_lock(hashtextextended(v_student::text||':'||s.subject_id::text,0));
    SELECT questions_used INTO v_used FROM public.free_usage
    WHERE student_id=v_student AND subject_id=s.subject_id FOR UPDATE;
    v_used:=coalesce(v_used,0);
    IF v_used+v_n>10 THEN RAISE EXCEPTION 'Free question limit exceeded'; END IF;
  END IF;
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
  IF NOT v_paid THEN
    INSERT INTO public.free_usage(student_id,subject_id,chapter_id,questions_used,questions_allowed,
      last_used_at,created_at,updated_at)
    VALUES(v_student,s.subject_id,NULL,v_n,10,now(),now(),now())
    ON CONFLICT(student_id,subject_id) DO UPDATE
      SET questions_used=public.free_usage.questions_used+excluded.questions_used,
          last_used_at=now(),updated_at=now();
  END IF;
  UPDATE public.practice_sessions SET status='COMPLETED',updated_at=now() WHERE id=s.id;
  RETURN v_attempt;
END;
$function$;
