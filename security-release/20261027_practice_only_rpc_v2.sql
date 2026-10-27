-- Applied to production 2026-10-27. Keep the legacy v1 available until all old clients have refreshed.
CREATE OR REPLACE FUNCTION public.cbse_subject_practice_questions_v2(p_subject_id bigint)
 RETURNS TABLE(id bigint, chapter_id bigint, question_text text, option_a text, option_b text, option_c text, option_d text, correct_option text, explanation text, difficulty text, marks numeric, question_type text, is_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_student uuid := auth.uid();
BEGIN
 IF v_student IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (
   SELECT 1 FROM public.subjects sub JOIN public.student_profiles sp ON sp.class_id=sub.class_id
   WHERE sub.id=p_subject_id AND sp.id=v_student AND sub.is_active
 ) THEN RAISE EXCEPTION 'Subject not available for enrolled class' USING ERRCODE='42501'; END IF;
 IF NOT public.cbse_is_paid_for_subject_v1(v_student) THEN RETURN; END IF;
 RETURN QUERY
 SELECT q.id,q.chapter_id,public.cbse_media_text_v1(q.question_text,q.question_media,'question'),public.cbse_media_text_v1(q.option_a,q.question_media,'A'),public.cbse_media_text_v1(q.option_b,q.question_media,'B'),public.cbse_media_text_v1(q.option_c,q.question_media,'C'),public.cbse_media_text_v1(q.option_d,q.question_media,'D'),
   ''::text,NULL::text,q.difficulty::text,q.marks::numeric,q.question_type::text,(c.is_active AND q.is_active)
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
 WHERE c.subject_id=p_subject_id AND q.question_usage IN ('PRACTICE','SHARED') AND q.question_type='MCQ'
 AND ((c.is_active AND q.is_active) OR EXISTS (
 SELECT 1 FROM public.mock_papers assigned
 WHERE assigned.student_id=v_student AND assigned.subject_id=p_subject_id
 AND assigned.status='STARTED' AND q.id=ANY(assigned.question_ids)
 ))
 ORDER BY q.id;
END;
$function$
;
REVOKE ALL ON FUNCTION public.cbse_subject_practice_questions_v2(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cbse_subject_practice_questions_v2(bigint) TO authenticated;
