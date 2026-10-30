CREATE OR REPLACE FUNCTION cbse_membership.student_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); p public.student_profiles; simple boolean; result jsonb;
begin
 if u is null or not public.is_active_student() then raise exception 'Active student account required' using errcode='42501'; end if;
 select * into p from public.student_profiles where id=u for update;
 if not cbse_membership.can_access_class(u,p.class_id) and p.home_class_id is not null then
 update public.student_profiles set class_id=home_class_id where id=u returning * into p; end if;
 simple:=false;
 select jsonb_build_object('simple_class12',simple,'profile',jsonb_build_object('full_name',p.full_name,'class_id',p.class_id,'home_class_id',p.home_class_id),
 'paid_current_class',cbse_membership.paid_for_class(u,p.class_id),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.class_name,'number',c.class_number,'is_home',c.id=p.home_class_id,'paid',cbse_membership.paid_for_class(u,c.id)) order by c.class_number)
 from public.classes c where cbse_membership.can_access_class(u,c.id)),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object('code',a.code,'name',a.name,'price_inr',a.price_inr,'available',a.status='ready' and a.price_inr is not null,'description',a.description,'class_numbers',a.class_numbers,'revision',a.revision) order by a.code)
 from public.admin_subscription_products a where true),'[]'::jsonb),
 'legacy_offer',case when p.home_class_id is not null then jsonb_build_object('code','LEGACY_CURRENT','name','Current class membership','price_inr',99,'description','Existing current-class offer','class_ids',array[p.home_class_id]) else null end,
 'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'code',s.membership_product_code,'name',coalesce(a.name,pl.plan_name),'class_ids',s.covered_class_ids,'class_names',(select jsonb_agg(c.class_name order by c.class_number) from public.classes c where c.id=any(s.covered_class_ids)),'start_date',s.start_date,'end_date',s.end_date,'status',case when s.status<>'ACTIVE' then s.status when s.start_date>now() then 'SCHEDULED' when s.end_date<=now() then 'EXPIRED' else 'ACTIVE' end,'legacy',s.membership_product_code is null) order by s.start_date desc)
 from public.subscriptions s left join public.admin_subscription_products a on a.code=s.membership_product_code join public.subscription_plans pl on pl.id=s.plan_id where s.student_id=u),'[]'::jsonb),
 'checkout_available',false) into result;
 return result;
end $function$
;
CREATE OR REPLACE FUNCTION cbse_membership.quote(p_product text, p_activation text, p_coupon text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); sp public.student_profiles; a public.admin_subscription_products; c public.coupons;
 ids bigint[]; price numeric; discount numeric:=0; starts timestamptz; ends timestamptz; latest timestamptz;
 title text; v_code text:=upper(btrim(coalesce(p_coupon,''))); n integer; ist date:=(now() at time zone 'Asia/Kolkata')::date; cp text;
begin
 if u is null or not public.is_active_student() then raise exception 'Active student required' using errcode='42501'; end if;
 if p_activation is null or p_activation<>'NOW' then raise exception 'Membership starts immediately'; end if;
 select * into sp from public.student_profiles where id=u;
 if p_product='LEGACY_CURRENT' then
 if sp.home_class_id is null then raise exception 'Home class is not assigned'; end if;
 ids:=array[sp.home_class_id];price:=99;title:='Current class membership';
 else
 select * into a from public.admin_subscription_products where code=p_product and status='ready' and price_inr is not null for share;
 if not found then raise exception 'This plan is not available'; end if;
 select array_agg(id order by id) into ids from public.classes where class_number=any(a.class_numbers) and is_active;
 if coalesce(cardinality(ids),0)<>cardinality(a.class_numbers) then raise exception 'Plan class configuration is unavailable'; end if;
 price:=a.price_inr;title:=a.name;
 end if;
 starts:=now();
 if exists(select 1 from public.subscriptions where student_id=u and status='ACTIVE' and covered_class_ids=ids and end_date is null) then raise exception 'You already have unlimited membership for these classes'; end if;
 select max(end_date) into latest from public.subscriptions where student_id=u and status='ACTIVE' and covered_class_ids=ids and end_date>now();
 starts:=greatest(starts,coalesce(latest,starts));
 ends:=((starts at time zone 'Asia/Kolkata')+interval '13 months') at time zone 'Asia/Kolkata';
 if v_code<>'' then
 select * into c from public.coupons where upper(coupon_code)=v_code for share;
 if not found or not c.is_active or (c.valid_from is not null and c.valid_from>now()) or c.valid_until is null or c.valid_until<=now()
 or (c.usage_limit is not null and coalesce(c.usage_count,0)>=c.usage_limit) then raise exception 'Coupon is invalid, expired or exhausted'; end if;
 if exists(select 1 from public.membership_coupon_redemptions where student_id=u and coupon_id=c.id) then raise exception 'You have already redeemed this coupon'; end if;
 cp:=upper(coalesce(c.applicable_plan_code,'PAID_99'));
 if cp='PAID_99' then
 if ids<>array[sp.home_class_id] then raise exception 'This coupon applies only to your home class'; end if;
 elsif cp='CLASS10_149' then
 if ids<>(select array_agg(id order by id) from public.classes where class_number=10 and is_active) then raise exception 'Coupon is for Class 10'; end if;
 elsif cp='COMBINED_199' then
 if ids<>(select array_agg(id order by id) from public.classes where class_number in (9,10) and is_active) then raise exception 'Coupon is for Classes 9 + 10'; end if;
 elsif cp<>p_product then raise exception 'Coupon is not valid for this plan'; end if;
 discount:=round(price*c.discount_percentage/100,2);
 if c.membership_validity='COUPON_EXPIRY' then ends:=least(ends,c.valid_until); end if;
 if ends<=starts then raise exception 'Coupon validity ends before this membership would start'; end if;
 end if;
 return jsonb_build_object('code',p_product,'name',title,'class_ids',ids,'price_inr',price,'discount_inr',discount,'payable_inr',greatest(0,price-discount),'start_date',starts,'end_date',ends,'activation',p_activation,'coupon_code',v_code,'coupon_id',c.id,'renewal',latest is not null,'checkout_available',false,'price_revision',a.revision);
