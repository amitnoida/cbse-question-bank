-- All fixtures belong to a new disposable identity; the entire transaction explicitly rolls back.
BEGIN;
do $test$
declare u uuid:=gen_random_uuid(); admin_id uuid; a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();c uuid:=gen_random_uuid();late_old uuid:=gen_random_uuid();d uuid:=gen_random_uuid();x uuid;r jsonb;
begin
 select id into admin_id from auth.users where email='test_admin_fullaccess@gmail.com';
 if admin_id is null then raise exception 'Dedicated QA identities missing';end if;
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(u,'qa_rollback_devices_'||replace(u::text,'-','')||'@example.com',now(),jsonb_build_object('full_name','Rollback-only device fixture','class_id',(select id from public.classes where class_number=8 and is_active)));
 update cbse_sessions.policy set enabled=true where singleton;
 insert into auth.sessions(id,user_id,created_at,updated_at) values
 (a,u,now()-interval '10 seconds',now()),(b,u,now()-interval '9 seconds',now()),(c,u,now()-interval '8 seconds',now()),(late_old,u,now()-interval '11 seconds',now()),(d,u,now()-interval '7 seconds',now());
 perform set_config('request.jwt.claim.sub',u::text,true);
 foreach x in array array[a,b] loop
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',x)::text,true);
 r:=public.cbse_claim_student_session_v1();if not(r->>'allowed')::boolean then raise exception 'First two sessions rejected';end if;end loop;
 -- Same browser, tabs or token refresh retain the same Auth session_id.
 perform public.cbse_claim_student_session_v1();
 if(select count(*) from public.student_device_sessions where student_id=u and revoked_at is null)<>2 then raise exception 'Same session consumed another slot';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',c)::text,true);
 r:=public.cbse_claim_student_session_v1();if not(r->>'allowed')::boolean then raise exception 'Third login rejected';end if;
 if not exists(select 1 from public.student_device_sessions where session_id=a and revoke_reason='DEVICE_LIMIT') then raise exception 'Oldest not revoked';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',a)::text,true);
 if(public.cbse_claim_student_session_v1()->>'allowed')::boolean or public.is_active_student() then raise exception 'Revoked session reclaimed access';end if;
 begin perform public.mock_save_answer(gen_random_uuid(),1,'A');raise exception 'Revoked answer accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.path','/rpc/mock_finish_exam',true);
 begin perform public.cbse_api_session_guard_v1();raise exception 'API guard allowed revoked token';exception when sqlstate 'PT403' then null;end;
 -- A stale native session that first visits late must not displace either newer login.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',late_old)::text,true);
 if(public.cbse_claim_student_session_v1()->>'allowed')::boolean then raise exception 'Delayed old login displaced a new login';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','session_id',d)::text,true);
 if not(public.cbse_claim_student_session_v1()->>'allowed')::boolean then raise exception 'Fourth new login rejected';end if;
 if not exists(select 1 from public.student_device_sessions where session_id=b and revoked_at is not null) then raise exception 'Next oldest not revoked';end if;
 -- Native logout invalidates even a still-unexpired JWT.
 delete from auth.sessions where id=d;
 if(public.cbse_student_session_status_v1()->>'allowed')::boolean then raise exception 'Logged-out native session accepted';end if;
 -- No registry/session ownership can be forged from a different JWT identity.
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated','session_id',gen_random_uuid())::text,true);
 if not(public.cbse_claim_student_session_v1()->>'exempt')::boolean then raise exception 'Admin not exempt';end if;
 if has_table_privilege('authenticated','public.student_device_sessions','UPDATE') or has_function_privilege('anon','public.cbse_claim_student_session_v1()','EXECUTE') then raise exception 'Session controls exposed';end if;
end $test$;
ROLLBACK;
select 'PASS: two slots, oldest eviction, duplicate/refresh stability, old-token and answer rejection, stale login ordering, native logout and admin exemption; rolled back' as result;
