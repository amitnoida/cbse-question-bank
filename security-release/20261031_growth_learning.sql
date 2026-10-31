-- Additive release: no changes to existing free allowances, assessment RLS or question content.
create table public.ey_assignments(id uuid primary key default gen_random_uuid(),teacher_id uuid not null references auth.users on delete cascade,class_id bigint not null references public.classes,subject_id bigint not null references public.subjects,chapter_id bigint not null references public.chapters,title text not null check(length(title) between 3 and 100),questions jsonb not null,expires_at timestamptz not null,created_at timestamptz not null default now(),is_active boolean not null default true);
create index ey_assignments_teacher on public.ey_assignments(teacher_id,created_at desc);
create table public.ey_sessions(id uuid primary key default gen_random_uuid(),student_id uuid not null references auth.users on delete cascade,class_id bigint not null references public.classes,mode text not null check(mode in('DAILY','MISTAKES','ASSIGNMENT')),day date not null default(now()at time zone 'Asia/Kolkata')::date,title text not null,assignment_id uuid references public.ey_assignments on delete set null,questions jsonb not null check(jsonb_array_length(questions)between 1 and 10),answers jsonb not null default '{}',created_at timestamptz not null default now(),completed_at timestamptz);
create unique index ey_daily_once on public.ey_sessions(student_id,class_id,day)where mode='DAILY';
create unique index ey_assignment_once on public.ey_sessions(student_id,assignment_id)where assignment_id is not null;
create index ey_sessions_owner on public.ey_sessions(student_id,created_at desc);
create table public.ey_monthly_progress(student_id uuid not null references auth.users on delete cascade,month date not null,source text not null,subject_id bigint not null references public.subjects,sessions integer not null,answered integer not null,correct integer not null,primary key(student_id,month,source,subject_id));
create table public.ey_progress_receipts(receipt text primary key,student_id uuid not null references auth.users on delete cascade,created_at timestamptz not null default now());
create table public.ey_reports(id uuid primary key default gen_random_uuid(),student_id uuid not null references auth.users on delete cascade,question_id bigint not null references public.questions on delete cascade,reason text not null check(length(reason)between 10 and 1000),status text not null default 'OPEN' check(status in('OPEN','ACKNOWLEDGED','RESOLVED')),admin_note text not null default '',created_at timestamptz not null default now());
create index ey_reports_owner on public.ey_reports(student_id,created_at desc);
create index ey_reports_status on public.ey_reports(status,created_at desc);
create table public.ey_feedback(id uuid primary key default gen_random_uuid(),student_id uuid not null references auth.users on delete cascade,confusing text not null check(length(confusing)<=1000),stopped text not null check(length(stopped)<=1000),return_reason text not null check(length(return_reason)between 3 and 1000),day date not null default(now()at time zone 'Asia/Kolkata')::date,created_at timestamptz not null default now(),unique(student_id,day));
create table public.ey_public_counts(day date not null,event text not null check(event in('demo_started','demo_completed')),channel text not null check(channel in('direct','teacher','social','search')),count integer not null default 0,primary key(day,event,channel));
create table public.ey_demo_samples(id bigint primary key references public.questions,class_number integer not null,subject_name text not null);
-- A bounded public sample from existing active text-only practice items. Not an academic endorsement.
insert into public.ey_demo_samples select id,class_number,subject_name from(with ranked as(select q.id,cl.class_number,s.subject_name,row_number()over(partition by cl.class_number,s.subject_name order by md5(q.id::text))rn from public.questions q join public.chapters c on c.id=q.chapter_id join public.subjects s on s.id=c.subject_id join public.classes cl on cl.id=s.class_id where q.is_active and c.is_active and s.is_active and cl.is_active and cl.class_number in(9,10)and s.subject_name in('Mathematics','Science')and q.question_usage in('PRACTICE','SHARED')and q.media_ready and coalesce(q.question_media,'{}'::jsonb)='{}'::jsonb and q.question_text not like '%![%' and length(q.explanation)>10)select * from ranked where rn<=5)x;
do $$declare t text;begin foreach t in array array['ey_assignments','ey_sessions','ey_monthly_progress','ey_progress_receipts','ey_reports','ey_feedback','ey_public_counts','ey_demo_samples']loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;end$$;
-- Defense in depth: service-only tables. Browser reads and writes go through validated API handlers.
create policy ey_sessions_own on public.ey_sessions for select to authenticated using(student_id=(select auth.uid()));
create policy ey_assignments_own on public.ey_assignments for select to authenticated using(teacher_id=(select auth.uid()));
create policy ey_monthly_own on public.ey_monthly_progress for select to authenticated using(student_id=(select auth.uid()));
create policy ey_receipts_own on public.ey_progress_receipts for select to authenticated using(student_id=(select auth.uid()));
create policy ey_reports_own on public.ey_reports for select to authenticated using(student_id=(select auth.uid()));
create policy ey_feedback_own on public.ey_feedback for select to authenticated using(student_id=(select auth.uid()));
create function public.ey_snapshot(p_ids bigint[])returns jsonb language sql stable set search_path='' as $$select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'chapter_id',q.chapter_id,'subject_id',s.id,'chapter_name',c.chapter_name,'subject_name',s.subject_name,'question_text',public.cbse_media_text_v1(q.question_text,q.question_media,'question'),'option_a',public.cbse_media_text_v1(q.option_a,q.question_media,'A'),'option_b',public.cbse_media_text_v1(q.option_b,q.question_media,'B'),'option_c',public.cbse_media_text_v1(q.option_c,q.question_media,'C'),'option_d',public.cbse_media_text_v1(q.option_d,q.question_media,'D'),'correct_option',trim(q.correct_option),'explanation',public.cbse_media_text_v1(q.explanation,q.question_media,'explanation'))order by array_position(p_ids,q.id)),'[]'::jsonb)from public.questions q join public.chapters c on c.id=q.chapter_id join public.subjects s on s.id=c.subject_id where q.id=any(p_ids)and q.is_active and c.is_active and s.is_active and q.media_ready and q.question_type='MCQ' and q.question_usage in('PRACTICE','SHARED');$$;
create function public.ey_start(p_user uuid,p_class bigint,p_mode text,p_chapter bigint default null,p_assignment uuid default null)returns jsonb language plpgsql set search_path='' as $$
declare r public.ey_sessions;a public.ey_assignments;ids bigint[];qs jsonb;v_title text;today date:=(now()at time zone 'Asia/Kolkata')::date;
begin
 if not exists(select 1 from public.student_profiles where id=p_user and is_active)or not cbse_membership.can_access_class(p_user,p_class)then raise exception 'Class access required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('ey:'||p_user::text,0));
 if p_mode='DAILY'then
 select * into r from public.ey_sessions where student_id=p_user and class_id=p_class and day=today and mode='DAILY';if found then return to_jsonb(r);end if;
 select array_agg(id)into ids from(select q.id from public.questions q join public.chapters c on c.id=q.chapter_id join public.subjects s on s.id=c.subject_id where s.class_id=p_class and s.is_active and c.is_active and q.is_active and q.media_ready and q.question_type='MCQ'and q.question_usage in('PRACTICE','SHARED')and s.subject_name in('Mathematics','Science','Social Science','Physics','Chemistry','Biology')order by md5(q.id::text||today::text)limit 5)x;v_title:='Daily five · '||today::text;
 elsif p_mode='MISTAKES'then
 if(select count(*)from public.ey_sessions where student_id=p_user and day=today and mode='MISTAKES')>=20 then raise exception 'Daily revision limit reached';end if;
 select array_agg(id)into ids from(select distinct q.id from public.questions q join public.chapters c on c.id=q.chapter_id join public.subjects s on s.id=c.subject_id where s.class_id=p_class and s.is_active and c.is_active and q.is_active and q.media_ready and q.question_type='MCQ'and q.question_usage in('PRACTICE','SHARED')and(p_chapter is null or q.chapter_id=p_chapter)and(exists(select 1 from public.quiz_attempt_answers ans join public.quiz_attempts t on t.id=ans.attempt_id where t.student_id=p_user and t.status in('COMPLETED','Submitted','Reviewed')and coalesce(t.submitted_at,t.created_at)>now()-interval '14 days' and ans.question_id=q.id and not ans.is_correct)or exists(select 1 from public.ey_sessions e cross join lateral jsonb_array_elements(e.questions)v where e.student_id=p_user and e.completed_at>now()-interval '14 days'and(v->>'id')::bigint=q.id and e.answers->>(v->>'id')<>v->>'correct_option'))order by q.id limit 10)x;v_title:='Practise my mistakes';
 elsif p_mode='ASSIGNMENT'then
 select * into a from public.ey_assignments x where x.id=p_assignment and x.class_id=p_class and x.is_active and x.expires_at>now()and exists(select 1 from public.teacher_profiles t where t.id=x.teacher_id and t.is_active and t.starts_at<=now()and t.expires_at>now());if not found then raise exception 'Assignment unavailable for your class'using errcode='42501';end if;
 select * into r from public.ey_sessions where student_id=p_user and assignment_id=p_assignment;if found then return to_jsonb(r);end if;qs:=a.questions;v_title:=a.title;
 else raise exception 'Unknown mode';end if;
 if qs is null then qs:=public.ey_snapshot(ids);end if;
 if jsonb_array_length(qs)=0 then raise exception 'No eligible questions available';end if;
 insert into public.ey_sessions(student_id,class_id,mode,title,questions,assignment_id)values(p_user,p_class,p_mode,v_title,qs,case when p_mode='ASSIGNMENT'then p_assignment else null end)returning * into r;return to_jsonb(r);
