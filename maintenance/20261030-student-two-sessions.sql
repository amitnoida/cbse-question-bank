-- Staged rollout: enable only after the session-aware frontend is READY.
create schema if not exists cbse_sessions;
revoke all on schema cbse_sessions from public,anon;
grant usage on schema cbse_sessions to anon,authenticated,service_role;
create table cbse_sessions.policy(singleton boolean primary key default true check(singleton),enabled boolean not null default false,max_sessions integer not null default 2 check(max_sessions=2));
insert into cbse_sessions.policy(singleton) values(true);
create table public.student_device_sessions(
 session_id uuid primary key,student_id uuid not null references public.student_profiles(id) on delete cascade,
 signed_in_at timestamptz not null,registered_at timestamptz not null default now(),revoked_at timestamptz,
 revoke_reason text check(revoke_reason in ('DEVICE_LIMIT','SIGNED_OUT'))
);
create index student_device_sessions_active_idx on public.student_device_sessions(student_id,signed_in_at desc,session_id desc) where revoked_at is null;
alter table cbse_sessions.policy enable row level security;
alter table public.student_device_sessions enable row level security;
revoke all on cbse_sessions.policy,public.student_device_sessions from public,anon,authenticated;
grant select on public.student_device_sessions to authenticated;
create policy student_device_sessions_owned on public.student_device_sessions for select to authenticated using(student_id=(select auth.uid()));

create function cbse_sessions.allowed() returns boolean language plpgsql stable security definer set search_path='' as $$
declare u uuid:=auth.uid(); sid uuid;
begin
 if not (select enabled from cbse_sessions.policy where singleton) then return true;end if;
 if u is null then return false;end if;
 if exists(select 1 from public.admin_users where user_id=u) then return true;end if;
 begin sid:=nullif(auth.jwt()->>'session_id','')::uuid;exception when invalid_text_representation then return false;end;
 if sid is null then return false;end if;
 return exists(select 1 from public.student_device_sessions d join auth.sessions s on s.id=d.session_id and s.user_id=d.student_id
 where d.session_id=sid and d.student_id=u and d.revoked_at is null and (s.not_after is null or s.not_after>now()));
end $$;
create function cbse_sessions.claim() returns jsonb language plpgsql security definer set search_path='' as $$
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
create function cbse_sessions.api_guard() returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not (select enabled from cbse_sessions.policy where singleton) then return;end if;
 if exists(select 1 from public.admin_users where user_id=u) then return;end if;
 if current_setting('request.path',true)='/rpc/cbse_claim_student_session_v1' then return;end if;
 if not cbse_sessions.allowed() then
 raise sqlstate 'PGRST' using message='{"code":"CBSE_SESSION_REVOKED","message":"You were signed out because your account was used on another device. Only two active sessions are allowed.","details":null,"hint":null}',detail='{"status":403}';
 end if;
end $$;
create function public.cbse_claim_student_session_v1() returns jsonb language sql security invoker set search_path='' as $$select cbse_sessions.claim();$$;
create function public.cbse_student_session_status_v1() returns jsonb language sql security invoker set search_path='' as $$select jsonb_build_object('allowed',cbse_sessions.allowed());$$;
create function public.cbse_api_session_guard_v1() returns void language sql security invoker set search_path='' as $$select cbse_sessions.api_guard();$$;
revoke all on all functions in schema cbse_sessions from public,anon,authenticated;
grant execute on function cbse_sessions.claim(),cbse_sessions.allowed() to authenticated;
grant execute on function cbse_sessions.api_guard() to anon,authenticated,service_role;
revoke all on function public.cbse_claim_student_session_v1(),public.cbse_student_session_status_v1() from public,anon;
grant execute on function public.cbse_claim_student_session_v1(),public.cbse_student_session_status_v1() to authenticated;
revoke all on function public.cbse_api_session_guard_v1() from public;
grant execute on function public.cbse_api_session_guard_v1() to anon,authenticated,service_role;
create or replace function public.is_active_student() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.student_profiles sp where sp.id=auth.uid() and sp.is_active)
 and not exists(select 1 from public.admin_users a where a.user_id=auth.uid()) and cbse_sessions.allowed();
$$;
alter role authenticator set pgrst.db_pre_request='public.cbse_api_session_guard_v1';
notify pgrst,'reload config';
