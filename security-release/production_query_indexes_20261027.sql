set local lock_timeout='2s'; set local statement_timeout='20s';
create index if not exists qa_answers_attempt_lookup_idx on public.quiz_attempt_answers(attempt_id);
create index if not exists practice_sessions_subject_lookup_idx on public.practice_sessions(subject_id);
create index if not exists practice_sessions_chapter_lookup_idx on public.practice_sessions(chapter_id);
create index if not exists practice_usage_subject_lookup_idx on public.practice_question_usage(subject_id);
create index if not exists mock_papers_subject_lookup_idx on public.mock_papers(subject_id);
create index if not exists mock_sessions_subject_lookup_idx on public.mock_exam_sessions(subject_id);
create index if not exists student_profiles_class_lookup_idx on public.student_profiles(class_id);
