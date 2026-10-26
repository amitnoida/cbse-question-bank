-- Fix inactive-session authorization, least-privilege grants, and monitoring counts.
-- Definitions were captured from production immediately before this migration.

CREATE OR REPLACE FUNCTION public.activate_paid_membership_with_coupon(p_coupon_code text)
 RETURNS TABLE(success boolean, message text, subscription_id bigint, end_date timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_student_id uuid;
    v_coupon public.coupons%rowtype;
    v_plan_id bigint;
    v_subscription_id bigint;
    v_end_date timestamptz;
    v_final_price numeric;
    v_code text;
BEGIN

 IF NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
    v_student_id := auth.uid();
    v_code := upper(trim(p_coupon_code));

    IF v_student_id IS NULL THEN
        RETURN QUERY SELECT
            false,
            'You must be signed in to activate membership.'::text,
            NULL::bigint,
            NULL::timestamptz;
        RETURN;
    END IF;

    IF v_code IS NULL OR length(v_code) = 0 THEN
        RETURN QUERY SELECT
            false, 'Invalid coupon code.'::text,
            NULL::bigint, NULL::timestamptz;
        RETURN;
    END IF;

    SELECT c.*
    INTO v_coupon
    FROM public.coupons c
    WHERE c.coupon_code = v_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT
            false, 'Invalid coupon code.'::text,
            NULL::bigint, NULL::timestamptz;
        RETURN;
    END IF;

    IF NOT v_coupon.is_active THEN
        RETURN QUERY SELECT
            false, 'This coupon is inactive.'::text,
            NULL::bigint, NULL::timestamptz;
        RETURN;
    END IF;

    IF v_coupon.valid_from IS NOT NULL
       AND now() < v_coupon.valid_from THEN
        RETURN QUERY SELECT
            false, 'This coupon is not active yet.'::text,
            NULL::bigint, NULL::timestamptz;
        RETURN;
    END IF;

    IF v_coupon.valid_until IS NULL
       OR now() >= v_coupon.valid_until THEN
        RETURN QUERY SELECT
            false, 'This coupon has expired.'::text,
            NULL::bigint, NULL::timestamptz;
        RETURN;
    END IF;

    IF v_coupon.usage_limit IS NOT NULL
       AND v_coupon.usage_count >= v_coupon.usage_limit THEN
        RETURN QUERY SELECT
            false, 'This coupon has reached its usage limit.'::text,
            NULL::bigint, NULL::timestamptz;
        RETURN;
    END IF;

    -- FREETRIAL can only be successfully
    -- redeemed once per student, ever.

    IF v_code = 'FREETRIAL' THEN
        IF EXISTS (
            SELECT 1
            FROM public.subscriptions s
            WHERE s.student_id = v_student_id
              AND s.payment_reference = 'COUPON:FREETRIAL'
        ) THEN
            RETURN QUERY SELECT
                false,
                'You have already redeemed FREETRIAL.'::text,
                NULL::bigint,
                NULL::timestamptz;
            RETURN;
        END IF;
    END IF;

    -- Preserve existing zero-payment requirement.

    v_final_price := greatest(
        0,
        99 - round(
            99 * v_coupon.discount_percentage / 100.0,
            2
        )
    );

    IF v_final_price <> 0 THEN
        RETURN QUERY SELECT
            false,
            'This coupon does not make the membership free. Payment is required.'::text,
            NULL::bigint,
            NULL::timestamptz;
        RETURN;
    END IF;

    SELECT sp.id
    INTO v_plan_id
    FROM public.subscription_plans sp
    WHERE sp.plan_code = 'PAID_99'
      AND sp.is_active = true
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        RETURN QUERY SELECT
            false, 'Paid plan is not available.'::text,
            NULL::bigint, NULL::timestamptz;
        RETURN;
    END IF;

    -- Never overwrite an existing active membership.

    SELECT s.id, s.end_date
    INTO v_subscription_id, v_end_date
    FROM public.subscriptions s
    WHERE s.student_id = v_student_id
      AND s.status = 'ACTIVE'
      AND (
          s.end_date IS NULL
          OR s.end_date > now()
      )
    ORDER BY s.end_date DESC NULLS FIRST
    LIMIT 1;

    IF v_subscription_id IS NOT NULL THEN
        RETURN QUERY SELECT
            true,
            'You already have an active membership. No changes were made.'::text,
            v_subscription_id,
            v_end_date;
        RETURN;
    END IF;

    v_end_date := v_coupon.valid_until;

    INSERT INTO public.subscriptions (
        student_id,
        plan_id,
        status,
        start_date,
        end_date,
        payment_reference
    )
    VALUES (
        v_student_id,
        v_plan_id,
        'ACTIVE',
        now(),
        v_end_date,
        'COUPON:' || v_code
    )
    RETURNING id INTO v_subscription_id;

    UPDATE public.coupons
    SET usage_count = usage_count + 1
    WHERE id = v_coupon.id;

    RETURN QUERY SELECT
        true,
        'Coupon membership activated successfully.'::text,
        v_subscription_id,
        v_end_date;

END;
$function$
;

CREATE OR REPLACE FUNCTION public.start_mock_paper(p_subject_id bigint, p_paper_number integer DEFAULT NULL::integer)
 RETURNS mock_papers
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_total integer;
  v_count integer;
  v_existing public.mock_papers;
  v_result public.mock_papers;
  v_ids bigint[];
  v_retake integer;
begin

 IF NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
  if v_user is null then raise exception 'Please sign in'; end if;
  if not exists (
    select 1 from public.subscriptions s
    where s.student_id=v_user and s.status='ACTIVE'
      and (s.end_date is null or s.end_date >= now())
  ) then raise exception 'Active paid membership required'; end if;
  if not exists (select 1 from public.subjects where id=p_subject_id and is_active=true)
  then raise exception 'Subject unavailable'; end if;

  perform pg_advisory_xact_lock(hashtext(v_user::text), p_subject_id::integer);
  select count(*) into v_total
  from public.questions q join public.chapters c on c.id=q.chapter_id
  where c.subject_id=p_subject_id and c.is_active=true
    and q.is_active=true and q.question_type='MCQ';
  v_count := v_total / 60;
  if v_count < 1 then raise exception 'At least 60 active MCQs are required'; end if;

  if p_paper_number is not null then
    if p_paper_number < 1 or p_paper_number > v_count then
      raise exception 'Invalid numbered paper'; end if;
    select * into v_existing from public.mock_papers
      where student_id=v_user and subject_id=p_subject_id
      and paper_number=p_paper_number;
    if found then
      if v_existing.status='COMPLETED' then
        raise exception 'Paper already completed; choose a retake after completing the series';
      end if;
      return v_existing;
    end if;

    -- Create the entire numbered series with one random permutation.
    -- No question is repeated between the numbered papers.
    with shuffled as (
      select q.id, row_number() over(order by random()) as rn
      from public.questions q join public.chapters c on c.id=q.chapter_id
      where c.subject_id=p_subject_id and c.is_active=true
        and q.is_active=true and q.question_type='MCQ'
    ), grouped as (
      select ((rn-1)/60)::integer+1 as paper_no,
             array_agg(id order by rn) as ids
      from shuffled where rn <= v_count*60
      group by ((rn-1)/60)::integer+1
    )
    insert into public.mock_papers(student_id,subject_id,paper_number,question_ids)
    select v_user,p_subject_id,paper_no,ids from grouped
    on conflict do nothing;

    select * into v_result from public.mock_papers
    where student_id=v_user and subject_id=p_subject_id and paper_number=p_paper_number;
    return v_result;
  end if;

  -- Retakes unlock after every numbered paper is completed.
  if (select count(*) from public.mock_papers
      where student_id=v_user and subject_id=p_subject_id
        and paper_number is not null and status='COMPLETED') < v_count then
    raise exception 'Complete all numbered papers before starting randomized retakes';
  end if;

  -- Resume an unfinished retake instead of generating another.
  select * into v_existing from public.mock_papers
    where student_id=v_user and subject_id=p_subject_id
      and retake_number is not null and status='STARTED'
    order by retake_number desc limit 1;
  if found then return v_existing; end if;

  select coalesce(max(retake_number),0)+1 into v_retake
    from public.mock_papers where student_id=v_user and subject_id=p_subject_id;
  select array_agg(id order by seq) into v_ids
  from (select q.id, row_number() over(order by random()) as seq
        from public.questions q join public.chapters c on c.id=q.chapter_id
        where c.subject_id=p_subject_id and c.is_active=true
          and q.is_active=true and q.question_type='MCQ'
        order by seq limit 60) x;
  insert into public.mock_papers(student_id,subject_id,retake_number,question_ids)
  values(v_user,p_subject_id,v_retake,v_ids) returning * into v_result;
  return v_result;
end;
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

CREATE OR REPLACE FUNCTION public.mock_save_answer(p_session_id uuid, p_question_id bigint, p_answer text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s public.mock_exam_sessions%ROWTYPE; ids bigint[]; normalized text:=upper(trim(p_answer));
BEGIN

 IF NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM public.mock_exam_sessions WHERE id=p_session_id FOR UPDATE;
 IF NOT FOUND OR s.student_id<>auth.uid() THEN RAISE EXCEPTION 'Session not found'; END IF;
 IF s.status<>'STARTED' THEN RETURN jsonb_build_object('saved',false,'expired',true,'question_id',p_question_id); END IF;
 IF clock_timestamp()>=s.deadline_at THEN
  PERFORM public._mock_finalize_locked(s.id);
  RETURN jsonb_build_object('saved',false,'expired',true,'question_id',p_question_id);
 END IF;
 IF normalized IS NULL OR normalized NOT IN ('A','B','C','D') THEN RAISE EXCEPTION 'Invalid answer'; END IF;
 IF s.kind='full' THEN SELECT question_ids INTO ids FROM public.mock_papers WHERE id=s.paper_id;
 ELSE SELECT question_ids INTO ids FROM public.chapter_mock_papers WHERE id=s.paper_id; END IF;
 IF ids IS NULL OR p_question_id IS NULL OR NOT COALESCE(p_question_id=ANY(ids),false) THEN RAISE EXCEPTION 'Question not assigned to this exam'; END IF;
 INSERT INTO public.mock_exam_answers(session_id,question_id,selected_answer,answered_at)
 VALUES(s.id,p_question_id,normalized,clock_timestamp())
 ON CONFLICT(session_id,question_id) DO UPDATE SET selected_answer=excluded.selected_answer,answered_at=excluded.answered_at;
 RETURN jsonb_build_object('saved',true,'question_id',p_question_id,'answer',normalized);
END $function$
;

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
 RETURN public._mock_finalize_locked(p_session_id);
END $function$
;

CREATE OR REPLACE FUNCTION public.submit_practice_answer_locked(p_session_id uuid, p_question_id bigint, p_answer text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v public.practice_sessions; v_key text := p_question_id::text;
BEGIN

 IF NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
 IF p_answer IS NOT NULL AND p_answer NOT IN ('A','B','C','D') THEN
   RAISE EXCEPTION 'Invalid answer'; END IF;
 SELECT * INTO v FROM public.practice_sessions
 WHERE id=p_session_id AND student_id=auth.uid() AND status='IN_PROGRESS' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Practice session unavailable'; END IF;
 IF NOT (p_question_id=ANY(v.question_ids)) THEN RAISE EXCEPTION 'Question not assigned to this session'; END IF;
 IF v.answers ? v_key THEN RETURN v.answers; END IF;
 UPDATE public.practice_sessions SET answers=jsonb_set(v.answers,ARRAY[v_key],coalesce(to_jsonb(p_answer),'null'::jsonb),true),updated_at=now()
 WHERE id=p_session_id RETURNING * INTO v;
 RETURN v.answers;
END $function$
;

CREATE OR REPLACE FUNCTION public.cbse_history_questions_v1(p_ids bigint[])
 RETURNS TABLE(id bigint, question_text text, option_a text, option_b text, option_c text, option_d text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_student uuid := auth.uid();
BEGIN

 IF NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
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

CREATE OR REPLACE FUNCTION public.system_stats_db_readonly()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT jsonb_build_object(
 'database_mb', round(pg_catalog.pg_database_size(pg_catalog.current_database())::numeric/1048576,2),
 'registered_auth_accounts',(SELECT count(*) FROM auth.users),
 'signed_in_today_ist',(SELECT count(*) FROM auth.users WHERE last_sign_in_at >= (pg_catalog.now() AT TIME ZONE 'Asia/Kolkata')::date AT TIME ZONE 'Asia/Kolkata'),
 'total_mcqs',(SELECT count(*) FROM public.questions),
 'active_mcqs',(SELECT count(*) FROM public.questions WHERE is_active),
 'registered_students',(SELECT count(*) FROM public.student_profiles sp WHERE NOT EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id=sp.id)),
 'quiz_attempts',(SELECT count(*) FROM public.quiz_attempts),
 'saved_answers',(SELECT count(*) FROM public.quiz_attempt_answers),
 'largest_tables',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.relname,'mb',round(t.bytes::numeric/1048576,2)) ORDER BY t.bytes DESC),'[]'::jsonb)
 FROM (SELECT c.relname,pg_catalog.pg_total_relation_size(c.oid) bytes FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' ORDER BY bytes DESC LIMIT 12)t)
 );
$function$
;

REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM PUBLIC, anon, authenticated;

