create or replace function public.cbse_teacher_sets_v1(p_teacher uuid,p_subject bigint,p_chapter bigint default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
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
 (select s.id,s.set_number,(select count(*) from public.questions q join public.chapters c on c.id=q.chapter_id where q.id=any(s.question_ids) and q.is_active and q.question_type='MCQ' and c.is_active) total,
 (select count(*) from public.teacher_question_reviews r where r.teacher_id=p_teacher and r.question_id=any(s.question_ids) and r.question_snapshot=public.cbse_teacher_question_snapshot(r.question_id)) reviewed
 from public.teacher_review_sets s where s.teacher_id=p_teacher and s.subject_id=p_subject and s.chapter_scope=p_chapter) x),'[]'::jsonb);
end $$;
CREATE OR REPLACE FUNCTION cbse_membership.admin_creation_finish(p_actor uuid, p_request uuid, p_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if r.account_role='TEACHER' then
 ends:=((starts at time zone 'Asia/Kolkata')+interval '13 months') at time zone 'Asia/Kolkata';
 insert into public.teacher_profiles(id,full_name,class_id,starts_at,expires_at,created_by) values(p_user,r.full_name,r.class_id,starts,ends,p_actor);
 update public.student_profiles set is_active=false where id=p_user;
 v_result:=jsonb_build_object('user_id',p_user,'email',r.email,'full_name',r.full_name,'class_id',r.class_id,'account_role','TEACHER','membership','PAID','email_verified',true,'start_date',starts,'end_date',ends);
 insert into public.membership_events(student_id,actor_id,event_type,details) values(p_user,p_actor,'ADMIN_TEACHER_CREATED',jsonb_build_object('class_id',r.class_id,'request_id',p_request,'expires_at',ends));
 update public.admin_student_creation_requests set status='COMPLETE',user_id=p_user,result=v_result,updated_at=now() where request_id=p_request;
 return v_result;
 end if;
 update public.student_profiles set full_name=r.full_name,class_id=r.class_id,home_class_id=r.class_id,initial_class_id=r.class_id,is_active=true where id=p_user;
 if not found then raise exception 'Student profile is missing';end if;
 insert into public.student_enrollments(student_id,class_id) values(p_user,r.class_id) on conflict(student_id,class_id) do nothing;
 if r.paid then
 ends:=((starts at time zone 'Asia/Kolkata')+interval '13 months') at time zone 'Asia/Kolkata';
 select 'CLASS_'||class_number into product from public.classes where id=r.class_id;
 insert into public.subscription_plans(plan_name,plan_code,price,description,is_active)
 values('Administrator granted 13-month membership','ADMIN_13_MONTHS',0,'13 months of class-scoped Practice and Real Mock granted by Full Admin',false)
 on conflict(plan_code) do update set plan_code=excluded.plan_code returning id into pid;
 insert into public.subscriptions(student_id,plan_id,status,start_date,end_date,payment_reference,amount_paid,covered_class_ids,membership_product_code,activation_policy,activation_request_id)
 values(p_user,pid,'ACTIVE',starts,ends,'ADMIN_GRANT:'||p_request::text,0,array[r.class_id],product,'NOW',p_request) returning id into sid;
 end if;
 v_result:=jsonb_build_object('user_id',p_user,'email',r.email,'full_name',r.full_name,'class_id',r.class_id,'membership',case when r.paid then 'PAID' else 'FREE' end,'email_verified',true,'start_date',case when r.paid then starts else null end,'end_date',ends);
 insert into public.membership_events(student_id,actor_id,event_type,details) values(p_user,p_actor,'ADMIN_STUDENT_CREATED',jsonb_build_object('class_id',r.class_id,'paid',r.paid,'subscription_id',sid,'request_id',p_request));
 update public.admin_student_creation_requests set status='COMPLETE',user_id=p_user,result=v_result,updated_at=now() where request_id=p_request;
 return v_result;
end $function$;