end $function$
;
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
 values('Administrator granted annual membership','ADMIN_ONE_YEAR',0,'One year of class-scoped Practice and Real Mock granted by Full Admin',false)
 on conflict(plan_code) do update set plan_code=excluded.plan_code returning id into pid;
 insert into public.subscriptions(student_id,plan_id,status,start_date,end_date,payment_reference,amount_paid,covered_class_ids,membership_product_code,activation_policy,activation_request_id)
 values(p_user,pid,'ACTIVE',starts,ends,'ADMIN_GRANT:'||p_request::text,0,array[r.class_id],product,'NOW',p_request) returning id into sid;
 end if;
 v_result:=jsonb_build_object('user_id',p_user,'email',r.email,'full_name',r.full_name,'class_id',r.class_id,'membership',case when r.paid then 'PAID' else 'FREE' end,'email_verified',true,'start_date',case when r.paid then starts else null end,'end_date',ends);
 insert into public.membership_events(student_id,actor_id,event_type,details) values(p_user,p_actor,'ADMIN_STUDENT_CREATED',jsonb_build_object('class_id',r.class_id,'paid',r.paid,'subscription_id',sid,'request_id',p_request));
 update public.admin_student_creation_requests set status='COMPLETE',user_id=p_user,result=v_result,updated_at=now() where request_id=p_request;
 return v_result;
end $function$
;
CREATE OR REPLACE FUNCTION cbse_sessions.claim()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); sid uuid; signed_at timestamptz; enforced boolean;
begin
 if u is null then raise exception 'Sign in required' using errcode='42501';end if;
 if exists(select 1 from public.admin_users where user_id=u) then return jsonb_build_object('allowed',true,'exempt',true);end if;
 if exists(select 1 from public.teacher_profiles where id=u) then return jsonb_build_object('allowed',true,'exempt',true);end if;
 if not exists(select 1 from public.student_profiles where id=u and is_active) then raise exception 'Active student required' using errcode='42501';end if;
 select enabled into enforced from cbse_sessions.policy where singleton;
 if not enforced then return jsonb_build_object('allowed',true,'enforced',false);end if;
 begin sid:=nullif(auth.jwt()->>'session_id','')::uuid;exception when invalid_text_representation then sid:=null;end;
 select coalesce(created_at,now()) into signed_at from auth.sessions where id=sid and user_id=u and (not_after is null or not_after>now());
 if sid is null or not found then return jsonb_build_object('allowed',false,'code','CBSE_SESSION_REVOKED','reason','SIGNED_OUT');end if;
 -- Same browser/session shares one slot. A revoked session can never reclaim a slot.
 perform pg_advisory_xact_lock(hashtextextended('student-devices:'||u::text,0));
 if exists(select 1 from public.student_device_sessions where session_id=sid and student_id=u and revoked_at is not null) then
 return jsonb_build_object('allowed',false,'code','CBSE_SESSION_REVOKED','reason','DEVICE_LIMIT');end if;
 update public.student_device_sessions d set revoked_at=now(),revoke_reason='SIGNED_OUT'
 where d.student_id=u and d.revoked_at is null and not exists(select 1 from auth.sessions s where s.id=d.session_id and s.user_id=u and (s.not_after is null or s.not_after>now()));
 insert into public.student_device_sessions(session_id,student_id,signed_in_at) values(sid,u,signed_at) on conflict(session_id) do nothing;
 if exists(select 1 from public.student_device_sessions where session_id=sid and student_id<>u) then raise exception 'Session identity mismatch' using errcode='42501';end if;
 -- Creation time comes from Auth, never a client clock or refresh time.
 with older as(select session_id from public.student_device_sessions where student_id=u and revoked_at is null order by signed_in_at desc,session_id desc offset 2)
 update public.student_device_sessions d set revoked_at=now(),revoke_reason='DEVICE_LIMIT' from older o where d.session_id=o.session_id;
 -- Remove only evicted sessions owned by this student. Auth's foreign key cascades their refresh tokens.
 delete from auth.sessions s using public.student_device_sessions d where s.id=d.session_id and s.user_id=u and d.student_id=u and d.revoked_at is not null and d.revoke_reason='DEVICE_LIMIT';
 if not cbse_sessions.allowed() then return jsonb_build_object('allowed',false,'code','CBSE_SESSION_REVOKED','reason','DEVICE_LIMIT');end if;
 return jsonb_build_object('allowed',true,'enforced',true,'session_id',sid,'max_sessions',2);
end $function$
;
CREATE OR REPLACE FUNCTION cbse_sessions.allowed()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u uuid:=auth.uid(); sid uuid;
begin
 if not (select enabled from cbse_sessions.policy where singleton) then return true;end if;
 if u is null then return false;end if;
 if exists(select 1 from public.admin_users where user_id=u) then return true;end if;
 if exists(select 1 from public.teacher_profiles where id=u) then return true;end if;
 begin sid:=nullif(auth.jwt()->>'session_id','')::uuid;exception when invalid_text_representation then return false;end;
 if sid is null then return false;end if;
 return exists(select 1 from public.student_device_sessions d join auth.sessions s on s.id=d.session_id and s.user_id=d.student_id
 where d.session_id=sid and d.student_id=u and d.revoked_at is null and (s.not_after is null or s.not_after>now()));
end $function$
;

