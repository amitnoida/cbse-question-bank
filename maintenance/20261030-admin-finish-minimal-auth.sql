create or replace function cbse_membership.admin_creation_finish(p_actor uuid,p_request uuid,p_user uuid) returns jsonb
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
