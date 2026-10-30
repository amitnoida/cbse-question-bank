-- Browser extracts text; Full Admin server validates and commits one atomic batch per file.
alter table public.teacher_mcq_files add column source_deleted_at timestamptz;
create table public.teacher_mcq_imports(
 file_id uuid primary key references public.teacher_mcq_files(id) on delete cascade,
 submission_id uuid not null references public.teacher_mcq_submissions(id) on delete cascade,
 actor_id uuid not null,chapter_id bigint not null references public.chapters(id),source_sha256 text not null check(source_sha256 ~ '^[0-9a-f]{64}$'),
 parser_version integer not null,total_count integer not null,imported_count integer not null,skipped_count integer not null,duplicate_count integer not null,
 skip_reasons jsonb not null default '{}',question_ids bigint[] not null default '{}',completed_at timestamptz not null default now(),source_deleted_at timestamptz,
 check(total_count=imported_count+skipped_count),check(total_count between 1 and 3000),check(imported_count>=0 and skipped_count>=0 and duplicate_count>=0)
);
alter table public.teacher_mcq_imports enable row level security;
revoke all on public.teacher_mcq_imports from public,anon,authenticated;
grant all on public.teacher_mcq_imports to service_role;
create index teacher_imports_submission_idx on public.teacher_mcq_imports(submission_id);
create index teacher_imports_chapter_idx on public.teacher_mcq_imports(chapter_id);
create function public.cbse_mcq_fingerprint_v1(q text,a text,b text,c text,d text) returns text language sql immutable security invoker set search_path='' as $$
 select md5(lower(regexp_replace(btrim(q)||chr(31)||btrim(a)||chr(31)||btrim(b)||chr(31)||btrim(c)||chr(31)||btrim(d),'[[:space:]]+',' ','g')));
