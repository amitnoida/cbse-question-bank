-- Release C: class-scoped memberships, legacy preservation and coupon lifecycle.
-- Payment-provider setup is a separate prerequisite; no paid activation is exposed here.
create schema if not exists cbse_membership;
revoke all on schema cbse_membership from public,anon;
grant usage on schema cbse_membership to authenticated,service_role;
alter table public.student_profiles add column home_class_id bigint references public.classes(id);
update public.student_profiles set home_class_id=class_id;
create index student_profiles_home_class_idx on public.student_profiles(home_class_id);
alter table public.subscriptions add column covered_class_ids bigint[] not null default '{}';
alter table public.subscriptions add column membership_product_code text;
alter table public.subscriptions add column activation_policy text check(activation_policy in ('NOW','APRIL'));
alter table public.subscriptions add column activation_request_id uuid unique;
alter table public.subscriptions add column redeemed_coupon_id bigint references public.coupons(id);
update public.subscriptions s set covered_class_ids=array[p.class_id]
from public.student_profiles p where p.id=s.student_id and p.class_id is not null;
create index subscriptions_redeemed_coupon_idx on public.subscriptions(redeemed_coupon_id);
create index subscriptions_student_scope_idx on public.subscriptions(student_id,membership_product_code);
create unique index subscription_free_product_once on public.subscriptions(student_id,membership_product_code)
where membership_product_code is not null and amount_paid=0 and redeemed_coupon_id is null;
alter table public.coupons add column membership_validity text not null default 'COUPON_EXPIRY' check(membership_validity in ('COUPON_EXPIRY','ONE_YEAR'));
create unique index coupons_code_normalized on public.coupons(upper(coupon_code));
alter table public.coupons drop constraint admin_free_coupon_rules;
alter table public.coupons add constraint admin_free_coupon_rules check (
 coupon_type is distinct from 'ADMIN_FREE' or (discount_percentage=100 and
 applicable_plan_code in ('PAID_99','CLASS10_149','COMBINED_199','CLASS_8','CLASS_9','CLASS_10','CLASS_11','CLASS_12','COMBO_9_10','COMBO_11_12')
 and usage_limit=1 and usage_count between 0 and 1 and valid_until is not null));
create table public.membership_coupon_redemptions (
 student_id uuid not null references public.student_profiles(id) on delete cascade,
 coupon_id bigint not null references public.coupons(id),
 subscription_id bigint not null references public.subscriptions(id),
 redeemed_at timestamptz not null default now(),primary key(student_id,coupon_id)
);
create index membership_redemptions_coupon_idx on public.membership_coupon_redemptions(coupon_id);
create index membership_redemptions_subscription_idx on public.membership_coupon_redemptions(subscription_id);
insert into public.membership_coupon_redemptions(student_id,coupon_id,subscription_id,redeemed_at)
select distinct on(s.student_id,c.id) s.student_id,c.id,s.id,s.created_at
from public.subscriptions s join public.coupons c on upper(s.payment_reference)='COUPON:'||upper(c.coupon_code)
order by s.student_id,c.id,s.created_at,s.id;
create table public.membership_events (
 id bigint generated always as identity primary key,student_id uuid references public.student_profiles(id) on delete cascade,
 actor_id uuid not null,event_type text not null,details jsonb not null,created_at timestamptz not null default now()
);
create index membership_events_student_idx on public.membership_events(student_id,created_at desc);
alter table public.membership_coupon_redemptions enable row level security;
alter table public.membership_events enable row level security;
revoke all on public.membership_coupon_redemptions,public.membership_events from public,anon,authenticated;
grant select on public.membership_coupon_redemptions,public.membership_events to authenticated;
create policy membership_redemptions_owned on public.membership_coupon_redemptions for select to authenticated using(student_id=(select auth.uid()));
create policy membership_events_owned on public.membership_events for select to authenticated using(student_id=(select auth.uid()));
grant select,insert on public.membership_events to service_role;
grant usage,select on sequence public.membership_events_id_seq to service_role;

create function cbse_membership.paid_for_class(u uuid,c bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.subscriptions s where s.student_id=u and s.status='ACTIVE'
 and s.start_date<=now() and (s.end_date is null or s.end_date>now()) and c=any(s.covered_class_ids));
$$;
create function cbse_membership.can_access_class(u uuid,c bigint) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.classes cl join public.student_profiles sp on sp.id=u
 where cl.id=c and cl.is_active and sp.is_active and (sp.home_class_id=c or cbse_membership.paid_for_class(u,c)));
