-- Deployment source: teacher access is separate from student test entitlements.
create table public.teacher_profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null, class_id bigint not null references public.classes(id),
 is_active boolean not null default true, starts_at timestamptz not null default now(),
 expires_at timestamptz not null, created_by uuid not null, created_at timestamptz not null default now()
);
create index teacher_profiles_class_idx on public.teacher_profiles(class_id);
create table public.teacher_review_sets (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
 subject_id bigint not null references public.subjects(id), chapter_scope bigint not null default 0,
 set_number integer not null, question_ids bigint[] not null,
 unique(teacher_id,subject_id,chapter_scope,set_number)
);
create table public.teacher_question_reviews (
 id uuid primary key default gen_random_uuid(), teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
 question_id bigint not null references public.questions(id), decision text not null check(decision in ('APPROVE','DELETE','CORRECT')),
 comment text not null default '' check(length(comment)<=4000), suggested_option text check(suggested_option in ('A','B','C','D')),
 suggested_explanation text not null default '' check(length(suggested_explanation)<=8000),
 question_snapshot jsonb not null, resolution text not null default 'PENDING' check(resolution in ('PENDING','APPROVED','KEPT','REMOVED','CORRECTED')),
 admin_note text not null default '', resolved_by uuid, resolved_at timestamptz, updated_at timestamptz not null default now(),
 unique(teacher_id,question_id)
);
create index teacher_reviews_question_idx on public.teacher_question_reviews(question_id);
create index teacher_reviews_queue_idx on public.teacher_question_reviews(resolution,decision,updated_at desc);
create table public.teacher_review_audit (
 id bigint generated always as identity primary key,review_id uuid,actor_id uuid not null,
 action text not null,details jsonb not null,created_at timestamptz not null default now()
);
create table public.teacher_mcq_submissions (
 id uuid primary key default gen_random_uuid(),teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
 subject_id bigint not null references public.subjects(id),chapter_id bigint references public.chapters(id),
 note text not null default '' check(length(note)<=4000),
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','UNDER_REVIEW','ADDED','NOT_USED')),
 admin_note text not null default '' check(length(admin_note)<=4000),updated_by uuid,
 created_at timestamptz not null default now(),submitted_at timestamptz,updated_at timestamptz not null default now()
);
create index teacher_submissions_queue_idx on public.teacher_mcq_submissions(status,created_at desc);
create index teacher_submissions_teacher_idx on public.teacher_mcq_submissions(teacher_id);
create table public.teacher_mcq_files (
 id uuid primary key default gen_random_uuid(),submission_id uuid not null references public.teacher_mcq_submissions(id) on delete cascade,
 file_name text not null check(length(file_name)<=200),object_path text not null unique,
 mime_type text not null,file_size bigint not null check(file_size>0 and file_size<=10485760),uploaded boolean not null default false,
 created_at timestamptz not null default now()
);
-- All data goes through server endpoints; no browser table grants or storage policies.
alter table public.teacher_profiles enable row level security;
alter table public.teacher_review_sets enable row level security;
alter table public.teacher_question_reviews enable row level security;
alter table public.teacher_review_audit enable row level security;
alter table public.teacher_mcq_submissions enable row level security;
alter table public.teacher_mcq_files enable row level security;
revoke all on public.teacher_profiles,public.teacher_review_sets,public.teacher_question_reviews,public.teacher_review_audit,public.teacher_mcq_submissions,public.teacher_mcq_files from public,anon,authenticated;
grant all on public.teacher_profiles,public.teacher_review_sets,public.teacher_question_reviews,public.teacher_review_audit,public.teacher_mcq_submissions,public.teacher_mcq_files to service_role;
grant usage,select on sequence public.teacher_review_audit_id_seq to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('teacher-mcq-submissions','teacher-mcq-submissions',false,10485760,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg','image/png'])
on conflict(id) do nothing;

alter table public.admin_student_creation_requests add column account_role text not null default 'STUDENT' check(account_role in ('STUDENT','TEACHER'));
create function cbse_membership.admin_creation_begin_v2(p_actor uuid,p_request uuid,p_name text,p_email text,p_class bigint,p_paid boolean,p_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_role is null or p_role not in ('STUDENT','TEACHER') or (p_role='TEACHER' and not p_paid) then raise exception 'Teachers require paid access' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('create-account:'||p_request::text,0));
 if exists(select 1 from public.admin_student_creation_requests where request_id=p_request and account_role<>p_role) then raise exception 'Account role conflicts with request' using errcode='22023';end if;
 result:=cbse_membership.admin_creation_begin(p_actor,p_request,p_name,p_email,p_class,p_paid);
 update public.admin_student_creation_requests set account_role=p_role where request_id=p_request and actor_id=p_actor;
 return result;
end $$;
create function public.admin_account_creation_begin_v2(p_actor uuid,p_request uuid,p_name text,p_email text,p_class bigint,p_paid boolean,p_role text) returns jsonb language sql security invoker set search_path='' as $$select cbse_membership.admin_creation_begin_v2(p_actor,p_request,p_name,p_email,p_class,p_paid,p_role);$$;
revoke all on function cbse_membership.admin_creation_begin_v2(uuid,uuid,text,text,bigint,boolean,text),public.admin_account_creation_begin_v2(uuid,uuid,text,text,bigint,boolean,text) from public,anon,authenticated;
grant execute on function cbse_membership.admin_creation_begin_v2(uuid,uuid,text,text,bigint,boolean,text),public.admin_account_creation_begin_v2(uuid,uuid,text,text,bigint,boolean,text) to service_role;

-- Prevent teacher profiles being reactivated as students, including through legacy self-updates.
create function cbse_membership.teacher_student_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.teacher_profiles where id=new.id) then new.is_active:=false;end if;
 return new;
