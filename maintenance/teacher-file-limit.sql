-- Serialize upload reservations and bound each source submission to ten files.
create function cbse_membership.teacher_file_limit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.teacher_mcq_submissions where id=new.submission_id for update;
 if not exists(select 1 from public.teacher_mcq_submissions where id=new.submission_id and status='DRAFT') then raise exception 'Submission is already closed';end if;
 if(select count(*) from public.teacher_mcq_files where submission_id=new.submission_id)>=10 then raise exception 'Maximum ten files per submission';end if;
 return new;
end $$;
revoke all on function cbse_membership.teacher_file_limit() from public,anon,authenticated;
create trigger teacher_file_limit before insert on public.teacher_mcq_files for each row execute function cbse_membership.teacher_file_limit();
