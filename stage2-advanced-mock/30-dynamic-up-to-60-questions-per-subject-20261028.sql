-- Dynamic Advanced Mock length: 1-60 questions per test.
-- Subject pool N: N<60 -> one numbered test with N questions. N>=60 -> floor(N/60) numbered tests
-- of 60 (e.g. 200 => three), then retakes use unseen-first and recycle only as necessary.
-- Existing 60-question completed papers and answers stay unchanged.
BEGIN;
ALTER TABLE public.advanced_mock_papers DROP CONSTRAINT advanced_mock_question_count;
ALTER TABLE public.advanced_mock_papers ADD CONSTRAINT advanced_mock_question_count CHECK (cardinality(question_ids) BETWEEN 1 AND 60);
ALTER TABLE public.advanced_mock_papers DROP CONSTRAINT advanced_mock_score_bounds;
ALTER TABLE public.advanced_mock_papers ADD CONSTRAINT advanced_mock_score_bounds CHECK (
 ((correct_count IS NULL) AND (answered_count IS NULL) AND (score_percent IS NULL))
 OR (
   correct_count BETWEEN 0 AND cardinality(question_ids)
   AND answered_count BETWEEN 0 AND cardinality(question_ids)
   AND correct_count<=answered_count
   AND score_percent BETWEEN 0 AND 100
 )
);

CREATE OR REPLACE FUNCTION public.advanced_mock_overview_v1(p_subject_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_user uuid:=auth.uid(); v_subject_name text;
 v_class_name text; v_pool integer; v_numbered integer; v_retakes integer; v_started jsonb; v_recent jsonb;
BEGIN
 IF v_user IS NULL OR NOT public.is_active_student() THEN
  RAISE EXCEPTION 'Active student required' USING ERRCODE='42501';
 END IF;
 SELECT s.subject_name,c.class_name INTO v_subject_name,v_class_name
 FROM public.subjects s JOIN public.classes c ON c.id=s.class_id
 JOIN public.student_profiles sp ON sp.class_id=s.class_id AND sp.id=v_user
 WHERE s.id=p_subject_id AND s.is_active AND c.class_name IN ('Class 11','Class 12');
 IF NOT FOUND THEN RAISE EXCEPTION 'Advanced mocks are available for your enrolled Class 11 or 12 only' USING ERRCODE='42501'; END IF;
 SELECT count(*)::integer INTO v_pool
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=p_subject_id AND c.release_approved
   AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
   AND c.reviewed_at IS NOT NULL AND c.source_content_review_status <> 'HOLD'
   AND q.is_active=FALSE AND q.media_ready=TRUE;
 SELECT count(*) FILTER (WHERE paper_number IS NOT NULL)::integer,
        count(*) FILTER (WHERE retake_number IS NOT NULL)::integer
 INTO v_numbered,v_retakes FROM public.advanced_mock_papers
 WHERE student_id=v_user AND subject_id=p_subject_id;
 SELECT jsonb_build_object('id',id,'deadline_at',deadline_at,'paper_number',paper_number,
  'retake_number',retake_number) INTO v_started
 FROM public.advanced_mock_papers WHERE student_id=v_user AND subject_id=p_subject_id
 AND status='STARTED' LIMIT 1;
 SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.started_at DESC),'[]'::jsonb) INTO v_recent
 FROM (SELECT id,paper_number,retake_number,status,started_at,completed_at,
             deadline_at,correct_count,answered_count,score_percent
       FROM public.advanced_mock_papers WHERE student_id=v_user AND subject_id=p_subject_id
       ORDER BY started_at DESC LIMIT 15) t;
 RETURN jsonb_build_object('subject_id',p_subject_id,'subject_name',v_subject_name,
  'class_name',v_class_name,'released_questions',v_pool,'ready_for_60',v_pool>=60,
  'ready_for_test',v_pool>0,'test_length',LEAST(60,v_pool),
  'numbered_test_capacity',CASE WHEN v_pool=0 THEN 0 ELSE GREATEST(1,v_pool/60) END,
  'paid',public.cbse_is_paid_for_subject_v1(v_user),
  'numbered_started',v_numbered,'retakes_started',v_retakes,
  'active_paper',v_started,'history',v_recent);
END $function$
;

