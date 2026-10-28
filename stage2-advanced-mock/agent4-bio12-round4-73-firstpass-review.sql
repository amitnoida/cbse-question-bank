-- Agent 4, Class 12 Biology only: 73 actual first-pass item decisions, no source content edits.
-- 52 statement MCQs + 21 direct numeric; 13 independently checked and suitable; 60 repetitive/basic skipped.
-- CBSE 2026-27 Biology subject 044 curriculum and Class XII NCERT chapter mapping.
-- Reviews are AI-assisted; not professional human teacher certification.
BEGIN;
CREATE TABLE cbse_import.advanced_mock_agent4_bio12_review_round4_20261028 (
 source_question_id bigint PRIMARY KEY,
 decision text NOT NULL CHECK (decision IN('ACCEPT','SKIP_BASIC','SKIP_REPETITIVE')),
 checked_answer text CHECK (checked_answer IN ('A','B','C','D')),
 evidence_note text NOT NULL,
 reviewer_type text NOT NULL DEFAULT 'AI_ASSISTED_FIRST_PASS',
 human_certified boolean NOT NULL DEFAULT false CHECK (human_certified=false),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT accepted_requires_checked_answer CHECK((decision='ACCEPT')=(checked_answer IS NOT NULL))
);
ALTER TABLE cbse_import.advanced_mock_agent4_bio12_review_round4_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.advanced_mock_agent4_bio12_review_round4_20261028 FROM PUBLIC,anon,authenticated;
DO $$
DECLARE v_rows integer;v_pass integer;v_chapters integer;
BEGIN
 WITH v AS (SELECT * FROM (VALUES
(31188::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31163::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31209::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(31213::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30843::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30848::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30864::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30871::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30742::bigint,'ACCEPT'::text,'C'::text,'Downstream purification, anode DNA migration and bacterial competence hold; Agrobacterium vectors transfer genetic material, not only proteins.'::text),
(30709::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30800::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30775::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(31047::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31078::bigint,'ACCEPT'::text,'B'::text,'Trophic position, aqueous leaching and dead-organic detritus true; fragmentation is not conversion of nitrogen into gas by nitrifiers.'::text),
(31119::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(31101::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30397::bigint,'ACCEPT'::text,'D'::text,'Reproductive isolation drives divergence and homologous forelimbs show ancestry; genetic drift need not increase fitness and analogous organs imply convergence.'::text),
(30415::bigint,'ACCEPT'::text,'C'::text,'Homologous structures indicate ancestry; two-allele equilibrium p+q=1 and heterozygotes 2pq; forelimbs not only convergent.'::text),
(30478::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30466::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30515::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30500::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30545::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30575::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(29949::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29943::bigint,'ACCEPT'::text,'A'::text,'Colostrum transfers antibodies, fertilisation near ampullary-isthmic junction and prolactin supports lactation; spermatocyte produces four spermatids.'::text),
(29981::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30001::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30632::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30617::bigint,'ACCEPT'::text,'C'::text,'Aeration supports microbial sewage oxidation and lactic-acid bacteria make curd; statins inhibit, rather than stimulate, cholesterol synthesis; Acetobacter forms acetic acid.'::text),
(30668::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30672::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30289::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30299::bigint,'ACCEPT'::text,'B'::text,'DNA strands antiparallel, reverse transcriptase makes DNA from RNA and A=T in duplex; semiconservative replication gives each daughter one old strand.'::text),
(30372::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30362::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30925::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30946::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30986::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30997::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30141::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30157::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30222::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30105::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30014::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30017::bigint,'ACCEPT'::text,'D'::text,'Copper IUD, IVF and temporary lactational amenorrhoea statements true; untreated gonorrhoea/chlamydia may damage reproductive ducts.'::text),
(30082::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30072::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(29840::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29836::bigint,'ACCEPT'::text,'B'::text,'Integuments form seed coat and apomixis forms seed without fertilisation; ovule produces seed, microspore mother cells undergo meiosis.'::text),
(29885::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(29872::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30789::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30756::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30773::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31069::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31088::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31086::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30457::bigint,'ACCEPT'::text,'D'::text,'Hardy-Weinberg q=0.3, p=0.7; expected heterozygote fraction 2pq=0.42; 4000*0.42=1680.'::text),
(30451::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30446::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29953::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29919::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29946::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30275::bigint,'ACCEPT'::text,'C'::text,'400 base pairs with GC fraction 0.4 have 160 GC x3 plus 240 AT x2 hydrogen bonds, total 960.'::text),
(30340::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30374::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30972::bigint,'ACCEPT'::text,'D'::text,'Population accounting 200+40 births+30 immigrants-15 deaths-15 emigrants =240.'::text),
(31007::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30976::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30224::bigint,'ACCEPT'::text,'D'::text,'Independent dominant phenotype probability from AaBb selfing (3/4)*(3/4)=9/16; in 800 offspring expected 450.'::text),
(30251::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30191::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text)
) AS v(id,status,expected,note))
 SELECT COUNT(*),COUNT(*) FILTER(WHERE v.status='ACCEPT'),COUNT(DISTINCT c.destination_chapter_id)
 INTO v_rows,v_pass,v_chapters
 FROM v JOIN public.questions q ON q.id=v.id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=v.id
 WHERE c.destination_subject_id=20
 AND NOT c.release_approved AND NOT q.is_active
 AND c.source_content_review_status<>'HOLD'
 AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
 AND c.source_media_ready AND q.media_ready
 AND COALESCE(q.question_media,'{}'::jsonb)='{}'::jsonb
 AND (v.expected IS NULL OR v.expected=q.correct_option::text)
 AND q.question_text !~* '\m(jee|neet|iit)\M';
 IF v_rows<>73 OR v_pass<>13 OR v_chapters<>13 THEN
 RAISE EXCEPTION 'Round 4 review source mismatch: rows %, passes %, chapters %',v_rows,v_pass,v_chapters;
 END IF;
 INSERT INTO cbse_import.advanced_mock_agent4_bio12_review_round4_20261028(source_question_id,decision,checked_answer,evidence_note)
 SELECT id,status,expected,note FROM (VALUES
(31188::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31163::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31209::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(31213::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30843::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30848::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30864::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30871::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30742::bigint,'ACCEPT'::text,'C'::text,'Downstream purification, anode DNA migration and bacterial competence hold; Agrobacterium vectors transfer genetic material, not only proteins.'::text),
(30709::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30800::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30775::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(31047::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31078::bigint,'ACCEPT'::text,'B'::text,'Trophic position, aqueous leaching and dead-organic detritus true; fragmentation is not conversion of nitrogen into gas by nitrifiers.'::text),
(31119::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(31101::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30397::bigint,'ACCEPT'::text,'D'::text,'Reproductive isolation drives divergence and homologous forelimbs show ancestry; genetic drift need not increase fitness and analogous organs imply convergence.'::text),
(30415::bigint,'ACCEPT'::text,'C'::text,'Homologous structures indicate ancestry; two-allele equilibrium p+q=1 and heterozygotes 2pq; forelimbs not only convergent.'::text),
(30478::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30466::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30515::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30500::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30545::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30575::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(29949::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29943::bigint,'ACCEPT'::text,'A'::text,'Colostrum transfers antibodies, fertilisation near ampullary-isthmic junction and prolactin supports lactation; spermatocyte produces four spermatids.'::text),
(29981::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30001::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30632::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30617::bigint,'ACCEPT'::text,'C'::text,'Aeration supports microbial sewage oxidation and lactic-acid bacteria make curd; statins inhibit, rather than stimulate, cholesterol synthesis; Acetobacter forms acetic acid.'::text),
(30668::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30672::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30289::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30299::bigint,'ACCEPT'::text,'B'::text,'DNA strands antiparallel, reverse transcriptase makes DNA from RNA and A=T in duplex; semiconservative replication gives each daughter one old strand.'::text),
(30372::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30362::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30925::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30946::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30986::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30997::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30141::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30157::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30222::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30105::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30014::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30017::bigint,'ACCEPT'::text,'D'::text,'Copper IUD, IVF and temporary lactational amenorrhoea statements true; untreated gonorrhoea/chlamydia may damage reproductive ducts.'::text),
(30082::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30072::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(29840::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29836::bigint,'ACCEPT'::text,'B'::text,'Integuments form seed coat and apomixis forms seed without fertilisation; ovule produces seed, microspore mother cells undergo meiosis.'::text),
(29885::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(29872::bigint,'SKIP_BASIC'::text,NULL::text,'Two-statement fact recall gives limited advanced-level discrimination; skipped without content changes.'::text),
(30789::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30756::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30773::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31069::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31088::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(31086::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30457::bigint,'ACCEPT'::text,'D'::text,'Hardy-Weinberg q=0.3, p=0.7; expected heterozygote fraction 2pq=0.42; 4000*0.42=1680.'::text),
(30451::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30446::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29953::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29919::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(29946::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30275::bigint,'ACCEPT'::text,'C'::text,'400 base pairs with GC fraction 0.4 have 160 GC x3 plus 240 AT x2 hydrogen bonds, total 960.'::text),
(30340::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30374::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30972::bigint,'ACCEPT'::text,'D'::text,'Population accounting 200+40 births+30 immigrants-15 deaths-15 emigrants =240.'::text),
(31007::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30976::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30224::bigint,'ACCEPT'::text,'D'::text,'Independent dominant phenotype probability from AaBb selfing (3/4)*(3/4)=9/16; in 800 offspring expected 450.'::text),
(30251::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text),
(30191::bigint,'SKIP_REPETITIVE'::text,NULL::text,'Same source facts or parameter-only calculation pattern already occurs in this Biology pool; skipped rather than replicate in Advanced Mock.'::text)
) AS v(id,status,expected,note);
 IF (SELECT COUNT(*) FROM cbse_import.advanced_mock_agent4_bio12_review_round4_20261028)<>73
 THEN RAISE EXCEPTION 'Missing review rows'; END IF;
END $$;
COMMIT;