-- Run only after the session-aware frontend is deployed and READY.
-- Preserve the two newest current logins; expire older native sessions and their refresh tokens.
do $enable$
begin
 perform 1 from cbse_sessions.policy where singleton for update;
 if (select enabled from cbse_sessions.policy where singleton) then return;end if;
 with ranked as(
 select s.id,s.user_id,coalesce(s.created_at,now()) as signed_at,
 row_number() over(partition by s.user_id order by s.created_at desc nulls last,s.id desc) as rn
 from auth.sessions s join public.student_profiles p on p.id=s.user_id and p.is_active
 where (s.not_after is null or s.not_after>now()) and not exists(select 1 from public.admin_users a where a.user_id=s.user_id)
 )
 insert into public.student_device_sessions(session_id,student_id,signed_in_at,revoked_at,revoke_reason)
 select id,user_id,signed_at,case when rn>2 then now() else null end,case when rn>2 then 'DEVICE_LIMIT' else null end from ranked
 on conflict(session_id) do nothing;
 delete from auth.sessions s using public.student_device_sessions d where s.id=d.session_id and s.user_id=d.student_id and d.revoked_at is not null and d.revoke_reason='DEVICE_LIMIT';
 update cbse_sessions.policy set enabled=true where singleton;
end $enable$;
select enabled,max_sessions from cbse_sessions.policy where singleton;
