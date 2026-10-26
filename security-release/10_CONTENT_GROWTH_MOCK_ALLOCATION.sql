-- Applied to production as preserve_numbered_mock_uniqueness_during_content_growth.
-- Preserve existing paper IDs/question assignments; allocate extensions only from unused questions.
-- Rehearsal after adding 163 questions: old allocator repeated 40/60 questions;
-- fixed allocator extended 10 to 13 papers with no overlaps and unchanged original assignments.
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
  v_last_paper integer;
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

    -- Extend a student's numbered series without changing existing assignments.
    -- Only questions unused in that student's numbered papers may enter new papers.
    select coalesce(max(paper_number),0) into v_last_paper
    from public.mock_papers
    where student_id=v_user and subject_id=p_subject_id and paper_number is not null;
    with shuffled as (
      select q.id, row_number() over(order by random()) as rn,
             count(*) over() as total_unused
      from public.questions q join public.chapters c on c.id=q.chapter_id
      where c.subject_id=p_subject_id and c.is_active=true
        and q.is_active=true and q.question_type='MCQ'
        and not exists (
          select 1 from public.mock_papers assigned
          where assigned.student_id=v_user and assigned.subject_id=p_subject_id
            and assigned.paper_number is not null and q.id=any(assigned.question_ids)
        )
    ), grouped as (
      select v_last_paper+((rn-1)/60)::integer+1 as paper_no,
             array_agg(id order by rn) as ids
      from shuffled where rn <= (total_unused/60)*60
      group by ((rn-1)/60)::integer
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