$$;
revoke all on function cbse_membership.paid_for_class(uuid,bigint),cbse_membership.can_access_class(uuid,bigint) from public,anon,authenticated;
create or replace function public.cbse_is_paid_for_subject_v1(p_student uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select cbse_membership.paid_for_class(p_student,sp.class_id) from public.student_profiles sp where sp.id=p_student),false);
$$;
-- Prevent direct client inserts from inventing a home class or updates bypassing switching checks.
create function public.cbse_profile_home_guard_v1() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then new.home_class_id:=new.class_id;
 elsif current_user not in ('postgres','service_role') and
 (new.home_class_id is distinct from old.home_class_id or new.class_id is distinct from old.class_id) then
 raise exception 'Use the authorised class switch' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.cbse_profile_home_guard_v1() from public,anon,authenticated;
create trigger cbse_profile_home_guard before insert or update on public.student_profiles for each row execute function public.cbse_profile_home_guard_v1();

create function cbse_membership.student_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); p public.student_profiles; result jsonb;
begin
 if u is null or not public.is_active_student() then raise exception 'Active student account required' using errcode='42501'; end if;
 select * into p from public.student_profiles where id=u for update;
 if not cbse_membership.can_access_class(u,p.class_id) and p.home_class_id is not null then
 update public.student_profiles set class_id=home_class_id where id=u returning * into p; end if;
 select jsonb_build_object('profile',jsonb_build_object('full_name',p.full_name,'class_id',p.class_id,'home_class_id',p.home_class_id),
 'paid_current_class',cbse_membership.paid_for_class(u,p.class_id),
 'classes',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.class_name,'number',c.class_number,'is_home',c.id=p.home_class_id,'paid',cbse_membership.paid_for_class(u,c.id)) order by c.class_number)
 from public.classes c where cbse_membership.can_access_class(u,c.id)),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object('code',a.code,'name',a.name,'price_inr',a.price_inr,'description',a.description,'class_numbers',a.class_numbers,'revision',a.revision) order by a.code)
 from public.admin_subscription_products a where a.status='ready' and a.price_inr is not null),'[]'::jsonb),
 'legacy_offer',case when p.home_class_id is not null then jsonb_build_object('code','LEGACY_CURRENT','name','Current class membership','price_inr',99,'description','Existing current-class offer','class_ids',array[p.home_class_id]) else null end,
 'memberships',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'code',s.membership_product_code,'name',coalesce(a.name,pl.plan_name),'class_ids',s.covered_class_ids,'class_names',(select jsonb_agg(c.class_name order by c.class_number) from public.classes c where c.id=any(s.covered_class_ids)),'start_date',s.start_date,'end_date',s.end_date,'status',case when s.status<>'ACTIVE' then s.status when s.start_date>now() then 'SCHEDULED' when s.end_date<=now() then 'EXPIRED' else 'ACTIVE' end,'legacy',s.membership_product_code is null) order by s.start_date desc)
 from public.subscriptions s left join public.admin_subscription_products a on a.code=s.membership_product_code join public.subscription_plans pl on pl.id=s.plan_id where s.student_id=u),'[]'::jsonb),
 'checkout_available',false) into result;
 return result;
end $$;
create function public.cbse_student_memberships_v1() returns jsonb language sql security invoker set search_path='' as $$ select cbse_membership.student_state(); $$;

