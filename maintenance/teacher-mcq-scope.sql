create or replace function public.cbse_teacher_sets_v1(p_teacher uuid,p_subject bigint,p_chapter bigint default 0) returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.teacher_profiles t join public.subjects s on s.class_id=t.class_id where t.id=p_teacher and t.is_active and t.starts_at<=now() and t.expires_at>now() and s.id=p_subject and s.is_active) then raise exception 'Subject not available' using errcode='42501';end if;
 if p_chapter<>0 and not exists(select 1 from public.chapters where id=p_chapter and subject_id=p_subject and is_active) then raise exception 'Chapter not available' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('teacher-sets:'||p_teacher||':'||p_subject||':'||p_chapter,0));
 if not exists(select 1 from public.teacher_review_sets where teacher_id=p_teacher and subject_id=p_subject and chapter_scope=p_chapter) then
 insert into public.teacher_review_sets(teacher_id,subject_id,chapter_scope,set_number,question_ids)
 select p_teacher,p_subject,p_chapter,((rn-1)/60+1)::integer,array_agg(id order by rn) from
 (select q.id,row_number() over(order by c.chapter_number,c.id,q.id) rn from public.questions q join public.chapters c on c.id=q.chapter_id where c.subject_id=p_subject and c.is_active and q.is_active and q.question_type='MCQ' and (p_chapter=0 or c.id=p_chapter)) x group by ((rn-1)/60+1);
 end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by set_number) from
 (select s.id,s.set_number,cardinality(s.question_ids) total,
 (select count(*) from public.teacher_question_reviews r where r.teacher_id=p_teacher and r.question_id=any(s.question_ids) and r.question_snapshot=public.cbse_teacher_question_snapshot(r.question_id)) reviewed
 from public.teacher_review_sets s where s.teacher_id=p_teacher and s.subject_id=p_subject and s.chapter_scope=p_chapter) x),'[]'::jsonb);
end $$;
create or replace function public.cbse_teacher_save_review_v1(p_teacher uuid,p_question bigint,p_decision text,p_comment text,p_option text,p_explanation text,p_snapshot jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare snap jsonb; rid uuid;
begin
 if p_decision is null or p_decision not in ('APPROVE','DELETE','CORRECT') or length(coalesce(p_comment,''))>4000 or length(coalesce(p_explanation,''))>8000 then raise exception 'Invalid review' using errcode='22023';end if;
 if p_decision<>'APPROVE' and length(btrim(coalesce(p_comment,'')))=0 then raise exception 'Add a reason or correction comment' using errcode='22023';end if;
 if p_decision='CORRECT' and (p_option is null or p_option not in ('A','B','C','D') or length(btrim(coalesce(p_explanation,'')))=0) then raise exception 'Select the correct answer and add an explanation' using errcode='22023';end if;
 perform 1 from public.questions q join public.chapters c on c.id=q.chapter_id join public.subjects s on s.id=c.subject_id join public.teacher_profiles t on t.class_id=s.class_id
 where q.id=p_question and q.is_active and q.question_type='MCQ' and c.is_active and s.is_active and t.id=p_teacher and t.is_active and t.starts_at<=now() and t.expires_at>now() for share of q;
 if not found then raise exception 'Question not available' using errcode='42501';end if;
 snap:=public.cbse_teacher_question_snapshot(p_question);
 if snap is distinct from p_snapshot then raise exception 'Question changed. Reload it before saving.' using errcode='40001';end if;
 insert into public.teacher_question_reviews(teacher_id,question_id,decision,comment,suggested_option,suggested_explanation,question_snapshot,resolution)
 values(p_teacher,p_question,p_decision,coalesce(p_comment,''),case when p_decision='CORRECT' then p_option end,case when p_decision='CORRECT' then p_explanation else '' end,snap,case when p_decision='APPROVE' then 'APPROVED' else 'PENDING' end)
 on conflict(teacher_id,question_id) do update set decision=excluded.decision,comment=excluded.comment,suggested_option=excluded.suggested_option,suggested_explanation=excluded.suggested_explanation,question_snapshot=snap,resolution=excluded.resolution,admin_note='',resolved_by=null,resolved_at=null,updated_at=now() returning id into rid;
 insert into public.teacher_review_audit(review_id,actor_id,action,details) values(rid,p_teacher,'TEACHER_REVIEW',jsonb_build_object('decision',p_decision,'comment',p_comment,'option',p_option,'explanation',p_explanation,'snapshot',snap));
 return rid;
end $$;