CREATE OR REPLACE FUNCTION public.advanced_mock_start_v1(p_subject_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_user uuid:=auth.uid(); v_existing public.advanced_mock_papers%ROWTYPE;
 v_pool integer; v_prevmax integer; v_capacity integer; v_target integer; v_retake integer; v_ids bigint[]; v_paper uuid;
BEGIN
 IF v_user IS NULL OR NOT public.is_active_student() THEN RAISE EXCEPTION 'Active student required' USING ERRCODE='42501'; END IF;
 IF NOT public.cbse_is_paid_for_subject_v1(v_user) THEN RAISE EXCEPTION 'Paid membership required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.subjects s JOIN public.classes cl ON cl.id=s.class_id
  JOIN public.student_profiles sp ON sp.class_id=cl.id AND sp.id=v_user
  WHERE s.id=p_subject_id AND s.is_active AND cl.class_name IN ('Class 11','Class 12')) THEN
  RAISE EXCEPTION 'Subject unavailable for your Class 11/12 enrollment' USING ERRCODE='42501';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':advanced:'||p_subject_id::text,0));
 SELECT * INTO v_existing FROM public.advanced_mock_papers
 WHERE student_id=v_user AND subject_id=p_subject_id AND status='STARTED'
 ORDER BY started_at DESC LIMIT 1 FOR UPDATE;
 IF FOUND THEN
   IF clock_timestamp()>=v_existing.deadline_at THEN
     PERFORM cbse_import.advanced_mock_finalize_v1(v_existing.id);
   ELSE
     RETURN jsonb_build_object('paper_id',v_existing.id,'resumed',true,
       'deadline_at',v_existing.deadline_at);
   END IF;
 END IF;
 SELECT count(*)::integer INTO v_pool
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN public.questions q ON q.id=c.source_question_id
 WHERE c.destination_subject_id=p_subject_id AND c.release_approved
   AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
   AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
   AND q.is_active=FALSE AND q.media_ready=TRUE;
 IF v_pool<1 THEN RAISE EXCEPTION 'No approved Advanced Mock questions are available for this subject yet' USING ERRCODE='22023'; END IF;
 v_target:=LEAST(60,v_pool);
 SELECT COALESCE(MAX(paper_number),0) INTO v_prevmax
 FROM public.advanced_mock_papers WHERE student_id=v_user AND subject_id=p_subject_id;
 v_capacity:=GREATEST(1,v_pool/60);
 -- Favor questions the student has not yet received, fall back to retakes.
 SELECT array_agg(id ORDER BY random()) INTO v_ids FROM (
   SELECT c.source_question_id AS id
   FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
   JOIN public.questions q ON q.id=c.source_question_id
   WHERE c.destination_subject_id=p_subject_id AND c.release_approved
      AND c.academic_verified AND c.answer_verified AND c.duplicate_cleared AND c.media_verified
      AND c.reviewed_at IS NOT NULL AND c.source_content_review_status<>'HOLD'
      AND q.is_active=FALSE AND q.media_ready=TRUE
   ORDER BY CASE WHEN EXISTS (
      SELECT 1 FROM public.advanced_mock_papers old
      WHERE old.student_id=v_user AND old.subject_id=p_subject_id
      AND c.source_question_id=ANY(old.question_ids)
   ) THEN 1 ELSE 0 END,random()
   LIMIT v_target
 ) chosen;
 IF COALESCE(cardinality(v_ids),0)<>v_target OR (SELECT count(DISTINCT x) FROM unnest(v_ids) x)<>v_target THEN
  RAISE EXCEPTION 'Advanced mock question pool incomplete' USING ERRCODE='22023';
 END IF;
 IF v_prevmax<v_capacity THEN
  INSERT INTO public.advanced_mock_papers(student_id,subject_id,paper_number,question_ids)
  VALUES(v_user,p_subject_id,v_prevmax+1,v_ids) RETURNING id INTO v_paper;
 ELSE
  SELECT COALESCE(MAX(retake_number),0)+1 INTO v_retake
  FROM public.advanced_mock_papers WHERE student_id=v_user AND subject_id=p_subject_id;
  INSERT INTO public.advanced_mock_papers(student_id,subject_id,retake_number,question_ids)
  VALUES(v_user,p_subject_id,v_retake,v_ids) RETURNING id INTO v_paper;
 END IF;
 RETURN jsonb_build_object('paper_id',v_paper,'resumed',false);
END $function$
;

CREATE OR REPLACE FUNCTION cbse_import.advanced_mock_finalize_v1(p_paper_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE p public.advanced_mock_papers%ROWTYPE; v_correct integer; v_answered integer; v_total integer;
BEGIN
 SELECT * INTO p FROM public.advanced_mock_papers WHERE id=p_paper_id FOR UPDATE;
 IF NOT FOUND OR p.student_id IS DISTINCT FROM auth.uid() OR NOT public.is_active_student() THEN
   RAISE EXCEPTION 'Advanced mock paper unavailable' USING ERRCODE='42501';
 END IF;
 v_total:=cardinality(p.question_ids);
 IF v_total IS NULL OR v_total<1 OR v_total>60 THEN RAISE EXCEPTION 'Advanced mock question count invalid' USING ERRCODE='22023'; END IF;
 IF p.status='COMPLETED' THEN
   RETURN jsonb_build_object('status','COMPLETED','correct',p.correct_count,
      'answered',p.answered_count,'total',v_total,'percent',p.score_percent,'paper_id',p.id);
 END IF;
 SELECT count(*)::integer,
        count(*) FILTER (WHERE upper(btrim(q.correct_option::text))=a.selected_answer)::integer
 INTO v_answered,v_correct
 FROM public.advanced_mock_answers a
 JOIN public.questions q ON q.id=a.question_id
 WHERE a.paper_id=p.id;
 UPDATE public.advanced_mock_papers
 SET status='COMPLETED',completed_at=clock_timestamp(),
     answered_count=v_answered,correct_count=v_correct,
     score_percent=round(v_correct::numeric*100/v_total,2)
 WHERE id=p.id;
 RETURN jsonb_build_object('status','COMPLETED','correct',v_correct,
       'answered',v_answered,'total',v_total,'percent',round(v_correct::numeric*100/v_total,2),'paper_id',p.id);
END $function$
;
COMMIT;
