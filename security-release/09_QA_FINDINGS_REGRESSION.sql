BEGIN;
SET LOCAL ROLE authenticated;

DO $test$
DECLARE p public.mock_papers; s uuid; pr jsonb; q bigint; saved jsonb;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','00de957f-0eb5-450b-b53e-bb3011e1ea5f',true);
 p:=public.start_mock_paper(1,4);
 SELECT session_id INTO s FROM public.mock_open_exam('full',p.id);
 saved:=public.mock_save_answer(s,p.question_ids[1],'A');
 ASSERT (saved->>'saved')::boolean,'active mock answer not saved';
 pr:=public.cbse_start_practice_v1(5,NULL,1);
 q:=(pr->'question_ids'->>0)::bigint;
 saved:=public.submit_practice_answer_locked((pr->>'id')::uuid,q,'A');
 ASSERT saved ? q::text,'active practice answer not saved';
 PERFORM set_config('qa.mock',s::text,true);
 PERFORM set_config('qa.paper',p.id::text,true);
 PERFORM set_config('qa.question',p.question_ids[1]::text,true);
 PERFORM set_config('qa.practice',pr->>'id',true);
 PERFORM set_config('qa.pquestion',q::text,true);
END $test$;
RESET ROLE;
UPDATE public.student_profiles SET is_active=false WHERE id='00de957f-0eb5-450b-b53e-bb3011e1ea5f';
SET LOCAL ROLE authenticated;
DO $test$
DECLARE rejected boolean; command text; n integer:=0;
BEGIN
 FOREACH command IN ARRAY ARRAY[
  $$SELECT public.activate_paid_membership_with_coupon('FREETRIAL')$$,
  $$SELECT public.start_mock_paper(1,4)$$,
  $$SELECT public.mock_open_exam('full',current_setting('qa.paper')::uuid)$$,
  $$SELECT public.mock_save_answer(current_setting('qa.mock')::uuid,current_setting('qa.question')::bigint,'B')$$,
  $$SELECT public.mock_finish_exam(current_setting('qa.mock')::uuid)$$,
  $$SELECT public.submit_practice_answer_locked(current_setting('qa.practice')::uuid,current_setting('qa.pquestion')::bigint,'B')$$,
  $$SELECT public.cbse_history_questions_v1(ARRAY[31]::bigint[])$$
 ] LOOP
  rejected:=false;
  BEGIN EXECUTE command; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  ASSERT rejected,'inactive student accepted: '||command;
  n:=n+1;
 END LOOP;
 ASSERT n=7;
END $test$;
RESET ROLE;
UPDATE public.student_profiles SET is_active=true WHERE id='00de957f-0eb5-450b-b53e-bb3011e1ea5f';
SET LOCAL ROLE authenticated;
DO $test$
DECLARE a bigint; b bigint; saved jsonb;
BEGIN
 saved:=public.mock_save_answer(current_setting('qa.mock')::uuid,current_setting('qa.question')::bigint,'D');
 ASSERT (saved->>'saved')::boolean,'reactivated mock answer failed';
 a:=public.mock_finish_exam(current_setting('qa.mock')::uuid);
 b:=public.mock_finish_exam(current_setting('qa.mock')::uuid);
 ASSERT a=b,'mock finish not idempotent';
 PERFORM public.cbse_finish_practice_secure_v1(current_setting('qa.practice')::uuid);
END $test$;
RESET ROLE;
DO $test$
DECLARE r text; t record; actual integer; expected integer;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
  FOR t IN SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' LOOP
   ASSERT NOT has_table_privilege(r,t.oid,'TRUNCATE'),'truncate remains';
   ASSERT NOT has_table_privilege(r,t.oid,'TRIGGER'),'trigger remains';
   ASSERT NOT has_table_privilege(r,t.oid,'REFERENCES'),'references remains';
   ASSERT NOT has_table_privilege(r,t.oid,'MAINTAIN'),'maintain remains';
  END LOOP;
 END LOOP;
 SELECT (public.system_stats_db_readonly()->>'registered_students')::integer INTO actual;
 SELECT count(*) INTO expected FROM public.student_profiles sp WHERE NOT EXISTS(SELECT 1 FROM public.admin_users au WHERE au.user_id=sp.id);
 ASSERT actual=expected,'student count mismatch';
 ASSERT has_table_privilege('authenticated','public.quiz_attempts','SELECT'),'student history SELECT removed';
 ASSERT has_table_privilege('service_role','public.subscriptions','INSERT'),'service write removed';
END $test$;
SELECT 'PASS: 7 inactive RPCs denied, active save/finish/reactivation works, grading idempotent, privileges restricted, counts aligned' evidence;

ROLLBACK;

