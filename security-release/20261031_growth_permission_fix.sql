grant execute on function cbse_membership.can_access_class(uuid,bigint) to service_role;
create or replace function public.ey_answer(p_user uuid,p_session uuid,p_question bigint,p_answer text)returns jsonb language plpgsql set search_path='' as $$
declare r public.ey_sessions;selected_q jsonb;n integer;s bigint;c integer;
begin
 if p_answer is null or p_answer not in('A','B','C','D')then raise exception 'Choose A, B, C or D';end if;
 select * into r from public.ey_sessions where id=p_session and student_id=p_user and created_at>now()-interval '14 days'for update;if not found then raise exception 'Session unavailable'using errcode='42501';end if;
 if not cbse_membership.can_access_class(p_user,r.class_id)then raise exception 'Class access required'using errcode='42501';end if;
 if r.assignment_id is not null and not exists(select 1 from public.ey_assignments a join public.teacher_profiles t on t.id=a.teacher_id where a.id=r.assignment_id and a.is_active and a.expires_at>now()and t.is_active and t.starts_at<=now()and t.expires_at>now())then raise exception 'Assignment closed';end if;
 select x into selected_q from jsonb_array_elements(r.questions)x where(x->>'id')::bigint=p_question;if selected_q is null then raise exception 'Question not assigned';end if;
 if r.answers?p_question::text or r.completed_at is not null then return to_jsonb(r);end if;
 r.answers:=r.answers||jsonb_build_object(p_question::text,p_answer);select count(*)into n from jsonb_object_keys(r.answers);if n=jsonb_array_length(r.questions)then r.completed_at:=now();end if;
 update public.ey_sessions set answers=r.answers,completed_at=r.completed_at where id=r.id;
 if r.completed_at is not null then
 insert into public.ey_progress_receipts(receipt,student_id)values('growth:'||r.id::text,p_user)on conflict do nothing;
 if found then
 for s,n,c in select(v->>'subject_id')::bigint,count(*)::int,count(*)filter(where r.answers->>(v->>'id')=v->>'correct_option')::int from jsonb_array_elements(r.questions)v group by 1 loop
 insert into public.ey_monthly_progress values(p_user,date_trunc('month',now()at time zone 'Asia/Kolkata')::date,r.mode,s,1,n,c)on conflict(student_id,month,source,subject_id)do update set sessions=public.ey_monthly_progress.sessions+1,answered=public.ey_monthly_progress.answered+excluded.answered,correct=public.ey_monthly_progress.correct+excluded.correct;
 end loop;end if;end if;return to_jsonb(r);
end$$;

create policy ey_demo_no_client on public.ey_demo_samples for all to anon,authenticated using(false)with check(false);
create policy ey_counts_no_client on public.ey_public_counts for all to anon,authenticated using(false)with check(false);
