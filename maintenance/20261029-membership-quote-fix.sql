create or replace function cbse_membership.quote(p_product text,p_activation text,p_coupon text) returns jsonb
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