create function cbse_membership.switch_class(p_class bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not public.is_active_student() then raise exception 'Active student required' using errcode='42501'; end if;
 perform 1 from public.student_profiles where id=u for update;
 if not cbse_membership.can_access_class(u,p_class) then raise exception 'This class is not included in an active membership' using errcode='42501'; end if;
 -- Do not move an account while it is answering a live exam.
 if exists(select 1 from public.mock_exam_sessions where student_id=u and status='STARTED' and deadline_at>now()) then raise exception 'Finish your running mock before switching class'; end if;
 update public.student_profiles set class_id=p_class where id=u;
 insert into public.student_enrollments(student_id,class_id) values(u,p_class) on conflict(student_id,class_id) do nothing;
 insert into public.membership_events(student_id,actor_id,event_type,details) values(u,u,'CLASS_SWITCH',jsonb_build_object('class_id',p_class));
 return cbse_membership.student_state();
end $$;
create function public.cbse_switch_class_v1(p_class_id bigint) returns jsonb language sql security invoker set search_path='' as $$ select cbse_membership.switch_class(p_class_id); $$;

create function cbse_membership.quote(p_product text,p_activation text,p_coupon text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); sp public.student_profiles; a public.admin_subscription_products; c public.coupons;
 ids bigint[]; price numeric; discount numeric:=0; starts timestamptz; ends timestamptz; latest timestamptz;
 title text; v_code text:=upper(btrim(coalesce(p_coupon,''))); n integer; ist date:=(now() at time zone 'Asia/Kolkata')::date; cp text;
begin
 if u is null or not public.is_active_student() then raise exception 'Active student required' using errcode='42501'; end if;
 if p_activation is null or p_activation not in ('NOW','APRIL') then raise exception 'Choose an activation date'; end if;
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
 if p_activation='APRIL' then
 starts:=make_timestamptz(extract(year from ist)::integer,4,1,0,0,0,'Asia/Kolkata');
 if starts<=now() then starts:=make_timestamptz(extract(year from ist)::integer+1,4,1,0,0,0,'Asia/Kolkata'); end if;
 end if;
 if exists(select 1 from public.subscriptions where student_id=u and status='ACTIVE' and covered_class_ids=ids and end_date is null) then raise exception 'You already have unlimited membership for these classes'; end if;
 select max(end_date) into latest from public.subscriptions where student_id=u and status='ACTIVE' and covered_class_ids=ids and end_date>now();
 starts:=greatest(starts,coalesce(latest,starts));
 ends:=((starts at time zone 'Asia/Kolkata')+interval '1 year') at time zone 'Asia/Kolkata';
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
end $$;
create function public.cbse_membership_quote_v1(p_product text,p_activation text,p_coupon text default '') returns jsonb
language sql security invoker set search_path='' as $$select cbse_membership.quote(p_product,p_activation,p_coupon);$$;

create function cbse_membership.redeem(p_product text,p_activation text,p_coupon text,p_request uuid,p_expected jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); q jsonb; previous public.subscriptions; sid bigint; pid bigint; cid bigint; ids bigint[]; v_coupon_code text;
begin
 if u is null or not public.is_active_student() then raise exception 'Active student required' using errcode='42501'; end if;
 if p_request is null then raise exception 'Activation request identity required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('membership:'||u::text,0));
 select * into previous from public.subscriptions where activation_request_id=p_request;
 if found then
 if previous.student_id<>u or previous.membership_product_code<>p_product then raise exception 'Activation identity conflicts' using errcode='42501'; end if;
 return jsonb_build_object('subscription_id',previous.id,'already_processed',true);
 end if;
 v_coupon_code:=upper(btrim(coalesce(p_coupon,'')));
 if v_coupon_code<>'' then perform 1 from public.coupons where upper(public.coupons.coupon_code)=v_coupon_code for update; end if;
 q:=cbse_membership.quote(p_product,p_activation,p_coupon);
 -- Confirmation must match the server quote, so price/scope/date changes cannot be silently accepted.
 if p_expected is null or (q->>'price_inr')::numeric is distinct from (p_expected->>'price_inr')::numeric
 or (q->>'discount_inr')::numeric is distinct from (p_expected->>'discount_inr')::numeric
 or q->'class_ids' is distinct from p_expected->'class_ids'
 or q->'price_revision' is distinct from p_expected->'price_revision'
 or (q->>'end_date')::timestamptz < (p_expected->>'end_date')::timestamptz-interval '2 minutes'
 then raise exception 'Membership details changed. Review a fresh quote.' using errcode='40001'; end if;
 if (q->>'payable_inr')::numeric<>0 then raise exception 'Paid checkout is unavailable until Razorpay merchant setup is complete'; end if;
 ids:=array(select jsonb_array_elements_text(q->'class_ids')::bigint);
 cid:=(q->>'coupon_id')::bigint;
 if cid is null and exists(select 1 from public.subscriptions where student_id=u and membership_product_code=p_product and amount_paid=0 and redeemed_coupon_id is null) then raise exception 'This free plan has already been activated'; end if;
 if p_product='LEGACY_CURRENT' then select id into pid from public.subscription_plans where plan_code='PAID_99' and is_active;
 else
 select id into pid from public.subscription_plans where plan_code='MEMBER_'||p_product;
 if pid is null then
 insert into public.subscription_plans(plan_name,plan_code,price,description,is_active)
 values('Class membership product '||p_product,'MEMBER_'||p_product,(q->>'price_inr')::numeric,'Class-scoped membership; pricing managed in admin catalogue',false)
 on conflict(plan_code) do update set plan_code=excluded.plan_code returning id into pid;
 end if;
 end if;
 if pid is null then raise exception 'Membership plan is unavailable'; end if;
 insert into public.subscriptions(student_id,plan_id,status,start_date,end_date,payment_reference,amount_paid,covered_class_ids,membership_product_code,activation_policy,activation_request_id,redeemed_coupon_id)
 values(u,pid,'ACTIVE',(q->>'start_date')::timestamptz,(q->>'end_date')::timestamptz,
 case when cid is null then 'FREE_PRODUCT:'||p_product else 'COUPON:'||v_coupon_code end,0,ids,p_product,p_activation,p_request,cid) returning id into sid;
 if cid is not null then
 insert into public.membership_coupon_redemptions(student_id,coupon_id,subscription_id) values(u,cid,sid);
 update public.coupons set usage_count=coalesce(usage_count,0)+1 where id=cid;
 end if;
 insert into public.membership_events(student_id,actor_id,event_type,details) values(u,u,'MEMBERSHIP_ACTIVATED',jsonb_build_object('subscription_id',sid,'product',p_product,'start_date',q->'start_date','end_date',q->'end_date','coupon_id',cid));
 return jsonb_build_object('subscription_id',sid,'already_processed',false);
end $$;
create function public.cbse_activate_membership_v1(p_product text,p_activation text,p_coupon text,p_request uuid,p_expected jsonb) returns jsonb
language sql security invoker set search_path='' as $$select cbse_membership.redeem(p_product,p_activation,p_coupon,p_request,p_expected);$$;
-- Preserve the historical activation endpoint with the same result type and scoped validity.
create or replace function public.activate_paid_membership_with_coupon(p_coupon_code text)
returns table(success boolean,message text,subscription_id bigint,end_date timestamptz)
language plpgsql security invoker set search_path='' as $$
declare q jsonb; r jsonb;
begin
 q:=cbse_membership.quote('LEGACY_CURRENT','NOW',p_coupon_code);
 r:=cbse_membership.redeem('LEGACY_CURRENT','NOW',p_coupon_code,gen_random_uuid(),q);
 return query select true,'Coupon membership activated successfully.'::text,(r->>'subscription_id')::bigint,(q->>'end_date')::timestamptz;
end $$;
-- Snapshot future legacy writes too; admin/manual changes must never make a global entitlement.
create function public.cbse_subscription_scope_guard_v1() returns trigger language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' and cardinality(new.covered_class_ids)=0 then
 select array[home_class_id] into new.covered_class_ids from public.student_profiles where id=new.student_id and home_class_id is not null;
 if new.covered_class_ids is null then raise exception 'Assign the student a class before granting membership'; end if;
 end if;
 return new;
end $$;
revoke all on function public.cbse_subscription_scope_guard_v1() from public,anon,authenticated;
create trigger cbse_subscription_scope_guard before insert on public.subscriptions for each row execute function public.cbse_subscription_scope_guard_v1();

revoke all on all functions in schema cbse_membership from public,anon,authenticated;
grant execute on function cbse_membership.student_state(),cbse_membership.switch_class(bigint),cbse_membership.quote(text,text,text),cbse_membership.redeem(text,text,text,uuid,jsonb) to authenticated;
revoke all on function public.cbse_student_memberships_v1(),public.cbse_switch_class_v1(bigint),public.cbse_membership_quote_v1(text,text,text),public.cbse_activate_membership_v1(text,text,text,uuid,jsonb) from public,anon;
grant execute on function public.cbse_student_memberships_v1(),public.cbse_switch_class_v1(bigint),public.cbse_membership_quote_v1(text,text,text),public.cbse_activate_membership_v1(text,text,text,uuid,jsonb) to authenticated;

create function public.admin_set_membership_coupon_scope_v1(p_actor uuid,p_coupon_id bigint,p_product text,p_validity text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare old_c public.coupons; new_c public.coupons;
begin
 if not exists(select 1 from public.admin_profiles p join public.admin_users a on a.user_id=p.id where p.id=p_actor and p.role='FULL_ADMIN' and p.is_active and not p.must_change_password) then raise exception 'Full Admin required' using errcode='42501'; end if;
 if p_product is null or p_product not in ('PAID_99','CLASS10_149','COMBINED_199','CLASS_8','CLASS_9','CLASS_10','CLASS_11','CLASS_12','COMBO_9_10','COMBO_11_12') or p_validity is null or p_validity not in ('COUPON_EXPIRY','ONE_YEAR') then raise exception 'Invalid coupon membership configuration' using errcode='22023'; end if;
 select * into old_c from public.coupons where id=p_coupon_id for update;
 if not found then raise exception 'Coupon not found'; end if;
 update public.coupons set applicable_plan_code=p_product,membership_validity=p_validity where id=p_coupon_id returning * into new_c;
 insert into public.membership_events(actor_id,event_type,details) values(p_actor,'COUPON_SCOPE_CHANGED',jsonb_build_object('coupon_id',p_coupon_id,'before',jsonb_build_object('plan',old_c.applicable_plan_code,'validity',old_c.membership_validity),'after',jsonb_build_object('plan',new_c.applicable_plan_code,'validity',new_c.membership_validity)));
 return jsonb_build_object('id',new_c.id,'applicable_plan_code',new_c.applicable_plan_code,'membership_validity',new_c.membership_validity);
end $$;
revoke all on function public.admin_set_membership_coupon_scope_v1(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_membership_coupon_scope_v1(uuid,bigint,text,text) to service_role;