end$$;
create function public.ey_answer(p_user uuid,p_session uuid,p_question bigint,p_answer text)returns jsonb language plpgsql set search_path='' as $$
declare r public.ey_sessions;selected_q jsonb;n integer;s bigint;c integer;
begin
 if p_answer is null or p_answer not in('A','B','C','D')then raise exception 'Choose A, B, C or D';end if;
 select * into r from public.ey_sessions where id=p_session and student_id=p_user and created_at>now()-interval '14 days'for update;if not found then raise exception 'Session unavailable'using errcode='42501';end if;
 if not cbse_membership.can_access_class(p_user,r.class_id)then raise exception 'Class access required'using errcode='42501';end if;
 if r.assignment_id is not null and not exists(select 1 from public.ey_assignments a join public.teacher_profiles t on t.id=a.teacher_id where a.id=r.assignment_id and a.is_active and a.expires_at>now()and t.is_active and t.starts_at<=now()and t.expires_at>now())then raise exception 'Assignment closed';end if;
 select x into selected_q from jsonb_array_elements(r.questions)x where(x->>'id')::bigint=p_question;if selected_q is null then raise exception 'Question not assigned';end if;
 if r.answers?p_question::text or r.completed_at is not null then return to_jsonb(r);end if;
 r.answers:=r.answers||jsonb_build_object(p_question::text,p_answer);select count(*)into n from jsonb_object_keys(r.answers);if n=jsonb_array_length(r.questions)then r.completed_at:=now();end if;
 update public.ey_sessions set answers=r.answers,completed_at=r.completed_at where id=r.id;
 if r.completed_at is not null then
 insert into public.ey_progress_receipts(receipt,student_id)values('growth:'||r.id::text,p_user)on conflict do nothing;
 if found then
 for s,n,c in select(v->>'subject_id')::bigint,count(*)::int,count(*)filter(where r.answers->>(v->>'id')=v->>'correct_option')::int from jsonb_array_elements(r.questions)v group by 1 loop
 insert into public.ey_monthly_progress values(p_user,date_trunc('month',now()at time zone 'Asia/Kolkata')::date,r.mode,s,1,n,c)on conflict(student_id,month,source,subject_id)do update set sessions=public.ey_monthly_progress.sessions+1,answered=public.ey_monthly_progress.answered+excluded.answered,correct=public.ey_monthly_progress.correct+excluded.correct;
 end loop;end if;end if;return to_jsonb(r);
