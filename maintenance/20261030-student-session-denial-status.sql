create or replace function cbse_sessions.api_guard() returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid();
begin
 if u is null or not (select enabled from cbse_sessions.policy where singleton) then return;end if;
 if exists(select 1 from public.admin_users where user_id=u) then return;end if;
 if current_setting('request.path',true)='/rpc/cbse_claim_student_session_v1' then return;end if;
 if not cbse_sessions.allowed() then
 raise sqlstate 'PT403' using message='You were signed out because your account was used on another device. Only two active sessions are allowed.',detail='CBSE_SESSION_REVOKED';
 end if;
end $$;
