set local lock_timeout='2s';
alter table public.practice_sessions
 drop constraint practice_sessions_question_ids_check,
 add constraint practice_sessions_question_ids_check check (
 cardinality(question_ids)>=1 and (chapter_id is not null or cardinality(question_ids)<=60)),
 drop constraint practice_sessions_current_index_check,
 add constraint practice_sessions_current_index_check check (
 current_index>=0 and current_index<cardinality(question_ids));