end $$;
-- SECURITY DEFINER is required for the trigger's private role lookup, not exposed as an RPC.
alter function cbse_membership.teacher_student_guard() security definer;
revoke all on function cbse_membership.teacher_student_guard() from public,anon,authenticated;
create trigger teacher_student_guard before update on public.student_profiles for each row execute function cbse_membership.teacher_student_guard();

create function cbse_membership.teacher_context(p_user uuid,p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.teacher_profiles;
begin
 if not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>now())) then return null;end if;
 select * into t from public.teacher_profiles where id=p_user;
 if not found then return null;end if;
 return to_jsonb(t);
end $$;
create function public.cbse_teacher_context_v1(p_user uuid,p_session uuid) returns jsonb language sql security invoker set search_path='' as $$select cbse_membership.teacher_context(p_user,p_session);$$;
revoke all on function cbse_membership.teacher_context(uuid,uuid),public.cbse_teacher_context_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function cbse_membership.teacher_context(uuid,uuid),public.cbse_teacher_context_v1(uuid,uuid) to service_role;

create function public.cbse_teacher_sets_v1(p_teacher uuid,p_subject bigint,p_chapter bigint default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.teacher_profiles t join public.subjects s on s.class_id=t.class_id where t.id=p_teacher and t.is_active and t.starts_at<=now() and t.expires_at>now() and s.id=p_subject and s.is_active) then raise exception 'Subject not available' using errcode='42501';end if;
 if p_chapter<>0 and not exists(select 1 from public.chapters where id=p_chapter and subject_id=p_subject and is_active) then raise exception 'Chapter not available' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('teacher-sets:'||p_teacher||':'||p_subject||':'||p_chapter,0));
 if not exists(select 1 from public.teacher_review_sets where teacher_id=p_teacher and subject_id=p_subject and chapter_scope=p_chapter) then
 insert into public.teacher_review_sets(teacher_id,subject_id,chapter_scope,set_number,question_ids)
 select p_teacher,p_subject,p_chapter,((rn-1)/60+1)::integer,array_agg(id order by rn) from
 (select q.id,row_number() over(order by c.chapter_number,c.id,q.id) rn from public.questions q join public.chapters c on c.id=q.chapter_id where c.subject_id=p_subject and c.is_active and q.is_active and q.question_type='MCQ' and (p_chapter=0 or c.id=p_chapter)) x group by ((rn-1)/60+1);
 end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by set_number) from
 (select s.id,s.set_number,cardinality(s.question_ids) total,
 (select count(*) from public.teacher_question_reviews r where r.teacher_id=p_teacher and r.question_id=any(s.question_ids) and r.question_snapshot=public.cbse_teacher_question_snapshot(r.question_id)) reviewed
 from public.teacher_review_sets s where s.teacher_id=p_teacher and s.subject_id=p_subject and s.chapter_scope=p_chapter) x),'[]'::jsonb);