end$$;
create function public.ey_create_assignment(p_teacher uuid,p_subject bigint,p_chapter bigint,p_title text,p_days integer)returns uuid language plpgsql set search_path='' as $$
declare ids bigint[];result uuid;cls bigint;expiry timestamptz;
begin
 if p_days not between 1 and 30 or length(p_title)not between 3 and 100 then raise exception 'Check title and expiry';end if;
 select t.class_id,t.expires_at into cls,expiry from public.teacher_profiles t join public.subjects s on s.class_id=t.class_id join public.chapters c on c.subject_id=s.id where t.id=p_teacher and t.is_active and t.starts_at<=now()and t.expires_at>now()and s.id=p_subject and c.id=p_chapter and s.is_active and c.is_active;if not found then raise exception 'Assigned teacher class required'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('ey:teacher:'||p_teacher::text,0));if(select count(*)from public.ey_assignments where teacher_id=p_teacher and created_at>now()-interval '1 day')>=10 then raise exception 'Ten quizzes per day maximum';end if;
 select array_agg(id)into ids from(select id from public.questions where chapter_id=p_chapter and is_active and media_ready and question_type='MCQ'and question_usage in('PRACTICE','SHARED')order by md5(id::text||p_teacher::text||(now()at time zone 'Asia/Kolkata')::date::text)limit 10)x;
 if coalesce(cardinality(ids),0)=0 then raise exception 'No eligible chapter questions';end if;
 insert into public.ey_assignments(teacher_id,class_id,subject_id,chapter_id,title,questions,expires_at)values(p_teacher,cls,p_subject,p_chapter,p_title,public.ey_snapshot(ids),least(expiry,now()+make_interval(days=>p_days)))returning id into result;return result;
