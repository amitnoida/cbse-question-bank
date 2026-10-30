-- Synthetic private consent audit test. ALL inserts/updates roll back.
BEGIN;
DO $qa$
DECLARE aid uuid; sid uuid; consent uuid; first_request uuid:=gen_random_uuid();other_request uuid:=gen_random_uuid();
BEGIN
 SELECT id INTO aid FROM auth.users WHERE email='test_admin_fullaccess@gmail.com';
 SELECT id INTO sid FROM auth.users WHERE email='test_8_free@gmail.com';
 IF aid IS NULL OR sid IS NULL THEN RAISE EXCEPTION 'QA users missing'; END IF;
 INSERT INTO public.guardian_account_consents(
 guardian_name,guardian_email,verification_method,verification_reference,
 relationship_basis,consent_evidence_reference,guardian_consented_at,verified_by)
 VALUES('Synthetic Guardian','guardian-synthetic@example.com','RELIABLE_EXISTING_RECORD',
 'case-internal-001','Synthetic QA relationship check','Synthetic consent receipt QATEST',now(),aid)
 RETURNING id INTO consent;
 IF NOT public.cbse_guardian_claim_v1(aid,consent,first_request) THEN RAISE EXCEPTION 'First claim failed';END IF;
 IF NOT public.cbse_guardian_claim_v1(aid,consent,first_request) THEN RAISE EXCEPTION 'Idempotent claim failed';END IF;
 BEGIN
  PERFORM public.cbse_guardian_claim_v1(aid,consent,other_request);
  RAISE EXCEPTION 'Consent allowed different account request';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Consent allowed different account request' THEN RAISE;END IF;
 END;
 IF NOT public.cbse_guardian_finish_v1(aid,consent,first_request,sid) THEN RAISE EXCEPTION 'Link failed';END IF;
 IF (SELECT student_id FROM public.guardian_account_consents WHERE id=consent)<>sid THEN RAISE EXCEPTION 'Wrong account linked';END IF;
 IF has_table_privilege('authenticated','public.guardian_account_consents','SELECT')
 OR has_table_privilege('anon','public.guardian_account_consents','SELECT')
 OR has_function_privilege('authenticated','public.cbse_guardian_claim_v1(uuid,uuid,uuid)','EXECUTE')
 OR has_function_privilege('anon','public.cbse_guardian_claim_v1(uuid,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Confidentiality or privilege violated';END IF;
 RAISE NOTICE 'PASS: private record, idempotency, anti-replay, account linkage';
END $qa$;
ROLLBACK;
SELECT 'PASS: all guardian-consent QA records rolled back' AS result;
