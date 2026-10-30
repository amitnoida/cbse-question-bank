-- Only Full Admin, via server-side Auth Admin API, can provision verified students.
alter table public.student_profiles add column initial_class_id bigint references public.classes(id);
update public.student_profiles p set initial_class_id=coalesce((select e.class_id from public.student_enrollments e where e.student_id=p.id order by e.enrolled_at,e.id limit 1),p.home_class_id,p.class_id);
create index student_profiles_initial_class_idx on public.student_profiles(initial_class_id);
create or replace function public.cbse_profile_home_guard_v1() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then new.home_class_id:=new.class_id;new.initial_class_id:=new.class_id;
 elsif current_user not in ('postgres','service_role') and
 (new.home_class_id is distinct from old.home_class_id or new.class_id is distinct from old.class_id or new.initial_class_id is distinct from old.initial_class_id) then
 raise exception 'Use the authorised class switch' using errcode='42501';end if;return new;
end $$;
create table public.admin_student_creation_requests(
 request_id uuid primary key,actor_id uuid not null,full_name text not null,email text not null,
 class_id bigint not null references public.classes(id),paid boolean not null,user_id uuid,
 status text not null default 'PENDING' check(status in ('PENDING','FAILED','COMPLETE')),
 result jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index admin_student_creation_class_idx on public.admin_student_creation_requests(class_id);
alter table public.admin_student_creation_requests enable row level security;
revoke all on public.admin_student_creation_requests from public,anon,authenticated;
-- No browser access or stored passwords. Mutations go through service-only wrappers below.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.student_profiles(id,full_name,mobile_number,class_id,is_active)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),null,nullif(new.raw_user_meta_data->>'class_id','')::bigint,
 not (coalesce(new.raw_app_meta_data,'{}'::jsonb) ? 'admin_student_request'))
 on conflict(id) do nothing;
 return new;