end$$;
create schema if not exists ey_internal;revoke all on schema ey_internal from public,anon,authenticated;
create function ey_internal.capture_progress()returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.status not in('COMPLETED','Submitted','Reviewed')then return new;end if;
 insert into public.ey_progress_receipts(receipt,student_id)values('attempt:'||new.id::text,new.student_id)on conflict do nothing;if not found then return new;end if;
 insert into public.ey_monthly_progress values(new.student_id,date_trunc('month',coalesce(new.submitted_at,new.created_at)at time zone 'Asia/Kolkata')::date,'TEST',new.subject_id,1,coalesce(new.total_questions,0),coalesce(new.correct_answers,0))on conflict(student_id,month,source,subject_id)do update set sessions=public.ey_monthly_progress.sessions+1,answered=public.ey_monthly_progress.answered+excluded.answered,correct=public.ey_monthly_progress.correct+excluded.correct;return new;
end$$;
revoke all on function ey_internal.capture_progress()from public,anon,authenticated;
create trigger ey_capture_progress after insert or update of status on public.quiz_attempts for each row execute function ey_internal.capture_progress();
with r as(insert into public.ey_progress_receipts(receipt,student_id,created_at)select 'attempt:'||id::text,student_id,coalesce(submitted_at,created_at)from public.quiz_attempts where status in('COMPLETED','Submitted','Reviewed')on conflict do nothing returning receipt)insert into public.ey_monthly_progress select a.student_id,date_trunc('month',coalesce(a.submitted_at,a.created_at)at time zone 'Asia/Kolkata')::date,'TEST',a.subject_id,count(*)::int,coalesce(sum(a.total_questions),0)::int,coalesce(sum(a.correct_answers),0)::int from public.quiz_attempts a join r on r.receipt='attempt:'||a.id::text group by 1,2,4 on conflict(student_id,month,source,subject_id)do nothing;
create function public.ey_public_event(p_event text,p_channel text)returns void language plpgsql set search_path='' as $$begin if p_event not in('demo_started','demo_completed')or p_channel not in('direct','teacher','social','search')then raise exception 'Invalid event';end if;insert into public.ey_public_counts values((now()at time zone 'Asia/Kolkata')::date,p_event,p_channel,1)on conflict(day,event,channel)do update set count=least(public.ey_public_counts.count+1,10000);end$$;
do $$declare fn regprocedure;begin for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('ey_snapshot','ey_start','ey_answer','ey_create_assignment','ey_public_event')loop execute format('revoke all on function %s from public,anon,authenticated',fn);execute format('grant execute on function %s to service_role',fn);end loop;end$$;
select cron.schedule('ey-growth-retention','10 3 * * *',$job$
 delete from public.ey_sessions where created_at<now()-interval '14 days';
 delete from public.ey_monthly_progress where month<date_trunc('month',now())-interval '11 months';
 delete from public.ey_progress_receipts where created_at<now()-interval '13 months';
 delete from public.ey_feedback where created_at<now()-interval '90 days';
 delete from public.ey_reports where created_at<now()-interval '180 days'and status='RESOLVED';
 delete from public.ey_public_counts where day<current_date-365;
 delete from public.ey_assignments where expires_at<now()-interval '30 days';
$job$);