$$;
revoke all on function public.cbse_mcq_fingerprint_v1(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.cbse_mcq_fingerprint_v1(text,text,text,text,text) to service_role;
create index questions_teacher_import_fingerprint_idx on public.questions(chapter_id,public.cbse_mcq_fingerprint_v1(question_text,option_a,option_b,option_c,option_d));
create function public.cbse_import_teacher_mcqs_v1(p_actor uuid,p_file uuid,p_chapter bigint,p_sha256 text,p_total integer,p_skipped integer,p_reasons jsonb,p_questions jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare f public.teacher_mcq_files;s public.teacher_mcq_submissions;previous public.teacher_mcq_imports;v jsonb;fingerprint text;qid bigint;ids bigint[]:='{}';duplicates integer:=0;imported integer:=0;option_values text[];
begin
 if not exists(select 1 from public.admin_profiles p join public.admin_users a on a.user_id=p.id where p.id=p_actor and p.role='FULL_ADMIN' and p.is_active and not p.must_change_password) then raise exception 'Full Admin required' using errcode='42501';end if;
 -- Global import lock serializes duplicate checking across different files; per-file PK handles retries.
 perform pg_advisory_xact_lock(hashtextextended('teacher-mcq-import',0));
 select * into previous from public.teacher_mcq_imports where file_id=p_file;
 if found then return to_jsonb(previous)||jsonb_build_object('already_imported',true);end if;
 select * into f from public.teacher_mcq_files where id=p_file for update;
 if not found or not f.uploaded or f.source_deleted_at is not null or f.mime_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') then raise exception 'Source unavailable' using errcode='22023';end if;
 select * into s from public.teacher_mcq_submissions where id=f.submission_id for update;
 if s.status='DRAFT' or not exists(select 1 from public.chapters c join public.subjects subject on subject.id=c.subject_id join public.classes school on school.id=subject.class_id where c.id=p_chapter and c.subject_id=s.subject_id and c.is_active and subject.is_active and school.is_active and school.class_number between 8 and 12) then raise exception 'Choose an active chapter in the submitted subject' using errcode='22023';end if;
 if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or p_total is null or p_total not between 1 and 3000 or p_skipped is null or p_skipped<0 or jsonb_typeof(p_questions) is distinct from 'array' or jsonb_typeof(p_reasons) is distinct from 'object' then raise exception 'Invalid import batch' using errcode='22023';end if;
 if jsonb_array_length(p_questions)+p_skipped<>p_total then raise exception 'Question accounting mismatch' using errcode='22023';end if;
 for v in select value from jsonb_array_elements(p_questions) loop
 option_values:=array[v->>'option_a',v->>'option_b',v->>'option_c',v->>'option_d'];
 if length(btrim(coalesce(v->>'question_text',''))) not between 5 and 4000 or length(btrim(coalesce(v->>'explanation',''))) not between 5 and 8000 or coalesce(v->>'correct_option','') not in ('A','B','C','D') or exists(select 1 from unnest(option_values) o where length(btrim(coalesce(o,''))) not between 1 and 1500) or (select count(distinct lower(btrim(o))) from unnest(option_values) o)<>4 then raise exception 'Incomplete MCQ in import batch' using errcode='22023';end if;
 fingerprint:=public.cbse_mcq_fingerprint_v1(v->>'question_text',option_values[1],option_values[2],option_values[3],option_values[4]);
 if exists(select 1 from public.questions q where q.chapter_id=p_chapter and public.cbse_mcq_fingerprint_v1(q.question_text,q.option_a,q.option_b,q.option_c,q.option_d)=fingerprint) then duplicates:=duplicates+1;continue;end if;
 insert into public.questions(chapter_id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,difficulty,question_type,marks,is_active,question_usage,content_review_status,media_ready,import_key)
 values(p_chapter,v->>'question_text',option_values[1],option_values[2],option_values[3],option_values[4],v->>'correct_option',v->>'explanation','Medium','MCQ',1,true,'SHARED','APPROVED',true,'TEACHER_FILE:'||p_file||':'||(v->>'ordinal')) returning id into qid;
 ids:=array_append(ids,qid);imported:=imported+1;
 end loop;
 insert into public.teacher_mcq_imports(file_id,submission_id,actor_id,chapter_id,source_sha256,parser_version,total_count,imported_count,skipped_count,duplicate_count,skip_reasons,question_ids)
 values(p_file,s.id,p_actor,p_chapter,p_sha256,1,p_total,imported,p_skipped+duplicates,duplicates,p_reasons,ids) returning * into previous;
 if (select count(*) from public.questions where id=any(ids))<>imported then raise exception 'Import verification failed';end if;
 insert into public.teacher_review_audit(actor_id,action,details) values(p_actor,'MCQ_FILE_IMPORTED',jsonb_build_object('file_id',p_file,'teacher_id',s.teacher_id,'chapter_id',p_chapter,'imported',imported,'skipped',p_skipped+duplicates));
 return to_jsonb(previous)||jsonb_build_object('already_imported',false);
end $$;
create function public.cbse_teacher_import_cleanup_v1(p_actor uuid,p_file uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare batch public.teacher_mcq_imports;
begin
 if not exists(select 1 from public.admin_profiles p join public.admin_users a on a.user_id=p.id where p.id=p_actor and p.role='FULL_ADMIN' and p.is_active and not p.must_change_password) then raise exception 'Full Admin required' using errcode='42501';end if;
 select * into batch from public.teacher_mcq_imports where file_id=p_file for update;
 if not found then raise exception 'A committed import is required before cleanup' using errcode='22023';end if;
 if(select count(*) from public.questions where id=any(batch.question_ids))<>batch.imported_count then raise exception 'Imported questions cannot be verified';end if;
 update public.teacher_mcq_files set source_deleted_at=coalesce(source_deleted_at,now()) where id=p_file;
 update public.teacher_mcq_imports set source_deleted_at=coalesce(source_deleted_at,now()) where file_id=p_file returning * into batch;
 if not exists(select 1 from public.teacher_mcq_files where submission_id=batch.submission_id and uploaded and source_deleted_at is null) then
 update public.teacher_mcq_submissions set status='ADDED',admin_note='Processing complete. Readable, complete MCQs imported; incomplete and duplicate questions skipped. Original files deleted.',updated_by=p_actor,updated_at=now() where id=batch.submission_id;
 end if;
 return to_jsonb(batch);
end $$;
revoke all on function public.cbse_import_teacher_mcqs_v1(uuid,uuid,bigint,text,integer,integer,jsonb,jsonb),public.cbse_teacher_import_cleanup_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cbse_import_teacher_mcqs_v1(uuid,uuid,bigint,text,integer,integer,jsonb,jsonb),public.cbse_teacher_import_cleanup_v1(uuid,uuid) to service_role;
create function public.cbse_teacher_import_verified_v1(p_file uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.teacher_mcq_imports b where b.file_id=p_file and b.imported_count=(select count(*) from public.questions q where q.id=any(b.question_ids)));
$$;
revoke all on function public.cbse_teacher_import_verified_v1(uuid) from public,anon,authenticated;
grant execute on function public.cbse_teacher_import_verified_v1(uuid) to service_role;
update storage.buckets set allowed_mime_types=array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'] where id='teacher-mcq-submissions';
