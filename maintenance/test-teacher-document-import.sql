BEGIN;
DO $test$
declare a uuid;viewer uuid;u uuid:=gen_random_uuid();r uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();fid uuid:=gen_random_uuid();other uuid:=gen_random_uuid();c bigint;subject bigint;chapter bigint;batch jsonb;items jsonb;token text:=gen_random_uuid()::text;
begin
 select id into a from auth.users where email='test_admin_fullaccess@gmail.com';select id into viewer from auth.users where email='test_admin_viewer@gmail.com';
 select id into c from public.classes where class_number=12 and is_active;
 select s.id,ch.id into subject,chapter from public.subjects s join public.chapters ch on ch.subject_id=s.id where s.class_id=c and s.is_active and ch.is_active order by s.id,ch.id limit 1;
 perform public.admin_account_creation_begin_v2(a,r,'QA Import Rollback','qa_import_rollback_'||r||'@example.com',c,true,'TEACHER');
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(u,'qa_import_rollback_'||r||'@example.com',now(),jsonb_build_object('admin_student_request',r,'admin_student_actor',a),jsonb_build_object('full_name','QA Import Rollback','class_id',c));perform public.admin_student_creation_finish_v1(a,r,u);
 insert into public.teacher_mcq_submissions(id,teacher_id,subject_id,chapter_id,status) values(sid,u,subject,chapter,'DRAFT');
 insert into public.teacher_mcq_files(id,submission_id,file_name,object_path,mime_type,file_size,uploaded) values(fid,sid,'rollback.pdf',u||'/'||sid||'/'||fid||'.pdf','application/pdf',100,true);
 update public.teacher_mcq_submissions set status='SUBMITTED' where id=sid;
 items:=jsonb_build_array(jsonb_build_object('ordinal',1,'question_text','QA first complete question '||token,'option_a','one','option_b','two','option_c','three','option_d','four','correct_option','B','explanation','A complete source explanation.'),jsonb_build_object('ordinal',2,'question_text','QA second complete question '||token,'option_a','one','option_b','two','option_c','three','option_d','four','correct_option','A','explanation','Another complete explanation.'),jsonb_build_object('ordinal',3,'question_text','QA first complete question '||token,'option_a','one','option_b','two','option_c','three','option_d','four','correct_option','B','explanation','A complete source explanation.'));
 begin perform public.cbse_import_teacher_mcqs_v1(viewer,fid,chapter,repeat('a',64),5,2,'{}',items);raise exception 'Viewer imported';exception when insufficient_privilege then null;end;
 batch:=public.cbse_import_teacher_mcqs_v1(a,fid,chapter,repeat('a',64),5,2,'{}',items);
 if (batch->>'imported_count')::int<>2 or (batch->>'skipped_count')::int<>3 or (batch->>'duplicate_count')::int<>1 then raise exception 'Counts or duplicate detection incorrect';end if;
 if not public.cbse_teacher_import_verified_v1(fid) then raise exception 'Import verification failed';end if;
 batch:=public.cbse_import_teacher_mcqs_v1(a,fid,chapter,repeat('a',64),5,2,'{}',items);
 if not(batch->>'already_imported')::boolean or (select count(*) from public.questions where import_key like 'TEACHER_FILE:'||fid||':%')<>2 then raise exception 'Retry duplicated questions';end if;
 if (select source_deleted_at from public.teacher_mcq_files where id=fid) is not null then raise exception 'Database import prematurely removed source';end if;
 begin perform public.cbse_teacher_import_cleanup_v1(a,other);raise exception 'Cleanup without commit';exception when invalid_parameter_value then null;end;
 perform public.cbse_teacher_import_cleanup_v1(a,fid);
 if (select source_deleted_at from public.teacher_mcq_files where id=fid) is null or (select status from public.teacher_mcq_submissions where id=sid)<>'ADDED' then raise exception 'Cleanup history missing';end if;
 if has_function_privilege('authenticated','public.cbse_import_teacher_mcqs_v1(uuid,uuid,bigint,text,integer,integer,jsonb,jsonb)','EXECUTE') or has_table_privilege('authenticated','public.teacher_mcq_imports','SELECT') then raise exception 'Import controls exposed';end if;
end $test$;
ROLLBACK;
select 'PASS: Full Admin only, atomic insertion, skip accounting, duplicates, safe retries, verified cleanup and private history; all fixtures rolled back' result;
