-- Rollback-only production coupon QA. Never execute statements separately.
-- The device-session policy is disabled only in this transaction's private snapshot
-- and is restored by ROLLBACK; no coupon, subscription, or entitlement is retained.
BEGIN;
DO $qa$
DECLARE
  u uuid; cid bigint; code text; quote jsonb; result jsonb;
  request_id uuid:=gen_random_uuid();
BEGIN
  SELECT id INTO u FROM auth.users WHERE email='test_8_free@gmail.com';
  IF u IS NULL THEN RAISE EXCEPTION 'Dedicated QA student missing'; END IF;

  UPDATE cbse_sessions.policy SET enabled=false WHERE singleton;
  PERFORM set_config('request.jwt.claim.sub',u::text,true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub',u,'role','authenticated')::text,true);
  IF NOT public.is_active_student() THEN RAISE EXCEPTION 'QA student unavailable'; END IF;

  INSERT INTO public.coupons
    (coupon_code,discount_percentage,is_active,valid_from,valid_until,
     usage_limit,applicable_plan_code)
  VALUES ('QA_ROLLBACK_'||replace(gen_random_uuid()::text,'-',''),
          100,true,now()-interval '1 minute',now()+interval '5 days',1,'CLASS_9')
  RETURNING id,coupon_code INTO cid,code;

  IF (SELECT membership_validity FROM public.coupons WHERE id=cid)<>'ONE_YEAR'
    THEN RAISE EXCEPTION 'New coupon default incorrect'; END IF;

  quote:=public.cbse_membership_quote_v1('CLASS_9','NOW',code);
  IF (quote->>'payable_inr')::numeric<>0 OR
     (quote->>'end_date')::timestamptz<now()+interval '390 days'
    THEN RAISE EXCEPTION '100 percent quote or duration incorrect'; END IF;

  result:=public.cbse_activate_membership_v1('CLASS_9','NOW',code,request_id,quote);
  IF (SELECT usage_count FROM public.coupons WHERE id=cid)<>1
    THEN RAISE EXCEPTION 'Coupon should be consumed once'; END IF;

  result:=public.cbse_activate_membership_v1('CLASS_9','NOW',code,request_id,quote);
  IF NOT coalesce((result->>'already_processed')::boolean,false) OR
     (SELECT usage_count FROM public.coupons WHERE id=cid)<>1
    THEN RAISE EXCEPTION 'Idempotent retry incorrectly consumed coupon'; END IF;

  BEGIN
    PERFORM public.cbse_membership_quote_v1('CLASS_9','NOW',code);
    RAISE EXCEPTION 'Exhausted coupon incorrectly accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Exhausted coupon incorrectly accepted' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: 100 percent discount, 13 months, one redemption, retry, anti-replay';
END $qa$;
ROLLBACK;
SELECT 'PASS: all coupon, membership, account and session-policy QA changes rolled back' AS result;
