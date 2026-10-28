-- DO NOT APPLY until all 164 recovered school assets have been deployed
-- and sampled via HTTP and a browser. Source is cbse_import.master_rows.payload[17].
-- Leaves HOLD reviews and inactive questions INACTIVE, preserving prior content in backup.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='90s';

CREATE TABLE IF NOT EXISTS cbse_import.question_media_backup_20261028 (
  question_id bigint PRIMARY KEY,
  question_text text NOT NULL,
  question_media jsonb NOT NULL,
  media_ready boolean NOT NULL,
  content_review_status text NOT NULL,
  is_active boolean NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.question_media_backup_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.question_media_backup_20261028 FROM PUBLIC, anon, authenticated;

DO $check$
DECLARE v_total integer; v_safe integer; v_class8 integer; v_class11 integer;
BEGIN
 SELECT count(*),
        count(*) FILTER (WHERE q.content_review_status='HOLD' AND q.is_active=false AND q.media_ready=false),
        count(*) FILTER (WHERE c.class_number=8 AND
                    q.question_media->'question'->>'src'=m.payload->17->0->>'path'),
        count(*) FILTER (WHERE c.class_number=11 AND
                    q.question_media='{}'::jsonb AND
                    q.question_text LIKE '%'||chr(10)||'<img src="'||(m.payload->17->0->>'path')||'" alt="%')
 INTO v_total,v_safe,v_class8,v_class11
 FROM cbse_import.master_rows m
 JOIN public.questions q ON q.id=m.question_id
 JOIN public.chapters ch ON ch.id=q.chapter_id
 JOIN public.subjects s ON s.id=ch.subject_id
 JOIN public.classes c ON c.id=s.class_id
 WHERE c.class_number IN (8,11) AND q.media_ready=false;
 IF v_total<>164 OR v_safe<>164 OR v_class8<>67 OR v_class11<>97 THEN
   RAISE EXCEPTION 'Unexpected school asset state: total %, hold %, class8 %, class11 %',
      v_total,v_safe,v_class8,v_class11;
 END IF;
END $check$;

INSERT INTO cbse_import.question_media_backup_20261028
 (question_id,question_text,question_media,media_ready,content_review_status,is_active)
SELECT q.id,q.question_text,q.question_media,q.media_ready,q.content_review_status,q.is_active
FROM cbse_import.master_rows m
JOIN public.questions q ON q.id=m.question_id
JOIN public.chapters ch ON ch.id=q.chapter_id
JOIN public.subjects s ON s.id=ch.subject_id
JOIN public.classes c ON c.id=s.class_id
WHERE c.class_number IN (8,11) AND q.media_ready=false
ON CONFLICT (question_id) DO NOTHING;

DO $patch$
DECLARE v_affected integer; v_backup integer;
BEGIN
 SELECT count(*) INTO v_backup FROM cbse_import.question_media_backup_20261028;
 IF v_backup<>164 THEN RAISE EXCEPTION 'Backup count mismatch: %',v_backup; END IF;

 WITH src AS (
   SELECT q.id,c.class_number,q.question_text,
          (m.payload->17->0->>'path') as original_path,
          CASE WHEN c.class_number=8 THEN q.question_media->'question'->>'alt'
               ELSE substring(q.question_text FROM 'alt="([^"]+)"') END AS alt_text
   FROM cbse_import.master_rows m
   JOIN public.questions q ON q.id=m.question_id
   JOIN public.chapters ch ON ch.id=q.chapter_id
   JOIN public.subjects s ON s.id=ch.subject_id
   JOIN public.classes c ON c.id=s.class_id
   WHERE c.class_number IN (8,11) AND q.media_ready=false
 )
 UPDATE public.questions q
 SET question_media=jsonb_set(q.question_media,'{question}',
      jsonb_build_object(
        'src','/question-images/imported-school-20261028/'||
            CASE WHEN src.class_number=8 THEN substring(src.original_path FROM 8)
                 ELSE regexp_replace(substring(src.original_path FROM 8),'[.]png$','.svg') END,
        'alt',left(coalesce(src.alt_text,'Question diagram'),200)),true),
     question_text=CASE WHEN src.class_number=11
          THEN split_part(src.question_text,chr(10)||'<img src=',1)
          ELSE q.question_text END,
     media_ready=true,
     updated_at=now()
 FROM src
 WHERE q.id=src.id AND q.is_active=false AND q.content_review_status='HOLD'
   AND q.media_ready=false;
 GET DIAGNOSTICS v_affected=ROW_COUNT;
 IF v_affected<>164 THEN RAISE EXCEPTION 'Expected 164 guarded updates; updated %',v_affected; END IF;
 IF (SELECT count(*) FROM public.questions q
       JOIN cbse_import.question_media_backup_20261028 b ON b.question_id=q.id
       WHERE q.media_ready=true AND q.is_active=false AND q.content_review_status='HOLD'
         AND q.question_media->'question'->>'src' ~
             '^/question-images/imported-school-20261028/[a-f0-9]{64}[.]svg$')<>164 THEN
   RAISE EXCEPTION 'Post-update image paths/status failed';
 END IF;
END $patch$;
COMMIT;