end $$;
create function cbse_membership.admin_creation_begin(p_actor uuid,p_request uuid,p_name text,p_email text,p_class bigint,p_paid boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.admin_student_creation_requests; inserted boolean; recovered uuid;
begin
 if not exists(select 1 from public.admin_profiles p join public.admin_users a on a.user_id=p.id where p.id=p_actor and p.role='FULL_ADMIN' and p.is_active and not p.must_change_password) then raise exception 'Full Admin required' using errcode='42501';end if;
 if p_request is null or p_name is null or length(btrim(p_name)) not between 1 and 120 or p_email is null or length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_paid is null then raise exception 'Invalid account details' using errcode='22023';end if;
 if not exists(select 1 from public.classes where id=p_class and is_active and class_number between 8 and 12) then raise exception 'Choose an active school class' using errcode='22023';end if;
 insert into public.admin_student_creation_requests(request_id,actor_id,full_name,email,class_id,paid)
 values(p_request,p_actor,btrim(p_name),lower(btrim(p_email)),p_class,p_paid) on conflict(request_id) do nothing;
 inserted:=found;
 select * into r from public.admin_student_creation_requests where request_id=p_request for update;
 if r.actor_id<>p_actor or r.full_name<>btrim(p_name) or r.email<>lower(btrim(p_email)) or r.class_id<>p_class or r.paid<>p_paid then raise exception 'Creation request does not match' using errcode='42501';end if;
 if r.status='COMPLETE' then return jsonb_build_object('status','COMPLETE','result',r.result);end if;
 -- Recover only an Auth user created by this exact request, never an existing email account.
 select u.id into recovered from auth.users u where u.raw_app_meta_data->>'admin_student_request'=p_request::text
 and u.raw_app_meta_data->>'admin_student_actor'=p_actor::text and lower(u.email)=r.email;
 if recovered is not null then
 update public.admin_student_creation_requests set user_id=recovered,updated_at=now() where request_id=p_request;
 return jsonb_build_object('status','RECOVER','user_id',recovered);
 end if;
 if not inserted and r.status='PENDING' and r.updated_at>now()-interval '5 minutes' then return jsonb_build_object('status','BUSY');end if;
 update public.admin_student_creation_requests set status='PENDING',updated_at=now() where request_id=p_request;
 return jsonb_build_object('status','CREATE');
end $$;
create function cbse_membership.admin_creation_finish(p_actor uuid,p_request uuid,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.admin_student_creation_requests; u record; pid bigint; sid bigint; starts timestamptz:=now();ends timestamptz; product text; v_result jsonb;
begin
 if not exists(select 1 from public.admin_profiles p join public.admin_users a on a.user_id=p.id where p.id=p_actor and p.role='FULL_ADMIN' and p.is_active and not p.must_change_password) then raise exception 'Full Admin required' using errcode='42501';end if;
 select * into r from public.admin_student_creation_requests where request_id=p_request for update;
 if not found or r.actor_id<>p_actor then raise exception 'Creation request not found' using errcode='42501';end if;
 if r.status='COMPLETE' then return r.result;end if;
 select id,email,email_confirmed_at,raw_app_meta_data into u from auth.users where id=p_user;
 if not found or u.email_confirmed_at is null or lower(u.email)<>r.email or u.raw_app_meta_data->>'admin_student_request' is distinct from p_request::text or u.raw_app_meta_data->>'admin_student_actor' is distinct from p_actor::text
 or exists(select 1 from public.admin_users where user_id=p_user) then raise exception 'Created student identity cannot be verified' using errcode='42501';end if;
 if not exists(select 1 from public.classes where id=r.class_id and is_active and class_number between 8 and 12) then raise exception 'School class is no longer active';end if;
 update public.student_profiles set full_name=r.full_name,class_id=r.class_id,home_class_id=r.class_id,initial_class_id=r.class_id,is_active=true where id=p_user;
 if not found then raise exception 'Student profile is missing';end if;
 insert into public.student_enrollments(student_id,class_id) values(p_user,r.class_id) on conflict(student_id,class_id) do nothing;
 if r.paid then
 ends:=((starts at time zone 'Asia/Kolkata')+interval '1 year') at time zone 'Asia/Kolkata';
 select 'CLASS_'||class_number into product from public.classes where id=r.class_id;
 insert into public.subscription_plans(plan_name,plan_code,price,description,is_active)
 values('Administrator granted annual membership','ADMIN_ONE_YEAR',0,'One year of class-scoped Practice and Real Mock granted by Full Admin',false)
 on conflict(plan_code) do update set plan_code=excluded.plan_code returning id into pid;
 insert into public.subscriptions(student_id,plan_id,status,start_date,end_date,payment_reference,amount_paid,covered_class_ids,membership_product_code,activation_policy,activation_request_id)
 values(p_user,pid,'ACTIVE',starts,ends,'ADMIN_GRANT:'||p_request::text,0,array[r.class_id],product,'NOW',p_request) returning id into sid;
 end if;
 v_result:=jsonb_build_object('user_id',p_user,'email',r.email,'full_name',r.full_name,'class_id',r.class_id,'membership',case when r.paid then 'PAID' else 'FREE' end,'email_verified',true,'start_date',case when r.paid then starts else null end,'end_date',ends);
 insert into public.membership_events(student_id,actor_id,event_type,details) values(p_user,p_actor,'ADMIN_STUDENT_CREATED',jsonb_build_object('class_id',r.class_id,'paid',r.paid,'subscription_id',sid,'request_id',p_request));
 update public.admin_student_creation_requests set status='COMPLETE',user_id=p_user,result=v_result,updated_at=now() where request_id=p_request;
 return v_result;
end $$;
create function cbse_membership.admin_creation_failed(p_actor uuid,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.admin_profiles p join public.admin_users a on a.user_id=p.id where p.id=p_actor and p.role='FULL_ADMIN' and p.is_active and not p.must_change_password) then raise exception 'Full Admin required' using errcode='42501';end if;
 update public.admin_student_creation_requests set status='FAILED',updated_at=now() where request_id=p_request and actor_id=p_actor and status<>'COMPLETE';
end $$;
create function public.admin_student_creation_begin_v1(p_actor uuid,p_request uuid,p_name text,p_email text,p_class bigint,p_paid boolean) returns jsonb language sql security invoker set search_path='' as $$select cbse_membership.admin_creation_begin(p_actor,p_request,p_name,p_email,p_class,p_paid);$$;
create function public.admin_student_creation_finish_v1(p_actor uuid,p_request uuid,p_user uuid) returns jsonb language sql security invoker set search_path='' as $$select cbse_membership.admin_creation_finish(p_actor,p_request,p_user);$$;
create function public.admin_student_creation_failed_v1(p_actor uuid,p_request uuid) returns void language sql security invoker set search_path='' as $$select cbse_membership.admin_creation_failed(p_actor,p_request);$$;
revoke all on function cbse_membership.admin_creation_begin(uuid,uuid,text,text,bigint,boolean),cbse_membership.admin_creation_finish(uuid,uuid,uuid),cbse_membership.admin_creation_failed(uuid,uuid),public.admin_student_creation_begin_v1(uuid,uuid,text,text,bigint,boolean),public.admin_student_creation_finish_v1(uuid,uuid,uuid),public.admin_student_creation_failed_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function cbse_membership.admin_creation_begin(uuid,uuid,text,text,bigint,boolean),cbse_membership.admin_creation_finish(uuid,uuid,uuid),cbse_membership.admin_creation_failed(uuid,uuid),public.admin_student_creation_begin_v1(uuid,uuid,text,text,bigint,boolean),public.admin_student_creation_finish_v1(uuid,uuid,uuid),public.admin_student_creation_failed_v1(uuid,uuid) to service_role;
