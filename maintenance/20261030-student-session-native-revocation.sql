create or replace function cbse_sessions.claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); sid uuid; signed_at timestamptz; enforced boolean;
begin
 if u is null then raise exception 'Sign in required' using errcode='42501';end if;
 if exists(select 1 from public.admin_users where user_id=u) then return jsonb_build_object('allowed',true,'exempt',true);end if;
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
end $$;
