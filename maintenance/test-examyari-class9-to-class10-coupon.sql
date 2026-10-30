-- Transaction-only, disposable full-coupon Class 9 -> Class 10 regression.
-- No student/coupon/subscription changes persist after ROLLBACK.
BEGIN;
DO $test$
DECLARE
  u uuid:=gen_random_uuid();
  sess uuid:=gen_random_uuid();
  class9 bigint;
  class10 bigint;
  coupon_code text:='QA_EXAMYARI_'||replace(gen_random_uuid()::text,'-','');
  coupon_id bigint;
  q jsonb;
  activated jsonb;
  subscription_id bigint;
  state jsonb;
BEGIN
  SELECT id INTO STRICT class9 FROM public.classes WHERE class_number=9 AND is_active;
  SELECT id INTO STRICT class10 FROM public.classes WHERE class_number=10 AND is_active;
  INSERT INTO auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  VALUES(u,'qa_examyari_rollback_'||replace(u::text,'-','')||'@example.com',now(),
    jsonb_build_object('full_name','Rollback-only Class 9 student','class_id',class9));
  IF NOT EXISTS(SELECT 1 FROM public.student_profiles WHERE id=u AND home_class_id=class9 AND is_active)
    THEN RAISE EXCEPTION 'Disposable Class 9 student not created'; END IF;
  INSERT INTO auth.sessions(id,user_id,created_at,updated_at) VALUES(sess,u,now(),now());
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',u,'role','authenticated','session_id',sess)::text,true);
  IF NOT coalesce((public.cbse_claim_student_session_v1()->>'allowed')::boolean,false)
    THEN RAISE EXCEPTION 'Disposable student session denied'; END IF;
  IF cbse_membership.can_access_class(u,class10)
    THEN RAISE EXCEPTION 'Class 10 accessed before purchase'; END IF;
  INSERT INTO public.coupons(coupon_code,discount_percentage,is_active,valid_from,valid_until,
    usage_limit,applicable_plan_code,membership_validity)
  VALUES(coupon_code,100,true,now()-interval '1 minute',now()+interval '10 days',
    1,'CLASS_10','ONE_YEAR') RETURNING id INTO coupon_id;
  q:=public.cbse_membership_quote_v1('CLASS_10','NOW',coupon_code);
  IF (q->>'payable_inr')::numeric<>0 OR jsonb_array_length(q->'class_ids')<>1
    THEN RAISE EXCEPTION 'Wrong coupon quote'; END IF;
  IF (q->>'end_date')::timestamptz IS DISTINCT FROM
      (((q->>'start_date')::timestamptz AT TIME ZONE 'Asia/Kolkata')
       +interval '13 months') AT TIME ZONE 'Asia/Kolkata'
    THEN RAISE EXCEPTION '13-month duration wrong'; END IF;
  activated:=public.cbse_activate_membership_v1('CLASS_10','NOW',coupon_code,gen_random_uuid(),q);
  subscription_id:=(activated->>'subscription_id')::bigint;
  IF NOT cbse_membership.can_access_class(u,class9)
    OR NOT cbse_membership.can_access_class(u,class10)
    THEN RAISE EXCEPTION 'Both Class 9 and 10 access missing'; END IF;
  state:=public.cbse_student_memberships_v1();
  IF jsonb_array_length(state->'classes')<>2
    THEN RAISE EXCEPTION 'Class selector missing purchased class'; END IF;
  IF (SELECT coalesce(usage_count,0) FROM public.coupons WHERE id=coupon_id)<>1
    THEN RAISE EXCEPTION 'Coupon usage not recorded'; END IF;
  BEGIN
    PERFORM public.cbse_membership_quote_v1('CLASS_10','NOW',coupon_code);
    RAISE EXCEPTION 'Repeated redemption accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Repeated redemption accepted' THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.subscriptions
    WHERE id=subscription_id AND student_id=u AND redeemed_coupon_id=coupon_id)
    THEN RAISE EXCEPTION 'Subscription coupon association missing'; END IF;
END $test$;
ROLLBACK;
SELECT 'PASS: full Class 10 coupon gives 13 months and Class 9+10 access; repeated redemption blocked; all disposable writes rolled back' AS result;
