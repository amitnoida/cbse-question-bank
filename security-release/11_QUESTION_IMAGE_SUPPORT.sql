-- Additive image support. Existing question text, answers and access rules are preserved.
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS question_media jsonb NOT NULL DEFAULT '{}'::jsonb;
COMMENT ON COLUMN public.questions.question_media IS 'Optional images: question, explanation and A/B/C/D; each object has src and alt. Trusted local /question-images/ or project public question-images bucket only.';
CREATE OR REPLACE FUNCTION public.cbse_media_text_v1(p_text text, p_media jsonb, p_slot text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $media$
 SELECT coalesce(p_text,'') || CASE
 WHEN jsonb_typeof(p_media->p_slot)='object'
 AND ((p_media->p_slot->>'src') ~ '^/question-images/[A-Za-z0-9/_.-]+[.](png|jpg|jpeg|webp|svg)$'
 OR (p_media->p_slot->>'src') ~ '^https://darfsuqfmmunxqiyqlvn[.]supabase[.]co/storage/v1/object/public/question-images/[A-Za-z0-9/_.-]+[.](png|jpg|jpeg|webp|svg)$')
 THEN E'\n![' || regexp_replace(left(coalesce(p_media->p_slot->>'alt','Question diagram'),500),'[\[\]\r\n]',' ','g') || '](' || (p_media->p_slot->>'src') || ')'
 ELSE '' END;
$media$;
ALTER TABLE public.questions ADD CONSTRAINT questions_media_object CHECK (jsonb_typeof(question_media)='object' AND octet_length(question_media::text)<=12000);

CREATE OR REPLACE FUNCTION public.cbse_question_feedback_v1(p_ids bigint[])
 RETURNS TABLE(id bigint, correct_option text, explanation text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_student uuid := auth.uid();
BEGIN
 IF v_student IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF coalesce(cardinality(p_ids),0)>60 THEN RAISE EXCEPTION 'Too many questions'; END IF;
 RETURN QUERY SELECT q.id,q.correct_option::text,public.cbse_media_text_v1(q.explanation,q.question_media,'explanation')::text
 FROM public.questions q WHERE q.id=ANY(p_ids) AND (
   EXISTS (SELECT 1 FROM public.practice_sessions ps
     WHERE ps.student_id=v_student AND (ps.status='IN_PROGRESS' OR ps.updated_at>=now()-interval '14 days') AND ps.question_ids @> ARRAY[q.id]::bigint[]
       AND ps.answers ? q.id::text AND ps.answers->q.id::text <> 'null'::jsonb)
   OR EXISTS (SELECT 1 FROM public.quiz_attempt_answers a
     JOIN public.quiz_attempts t ON t.id=a.attempt_id
     WHERE t.student_id=v_student AND coalesce(t.submitted_at,t.created_at)>=now()-interval '14 days' AND t.status IN ('Submitted','Reviewed','COMPLETED')
       AND a.question_id=q.id)
 );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cbse_subject_questions_v1(p_subject_id bigint)
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
   ''::text,NULL::text,q.difficulty::text,q.marks::numeric,q.question_type::text,q.is_active
 FROM public.questions q JOIN public.chapters c ON c.id=q.chapter_id
 WHERE c.subject_id=p_subject_id AND c.is_active AND q.is_active AND q.question_type='MCQ'
 ORDER BY q.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cbse_practice_session_questions_v1(p_session_id uuid)
 RETURNS TABLE(id bigint, chapter_id bigint, question_text text, option_a text, option_b text, option_c text, option_d text, correct_option text, explanation text, difficulty text, marks numeric, question_type text, is_active boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE ps public.practice_sessions%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 SELECT * INTO ps FROM public.practice_sessions session_row
 WHERE session_row.id=p_session_id AND session_row.student_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'Practice session unavailable' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT q.id,q.chapter_id,public.cbse_media_text_v1(q.question_text,q.question_media,'question'),public.cbse_media_text_v1(q.option_a,q.question_media,'A'),public.cbse_media_text_v1(q.option_b,q.question_media,'B'),public.cbse_media_text_v1(q.option_c,q.question_media,'C'),public.cbse_media_text_v1(q.option_d,q.question_media,'D'),
  ''::text,NULL::text,q.difficulty::text,q.marks::numeric,q.question_type::text,q.is_active
 FROM unnest(ps.question_ids) WITH ORDINALITY assigned(question_id,ord)
 JOIN public.questions q ON q.id=assigned.question_id ORDER BY assigned.ord;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cbse_legacy_mock_review_v1(p_attempt_id bigint)
 RETURNS TABLE(question_id bigint, question_text text, option_a text, option_b text, option_c text, option_d text, correct_answer text, selected_answer text, is_correct boolean, marks_obtained numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_ids bigint[];
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.quiz_attempts t
    WHERE t.id=p_attempt_id AND t.student_id=auth.uid()
    AND upper(coalesce(t.quiz_type,''))='MOCK'
    AND coalesce(t.submitted_at,t.created_at)>=now()-interval '14 days'
    AND t.status IN ('COMPLETED','Submitted','Reviewed')) THEN
   RAISE EXCEPTION 'Completed mock attempt unavailable' USING ERRCODE='42501'; END IF;
 SELECT p.question_ids INTO v_ids FROM public.mock_papers p
 WHERE p.student_id=auth.uid() AND p.status='COMPLETED'
   AND p.quiz_attempt_id=p_attempt_id::text LIMIT 1;
 IF v_ids IS NULL THEN
   SELECT p.question_ids INTO v_ids FROM public.chapter_mock_papers p
   WHERE p.student_id=auth.uid() AND p.status='COMPLETED'
     AND p.quiz_attempt_id=p_attempt_id::text LIMIT 1;
 END IF;
 IF v_ids IS NULL OR cardinality(v_ids)>100 THEN RETURN; END IF;
 RETURN QUERY
 SELECT q.id,public.cbse_media_text_v1(q.question_text,q.question_media,'question'),public.cbse_media_text_v1(q.option_a,q.question_media,'A'),public.cbse_media_text_v1(q.option_b,q.question_media,'B'),public.cbse_media_text_v1(q.option_c,q.question_media,'C'),public.cbse_media_text_v1(q.option_d,q.question_media,'D'),
   trim(upper(q.correct_option))::text,
   ma.selected_answer::text,
   (ma.selected_answer IS NOT NULL AND ma.selected_answer=trim(upper(q.correct_option)))::boolean,
   CASE WHEN ma.selected_answer=trim(upper(q.correct_option)) THEN q.marks ELSE 0::numeric END
 FROM unnest(v_ids) WITH ORDINALITY v(qid,ord)
 JOIN public.questions q ON q.id=v.qid
 LEFT JOIN public.mock_exam_sessions ms ON ms.quiz_attempt_id=p_attempt_id
   AND ms.student_id=auth.uid() AND ms.status='COMPLETED'
 LEFT JOIN public.mock_exam_answers ma ON ma.session_id=ms.id AND ma.question_id=q.id
 ORDER BY v.ord;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cbse_history_questions_v1(p_ids bigint[])
 RETURNS TABLE(id bigint, question_text text, option_a text, option_b text, option_c text, option_d text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_student uuid := auth.uid();
BEGIN

 IF NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
 IF v_student IS NULL THEN RAISE EXCEPTION 'Login required' USING ERRCODE='42501'; END IF;
 IF coalesce(cardinality(p_ids),0)>100 THEN RAISE EXCEPTION 'Too many questions'; END IF;
 RETURN QUERY SELECT q.id,public.cbse_media_text_v1(q.question_text,q.question_media,'question'),public.cbse_media_text_v1(q.option_a,q.question_media,'A'),public.cbse_media_text_v1(q.option_b,q.question_media,'B'),public.cbse_media_text_v1(q.option_c,q.question_media,'C'),public.cbse_media_text_v1(q.option_d,q.question_media,'D')
 FROM public.questions q WHERE q.id=ANY(p_ids)
 AND EXISTS (SELECT 1 FROM public.quiz_attempt_answers a
 JOIN public.quiz_attempts t ON t.id=a.attempt_id
 WHERE t.student_id=v_student AND coalesce(t.submitted_at,t.created_at)>=now()-interval '14 days' AND a.question_id=q.id);
END;
$function$
;
