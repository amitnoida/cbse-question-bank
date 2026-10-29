-- Dedicated QA account only. All writes deliberately roll back inside the exception block.
do $test$
declare u uuid; c8 bigint; c9 bigint; c10 bigint; c12 bigint; coupon1 bigint; coupon2 bigint; coupon3 bigint;
 q jsonb;r jsonb;rid uuid:=gen_random_uuid();sid bigint;before_usage integer;sub bigint;state jsonb;
begin
 select id into u from auth.users where email='test_8_free@gmail.com';
 if u is null then raise exception 'Dedicated Class 8 free QA account missing';end if;
 select id into c8 from public.classes where class_number=8 and is_active;
 select id into c9 from public.classes where class_number=9 and is_active;
 select id into c10 from public.classes where class_number=10 and is_active;
 select id into c12 from public.classes where class_number=12 and is_active;
 begin
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 update public.admin_subscription_products set status='ready',price_inr=99 where code in ('CLASS_9','CLASS_10','COMBO_11_12');
 insert into public.coupons(coupon_code,discount_percentage,is_active,valid_from,valid_until,usage_limit,applicable_plan_code,membership_validity)
 values('QA_MEMBERSHIP_'||replace(gen_random_uuid()::text,'-',''),100,true,now()-interval '1 minute',now()+interval '10 days',20,'CLASS_9','ONE_YEAR') returning id into coupon1;
 insert into public.coupons(coupon_code,discount_percentage,is_active,valid_from,valid_until,usage_limit,applicable_plan_code,membership_validity)
 values('QA_MEMBERSHIP_'||replace(gen_random_uuid()::text,'-',''),100,true,now()-interval '1 minute',now()+interval '10 days',20,'CLASS_9','ONE_YEAR') returning id into coupon2;
 insert into public.coupons(coupon_code,discount_percentage,is_active,valid_from,valid_until,usage_limit,applicable_plan_code,membership_validity)
 values('QA_MEMBERSHIP_'||replace(gen_random_uuid()::text,'-',''),100,true,now()-interval '1 minute',now()+interval '10 days',20,'CLASS_10','ONE_YEAR') returning id into coupon3;
 q:=public.cbse_membership_quote_v1('CLASS_9','NOW',(select coupon_code from public.coupons where id=coupon1));
 if (q->>'payable_inr')::numeric<>0 or (q->>'end_date')::timestamptz<now()+interval '364 days' then raise exception 'One-year coupon quote failed';end if;
 r:=public.cbse_activate_membership_v1('CLASS_9','NOW',(select coupon_code from public.coupons where id=coupon1),rid,q);
 sid:=(r->>'subscription_id')::bigint;
 if not cbse_membership.paid_for_class(u,c9) or cbse_membership.paid_for_class(u,c12) then raise exception 'Class scope failed';end if;
 r:=public.cbse_activate_membership_v1('CLASS_9','NOW',(select coupon_code from public.coupons where id=coupon1),rid,q);
 if not (r->>'already_processed')::boolean or (select usage_count from public.coupons where id=coupon1)<>1 then raise exception 'Retry consumed coupon twice';end if;
 begin
 perform public.cbse_membership_quote_v1('CLASS_9','NOW',(select coupon_code from public.coupons where id=coupon1));
 raise exception 'Repeated coupon accepted';
 exception when raise_exception then if sqlerrm='Repeated coupon accepted' then raise;end if;end;
 state:=public.cbse_switch_class_v1(c9);
 if (state->'profile'->>'class_id')::bigint<>c9 or not public.cbse_is_paid_for_subject_v1(u) then raise exception 'Class switch failed';end if;
 select id into sub from public.subjects where class_id=c9 and subject_name='Mathematics' and is_active limit 1;
 perform public.cbse_start_practice_v2(sub,'{}',2);
 begin perform public.cbse_switch_class_v1(c12);raise exception 'Unpurchased class accepted';
 exception when insufficient_privilege then null;end;
 q:=public.cbse_membership_quote_v1('CLASS_9','NOW',(select coupon_code from public.coupons where id=coupon2));
 if (q->>'start_date')::timestamptz<>(select end_date from public.subscriptions where id=sid) then raise exception 'Renewal overlaps instead of queues';end if;
 q:=public.cbse_membership_quote_v1('CLASS_10','APRIL',(select coupon_code from public.coupons where id=coupon3));
 if extract(month from (q->>'start_date')::timestamptz at time zone 'Asia/Kolkata')<>4 or extract(day from (q->>'start_date')::timestamptz at time zone 'Asia/Kolkata')<>1 then raise exception 'April boundary incorrect';end if;
 perform public.cbse_activate_membership_v1('CLASS_10','APRIL',(select coupon_code from public.coupons where id=coupon3),gen_random_uuid(),q);
 if cbse_membership.can_access_class(u,c10) then raise exception 'Scheduled membership grants early access';end if;
 begin perform public.cbse_switch_class_v1(c10);raise exception 'Future class accepted';exception when insufficient_privilege then null;end;
 -- Positive-price activation must never grant access while gateway is unavailable.
 q:=public.cbse_membership_quote_v1('COMBO_11_12','NOW','');
 begin perform public.cbse_activate_membership_v1('COMBO_11_12','NOW','',gen_random_uuid(),q);raise exception 'Unpaid membership accepted';
 exception when raise_exception then if sqlerrm='Unpaid membership accepted' then raise;end if;end;
 if cbse_membership.paid_for_class(u,c12) then raise exception 'Unpaid access leaked';end if;
 -- Legacy-expiry coupons must not become one-year coupons implicitly.
 update public.coupons set applicable_plan_code='COMBO_11_12',membership_validity='COUPON_EXPIRY' where id=coupon2;
 q:=public.cbse_membership_quote_v1('COMBO_11_12','NOW',(select coupon_code from public.coupons where id=coupon2));
 if (q->>'end_date')::timestamptz<>(select valid_until from public.coupons where id=coupon2) then raise exception 'Legacy coupon expiry changed';end if;
 perform public.cbse_activate_membership_v1('COMBO_11_12','NOW',(select coupon_code from public.coupons where id=coupon2),gen_random_uuid(),q);
 if not cbse_membership.paid_for_class(u,c12) or not cbse_membership.paid_for_class(u,(select id from public.classes where class_number=11)) then raise exception 'Combo scope incomplete';end if;
 -- Expired current-class access reverts to the home class.
 update public.subscriptions set start_date=now()-interval '2 days',end_date=now()-interval '1 day' where id=sid;
 state:=public.cbse_student_memberships_v1();
 if (state->'profile'->>'class_id')::bigint<>c8 or cbse_membership.paid_for_class(u,c9) then raise exception 'Expired class did not revert';end if;
 -- Explicit progression updates the free home class without resetting allowances.
 update public.subscriptions set start_date=now()-interval '1 minute',end_date=now()+interval '1 year' where id=sid;
 state:=public.cbse_progress_class_v1(c9);
 if (state->'profile'->>'home_class_id')::bigint<>c9 then raise exception 'School progression failed';end if;
 update public.subscriptions set start_date=now()-interval '2 days',end_date=now()-interval '1 day' where id=sid;
 state:=public.cbse_student_memberships_v1();
 if (state->'profile'->>'class_id')::bigint<>c9 or (state->>'paid_current_class')::boolean then raise exception 'New school class did not retain free access';end if;
 if has_function_privilege('anon','public.cbse_activate_membership_v1(text,text,text,uuid,jsonb)','execute') then raise exception 'Anonymous activation privilege';end if;
 raise exception 'QA_MEMBERSHIPS_ROLLBACK_SUCCESS';
 exception when raise_exception then if sqlerrm<>'QA_MEMBERSHIPS_ROLLBACK_SUCCESS' then raise;end if;
 end;
end $test$;
select 'PASS: scope, combo, scheduling, renewal, coupon retry/expiry and unpaid rejection; QA writes rolled back' as result;
