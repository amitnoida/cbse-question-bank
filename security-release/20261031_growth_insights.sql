create function public.ey_recommendations(p_user uuid,p_class bigint)returns jsonb language sql stable set search_path='' as $$
 with observed as(
 select q.chapter_id,a.is_correct from public.quiz_attempt_answers a join public.quiz_attempts t on t.id=a.attempt_id join public.questions q on q.id=a.question_id where t.student_id=p_user and t.status in('COMPLETED','Submitted','Reviewed')and coalesce(t.submitted_at,t.created_at)>now()-interval '14 days'
 union all select(v->>'chapter_id')::bigint,e.answers->>(v->>'id')=v->>'correct_option' from public.ey_sessions e cross join lateral jsonb_array_elements(e.questions)v where e.student_id=p_user and e.completed_at>now()-interval '14 days'
 ),summary as(select c.id,c.chapter_name,s.subject_name,count(*)::int questions,count(*)filter(where o.is_correct)::int correct,round(100.0*count(*)filter(where o.is_correct)/count(*))accuracy from observed o join public.chapters c on c.id=o.chapter_id join public.subjects s on s.id=c.subject_id where s.class_id=p_class and c.is_active and s.is_active group by c.id,c.chapter_name,s.subject_name having count(*)filter(where not o.is_correct)>0 order by round(100.0*count(*)filter(where o.is_correct)/count(*)),count(*)desc limit 8)
 select coalesce(jsonb_agg(to_jsonb(summary)),'[]')from summary;
$$;
create function public.ey_report(p_user uuid,p_question bigint,p_reason text)returns uuid language plpgsql set search_path='' as $$declare result uuid;begin
 if length(p_reason)not between 10 and 1000 then raise exception 'Describe the issue in 10–1000 characters';end if;
 perform pg_advisory_xact_lock(hashtextextended('ey:report:'||p_user::text,0));
 if(select count(*)from public.ey_reports where student_id=p_user and created_at>now()-interval '1 day')>=10 then raise exception 'Daily report limit reached';end if;
 if not exists(select 1 from public.questions q join public.chapters c on c.id=q.chapter_id join public.subjects s on s.id=c.subject_id where q.id=p_question and cbse_membership.can_access_class(p_user,s.class_id)and(
 exists(select 1 from public.practice_sessions ps where ps.student_id=p_user and ps.question_ids @>array[q.id]::bigint[] and ps.updated_at>now()-interval '14 days')or
 exists(select 1 from public.quiz_attempt_answers ans join public.quiz_attempts t on t.id=ans.attempt_id where t.student_id=p_user and t.status in('COMPLETED','Submitted','Reviewed')and coalesce(t.submitted_at,t.created_at)>now()-interval '14 days'and ans.question_id=q.id)or
 exists(select 1 from public.ey_sessions e cross join lateral jsonb_array_elements(e.questions)v where e.student_id=p_user and e.created_at>now()-interval '14 days'and(v->>'id')::bigint=q.id)))then raise exception 'Question access required'using errcode='42501';end if;
 insert into public.ey_reports(student_id,question_id,reason)values(p_user,p_question,p_reason)returning id into result;return result;
end$$;
create function public.ey_growth_metrics()returns jsonb language sql stable set search_path='' as $$select jsonb_build_object(
 'asOf',now(),'registrations7d',(select count(*)from public.student_profiles where created_at>now()-interval '7 days'and account_type='STUDENT'),
 'firstPractice7d',(select count(distinct student_id)from public.quiz_attempts where status in('COMPLETED','Submitted','Reviewed')and coalesce(submitted_at,created_at)>now()-interval '7 days'),
 'repeatLearners7d',(select count(*)from(select student_id from(select student_id,(coalesce(submitted_at,created_at)at time zone 'Asia/Kolkata')::date as activity_day from public.quiz_attempts where status in('COMPLETED','Submitted','Reviewed')and coalesce(submitted_at,created_at)>now()-interval '7 days' union select student_id,day from public.ey_sessions where completed_at>now()-interval '7 days')d group by student_id having count(distinct activity_day)>=2)x),
 'dailyCompletions7d',(select count(*)from public.ey_sessions where mode='DAILY'and completed_at>now()-interval '7 days'),
 'assignments',(select count(*)from public.ey_assignments where is_active and expires_at>now()),
 'openReports',(select count(*)from public.ey_reports where status<>'RESOLVED'),
 'publicEvents',(select coalesce(jsonb_agg(x),'[]')from(select day,event,channel,count from public.ey_public_counts where day>=current_date-30 order by day desc)x));$$;
create function public.ey_assignment_results(p_teacher uuid)returns jsonb language sql stable set search_path='' as $$select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select a.id,a.title,a.subject_id,a.chapter_id,a.expires_at,a.is_active,a.created_at,jsonb_array_length(a.questions)total,count(e.id)::int started,count(e.id)filter(where e.completed_at is not null)::int completed,
 round(avg((select count(*)filter(where e.answers->>(v->>'id')=v->>'correct_option')from jsonb_array_elements(e.questions)v)*100.0/nullif(jsonb_array_length(e.questions),0))filter(where e.completed_at is not null))average_accuracy
 from public.ey_assignments a left join public.ey_sessions e on e.assignment_id=a.id where a.teacher_id=p_teacher group by a.id order by a.created_at desc limit 50)x;$$;
do $$declare fn regprocedure;begin for fn in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'and p.proname in('ey_recommendations','ey_report','ey_growth_metrics','ey_assignment_results')loop execute format('revoke all on function %s from public,anon,authenticated',fn);execute format('grant execute on function %s to service_role',fn);end loop;end$$;
