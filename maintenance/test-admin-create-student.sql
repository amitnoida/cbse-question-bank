-- Auth/profile fixtures and all grants are created inside a rolled-back subtransaction.
do $test$
declare a uuid; viewer uuid; req uuid; uid uuid; uid2 uuid; req2 uuid; c12 bigint; c11 bigint; c9 bigint; r jsonb; q jsonb; state jsonb; ends timestamptz;email1 text;email2 text;
begin
 select id into a from auth.users where email='test_admin_fullaccess@gmail.com';
 select id into viewer from auth.users where email='test_admin_viewer@gmail.com';
 select id into c12 from public.classes where class_number=12 and is_active;
 select id into c11 from public.classes where class_number=11 and is_active;
 select id into c9 from public.classes where class_number=9 and is_active;
 if a is null or viewer is null then raise exception 'Dedicated QA admin identities missing';end if;
 begin
 req:=gen_random_uuid();uid:=gen_random_uuid();email1:='qa_rollback_'||replace(req::text,'-','')||'@example.com';
 begin perform public.admin_student_creation_begin_v1(viewer,req,'QA Student',email1,c12,true);raise exception 'Viewer creation accepted';exception when insufficient_privilege then null;end;
 r:=public.admin_student_creation_begin_v1(a,req,'QA Student',email1,c12,true);
 if r->>'status'<>'CREATE' then raise exception 'Creation was not claimed';end if;
 r:=public.admin_student_creation_begin_v1(a,req,'QA Student',email1,c12,true);
 if r->>'status'<>'BUSY' then raise exception 'Concurrent duplicate was not blocked';end if;
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
 values(uid,email1,now(),jsonb_build_object('admin_student_request',req,'admin_student_actor',a),jsonb_build_object('full_name','QA Student','class_id',c12));
 if (select is_active from public.student_profiles where id=uid) then raise exception 'Incomplete account was activated';end if;
 r:=public.admin_student_creation_begin_v1(a,req,'QA Student',email1,c12,true);
 if r->>'status'<>'RECOVER' or (r->>'user_id')::uuid<>uid then raise exception 'Auth response recovery failed';end if;
 r:=public.admin_student_creation_finish_v1(a,req,uid);
 if r->>'membership'<>'PAID' or (r->>'end_date')::timestamptz<>(((r->>'start_date')::timestamptz at time zone 'Asia/Kolkata')+interval '1 year') at time zone 'Asia/Kolkata' then raise exception 'Annual paid grant invalid';end if;
 if not cbse_membership.paid_for_class(uid,c12) or cbse_membership.paid_for_class(uid,c9) then raise exception 'Paid class scope invalid';end if;
 perform public.admin_student_creation_finish_v1(a,req,uid);
 if (select count(*) from public.subscriptions where student_id=uid)<>1 then raise exception 'Retry duplicated paid grant';end if;
 r:=public.admin_student_creation_begin_v1(a,req,'QA Student',email1,c12,true);
 if r->>'status'<>'COMPLETE' then raise exception 'Completed request not idempotent';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 state:=public.cbse_student_memberships_v1();
 if not (state->>'simple_class12')::boolean then raise exception 'Direct Class 12 is not simple';end if;
 begin perform public.cbse_membership_quote_v1('COMBO_11_12','NOW','');raise exception 'Direct Class 12 combo accepted';exception when invalid_parameter_value then null;end;
 begin perform public.cbse_membership_quote_v1('LEGACY_CURRENT','APRIL','');raise exception 'Direct Class 12 April accepted';exception when invalid_parameter_value then null;end;
 q:=public.cbse_membership_quote_v1('LEGACY_CURRENT','NOW','');
 if q->>'activation'<>'NOW' then raise exception 'Direct Class 12 immediate quote failed';end if;
 req2:=gen_random_uuid();uid2:=gen_random_uuid();email2:='qa_rollback_'||replace(req2::text,'-','')||'@example.com';
 perform public.admin_student_creation_begin_v1(a,req2,'QA Free',email2,c11,false);
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
 values(uid2,email2,now(),jsonb_build_object('admin_student_request',req2,'admin_student_actor',a),jsonb_build_object('full_name','QA Free','class_id',c11));
 r:=public.admin_student_creation_finish_v1(a,req2,uid2);
 if r->>'membership'<>'FREE' or exists(select 1 from public.subscriptions where student_id=uid2) then raise exception 'Free account was given paid membership';end if;
 -- Moving a student from 11 to 12 does not rewrite initial enrolment class.
 update public.student_profiles set class_id=c12,home_class_id=c12 where id=uid2;
 perform set_config('request.jwt.claim.sub',uid2::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid2,'role','authenticated')::text,true);
 state:=public.cbse_student_memberships_v1();
 if (state->>'simple_class12')::boolean then raise exception 'Progressing student misclassified as direct Class 12';end if;
 if has_function_privilege('authenticated','public.admin_student_creation_finish_v1(uuid,uuid,uuid)','execute') or has_function_privilege('anon','public.admin_student_creation_begin_v1(uuid,uuid,text,text,bigint,boolean)','execute') then raise exception 'Creation RPC exposed';end if;
 raise exception 'QA_ADMIN_CREATE_ROLLBACK_SUCCESS';
 exception when raise_exception then if sqlerrm<>'QA_ADMIN_CREATE_ROLLBACK_SUCCESS' then raise;end if;end;
end $test$;
select 'PASS: Full Admin only, verified identity, paid year/scope, free allowances, retries/recovery, Class 12 simplicity; fixtures rolled back' as result;