end $$;
create function public.cbse_teacher_question_snapshot(p_question bigint) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('question_text',question_text,'option_a',option_a,'option_b',option_b,'option_c',option_c,'option_d',option_d,'correct_option',correct_option,'explanation',explanation,'chapter_id',chapter_id,'question_media',question_media,'is_active',is_active) from public.questions where id=p_question;
$$;
create function public.cbse_teacher_save_review_v1(p_teacher uuid,p_question bigint,p_decision text,p_comment text,p_option text,p_explanation text,p_snapshot jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare snap jsonb; rid uuid;
begin
 if p_decision is null or p_decision not in ('APPROVE','DELETE','CORRECT') or length(coalesce(p_comment,''))>4000 or length(coalesce(p_explanation,''))>8000 then raise exception 'Invalid review' using errcode='22023';end if;
 if p_decision<>'APPROVE' and length(btrim(coalesce(p_comment,'')))=0 then raise exception 'Add a reason or correction comment' using errcode='22023';end if;
 if p_decision='CORRECT' and (p_option is null or p_option not in ('A','B','C','D') or length(btrim(coalesce(p_explanation,'')))=0) then raise exception 'Select the correct answer and add an explanation' using errcode='22023';end if;
 perform 1 from public.questions q join public.chapters c on c.id=q.chapter_id join public.subjects s on s.id=c.subject_id join public.teacher_profiles t on t.class_id=s.class_id
 where q.id=p_question and q.is_active and q.question_type='MCQ' and c.is_active and s.is_active and t.id=p_teacher and t.is_active and t.starts_at<=now() and t.expires_at>now() for share of q;
 if not found then raise exception 'Question not available' using errcode='42501';end if;
 snap:=public.cbse_teacher_question_snapshot(p_question);
 if snap is distinct from p_snapshot then raise exception 'Question changed. Reload it before saving.' using errcode='40001';end if;
 insert into public.teacher_question_reviews(teacher_id,question_id,decision,comment,suggested_option,suggested_explanation,question_snapshot,resolution)
 values(p_teacher,p_question,p_decision,coalesce(p_comment,''),case when p_decision='CORRECT' then p_option end,case when p_decision='CORRECT' then p_explanation else '' end,snap,case when p_decision='APPROVE' then 'APPROVED' else 'PENDING' end)
 on conflict(teacher_id,question_id) do update set decision=excluded.decision,comment=excluded.comment,suggested_option=excluded.suggested_option,suggested_explanation=excluded.suggested_explanation,question_snapshot=snap,resolution=excluded.resolution,admin_note='',resolved_by=null,resolved_at=null,updated_at=now() returning id into rid;
 insert into public.teacher_review_audit(review_id,actor_id,action,details) values(rid,p_teacher,'TEACHER_REVIEW',jsonb_build_object('decision',p_decision,'comment',p_comment,'option',p_option,'explanation',p_explanation,'snapshot',snap));
 return rid;
end $$;
create function public.cbse_admin_resolve_teacher_review_v1(p_actor uuid,p_review uuid,p_action text,p_note text,p_option text,p_explanation text,p_review_version timestamptz) returns void language plpgsql security invoker set search_path='' as $$
declare r public.teacher_question_reviews; snap jsonb; resolution text;
begin
 if not exists(select 1 from public.admin_profiles p join public.admin_users a on a.user_id=p.id where p.id=p_actor and p.role='FULL_ADMIN' and p.is_active and not p.must_change_password) then raise exception 'Full Admin required' using errcode='42501';end if;
 select * into r from public.teacher_question_reviews where id=p_review for update;
 if not found or r.resolution<>'PENDING' or r.updated_at is distinct from p_review_version then raise exception 'Review changed or already resolved. Reload the queue.' using errcode='40001';end if;
 if p_action not in ('KEEP','REMOVE','CORRECT') or p_action is null or length(coalesce(p_note,''))>4000 then raise exception 'Invalid action' using errcode='22023';end if;
 perform 1 from public.questions where id=r.question_id for update;
 snap:=public.cbse_teacher_question_snapshot(r.question_id);
 if p_action<>'KEEP' and snap is distinct from r.question_snapshot then raise exception 'Question changed since teacher review. Keep this report and request a fresh review.' using errcode='40001';end if;
 if p_action='REMOVE' then
 if r.decision<>'DELETE' then raise exception 'This is not a deletion recommendation' using errcode='22023';end if;
 update public.questions set is_active=false,updated_at=now() where id=r.question_id;resolution:='REMOVED';
 elsif p_action='CORRECT' then
 if r.decision<>'CORRECT' or p_option is null or p_option not in ('A','B','C','D') or length(btrim(coalesce(p_explanation,'')))=0 or length(p_explanation)>8000 then raise exception 'Correct answer and explanation required' using errcode='22023';end if;
 update public.questions set correct_option=p_option,explanation=p_explanation,updated_at=now() where id=r.question_id;resolution:='CORRECTED';
 else resolution:='KEPT';end if;
 update public.teacher_question_reviews set resolution=case p_action when 'REMOVE' then 'REMOVED' when 'CORRECT' then 'CORRECTED' else 'KEPT' end,admin_note=coalesce(p_note,''),resolved_by=p_actor,resolved_at=now(),updated_at=now() where id=p_review;
 insert into public.teacher_review_audit(review_id,actor_id,action,details) values(r.id,p_actor,p_action,jsonb_build_object('note',p_note,'before',snap,'after',public.cbse_teacher_question_snapshot(r.question_id)));
end $$;
revoke all on function public.cbse_teacher_sets_v1(uuid,bigint,bigint),public.cbse_teacher_question_snapshot(bigint),public.cbse_teacher_save_review_v1(uuid,bigint,text,text,text,text,jsonb),public.cbse_admin_resolve_teacher_review_v1(uuid,uuid,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.cbse_teacher_sets_v1(uuid,bigint,bigint),public.cbse_teacher_question_snapshot(bigint),public.cbse_teacher_save_review_v1(uuid,bigint,text,text,text,text,jsonb),public.cbse_admin_resolve_teacher_review_v1(uuid,uuid,text,text,text,text,timestamptz) to service_role;
create function public.cbse_admin_teacher_access_v1(p_actor uuid,p_teacher uuid,p_action text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.teacher_profiles;
begin
 if not exists(select 1 from public.admin_profiles p join public.admin_users a on a.user_id=p.id where p.id=p_actor and p.role='FULL_ADMIN' and p.is_active and not p.must_change_password) then raise exception 'Full Admin required' using errcode='42501';end if;
 if p_action is null or p_action not in ('RENEW','SUSPEND','ENABLE') then raise exception 'Invalid action';end if;
 select * into t from public.teacher_profiles where id=p_teacher for update;if not found then raise exception 'Teacher not found';end if;
 update public.teacher_profiles set is_active=case when p_action='SUSPEND' then false else true end,
 expires_at=case when p_action='RENEW' then ((greatest(expires_at,now()) at time zone 'Asia/Kolkata')+interval '13 months') at time zone 'Asia/Kolkata' else expires_at end where id=p_teacher returning * into t;
 insert into public.teacher_review_audit(actor_id,action,details) values(p_actor,'TEACHER_'||p_action,jsonb_build_object('teacher',p_teacher,'expires_at',t.expires_at));return to_jsonb(t);
end $$;
revoke all on function public.cbse_admin_teacher_access_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.cbse_admin_teacher_access_v1(uuid,uuid,text) to service_role;
-- Teacher browser tokens must not enter student-only Data API endpoints, including legacy RPCs.
create or replace function cbse_sessions.api_guard() returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null then return;end if;
 if exists(select 1 from public.admin_users where user_id=u) then return;end if;
 if current_setting('request.path',true)='/rpc/cbse_claim_student_session_v1' then return;end if;
 if exists(select 1 from public.teacher_profiles where id=u) then raise sqlstate 'PT403' using message='Use the teacher workspace for this account.';end if;
 if not (select enabled from cbse_sessions.policy where singleton) then return;end if;
 if not cbse_sessions.allowed() then raise sqlstate 'PT403' using message='You were signed out because your account was used on another device. Only two active sessions are allowed.',detail='CBSE_SESSION_REVOKED';end if;
end $$;
create or replace function public.is_active_student() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.student_profiles sp where sp.id=auth.uid() and sp.is_active)
 and not exists(select 1 from public.admin_users a where a.user_id=auth.uid())
 and not exists(select 1 from public.teacher_profiles t where t.id=auth.uid()) and cbse_sessions.allowed();
$$;
