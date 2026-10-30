create index teacher_files_submission_idx on public.teacher_mcq_files(submission_id);
create index teacher_submissions_subject_idx on public.teacher_mcq_submissions(subject_id);
create index teacher_submissions_chapter_idx on public.teacher_mcq_submissions(chapter_id);
create index teacher_sets_subject_idx on public.teacher_review_sets(subject_id);
