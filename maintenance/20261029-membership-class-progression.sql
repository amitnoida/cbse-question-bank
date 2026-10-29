-- Explicit academic progression; never reset the permanent free-set ledger.
create function cbse_membership.progress_class(p_class bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); home_number integer; next_number integer;
begin
 if u is null or not public.is_active_student() then raise exception 'Active student required' using errcode='42501';end if;
 perform 1 from public.student_profiles where id=u for update;
 select c.class_number into home_number from public.student_profiles p join public.classes c on c.id=p.home_class_id where p.id=u;
 select class_number into next_number from public.classes where id=p_class and is_active;
 if home_number is null or next_number is distinct from home_number+1 or not cbse_membership.paid_for_class(u,p_class) then
 raise exception 'Progression requires active membership for your next school class' using errcode='42501';end if;
 if exists(select 1 from public.mock_exam_sessions where student_id=u and status='STARTED' and deadline_at>now()) then raise exception 'Finish your running mock before progressing';end if;
 update public.student_profiles set home_class_id=p_class,class_id=p_class where id=u;
 insert into public.student_enrollments(student_id,class_id) values(u,p_class) on conflict(student_id,class_id) do nothing;
 insert into public.membership_events(student_id,actor_id,event_type,details) values(u,u,'SCHOOL_CLASS_PROGRESSION',jsonb_build_object('class_id',p_class,'previous_class_number',home_number));
 return cbse_membership.student_state();
end $$;
revoke all on function cbse_membership.progress_class(bigint) from public,anon;
grant execute on function cbse_membership.progress_class(bigint) to authenticated;
create function public.cbse_progress_class_v1(p_class_id bigint) returns jsonb language sql security invoker set search_path='' as $$select cbse_membership.progress_class(p_class_id);$$;
revoke all on function public.cbse_progress_class_v1(bigint) from public,anon;
grant execute on function public.cbse_progress_class_v1(bigint) to authenticated;
