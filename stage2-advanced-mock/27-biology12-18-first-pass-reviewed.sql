-- User-approved CBSE Advanced release pipeline; record 18 AI-assisted worked checks for Class XII Biology.
-- 42 previously reviewed + 18 newly checked = 60 potential release candidates; none auto-activated here.
-- Reference: CBSE Biology Curriculum 2026-27 (044), NCERT Biology Class XII.
BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_biology12_substantive_review_round3_20261028 (
 source_question_id bigint PRIMARY KEY,
 expected_answer text NOT NULL CHECK(expected_answer IN('A','B','C','D')),
 evidence_note text NOT NULL,
 review_type text NOT NULL DEFAULT 'AI_ASSISTED_FIRST_PASS' CHECK(review_type='AI_ASSISTED_FIRST_PASS'),
 suitability text NOT NULL DEFAULT 'ADVANCED_FIT' CHECK(suitability='ADVANCED_FIT'),
 expert_certified boolean NOT NULL DEFAULT false CHECK(expert_certified=false),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.advanced_mock_biology12_substantive_review_round3_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.advanced_mock_biology12_substantive_review_round3_20261028 FROM PUBLIC,anon,authenticated;
DO $$
DECLARE n integer;chap integer;
BEGIN
 SELECT COUNT(*),COUNT(DISTINCT a.destination_chapter_id) INTO n,chap
 FROM (VALUES
(31179::bigint,'A'::text,'Invasive species threaten local biota and sacred groves preserve natural habitat; ex situ and elimination of pollination claims are false.'::text),
(30820::bigint,'B'::text,'Biopatents protect biological inventions and gene therapy addresses genetic defects; transgenic animals do carry added material; biopiracy is exploitation.'::text),
(30732::bigint,'A'::text,'Competent bacteria can acquire DNA, ligase seals DNA backbone; unlabelled gels are not white-light visible and bioreactors control conditions.'::text),
(31054::bigint,'A'::text,'Aquatic standing biomass pyramids can invert; NPP=GPP-R; trophic positions vary in food webs, which interconnect feeding chains.'::text),
(30429::bigint,'A'::text,'Stabilising selection favours intermediates; analogy may show convergence; heterozygote frequency 2pq; mutations are not selected purposively.'::text),
(30425::bigint,'B'::text,'Founder effect small sample; antibiotics select pre-existing resistant variants; directional selection shifts favored phenotype rather than stabilizing mean.'::text),
(30529::bigint,'D'::text,'Plasmodium causes malaria; maternal antibodies passive; allergy often IgE/histamine; vaccination develops recipient immunity.'::text),
(29915::bigint,'C'::text,'Inner mass and trophoblast functions are not reversed; oxytocin promotes uterine contractions; spermiogenesis and prolactin claims correct.'::text),
(29922::bigint,'B'::text,'One primary spermatocyte forms four spermatids via meiosis; cleavage partitions zygote; oxytocin and telophase-II claims are wrong.'::text),
(30633::bigint,'A'::text,'Aeration supports secondary sewage microbes; streptokinase dissolves clots; Aspergillus niger makes citric acid; Bt biological control.'::text),
(30637::bigint,'A'::text,'Aeration promotes oxidation and activated sludge holds settled microbial flocs; mycorrhiza helps P acquisition; Acetobacter makes acetic acid.'::text),
(30308::bigint,'C'::text,'Coding strand matches mRNA except T/U; allolactose releases lac repressor; DNA semiconservative; code degeneracy involves multiple codons.'::text),
(30274::bigint,'A'::text,'DNA phosphodiester bonds and tRNA anticodon pairing correct; introns removed; double-stranded DNA has A=T and G=C.'::text),
(30918::bigint,'A'::text,'Competition may harm both; immigration adds individuals; logistic absolute growth maximal K/2; exponential ideal growth unbounded.'::text),
(30149::bigint,'A'::text,'Incomplete dominance can show 1:2:1 phenotypes, PKU autosomal recessive, ABO i recessive, Aa times aa ratio 1:1.'::text),
(30145::bigint,'D'::text,'Recessive carriers transmit alleles, Klinefelter generally 47XXY, AaBb four gametes if unlinked, Aa times Aa genotype ratio 1:2:1.'::text),
(30013::bigint,'C'::text,'Pregnancy termination differs from contraception; pills hormonal, condoms physical barriers; reproductive health includes mental and social wellbeing.'::text),
(29846::bigint,'C'::text,'Emasculation removes anthers; ovule becomes seed and ovary fruit; synergids hold filiform apparatus; embryo sac 7 cells 8 nuclei.'::text)
) AS v(id,answer,note)
 JOIN public.questions q ON q.id=v.id AND q.correct_option=v.answer
 JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=v.id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=v.id
 WHERE a.destination_subject_id=20 AND a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN'
 AND NOT q.is_active AND NOT c.release_approved
 AND NOT EXISTS(SELECT 1 FROM cbse_import.advanced_mock_biology12_substantive_review_20261028 prior WHERE prior.source_question_id=v.id)
 AND NOT EXISTS(SELECT 1 FROM cbse_import.advanced_mock_biology12_substantive_review_round2_20261028 prior WHERE prior.source_question_id=v.id);
 IF n<>18 OR chap<12 THEN
  RAISE EXCEPTION 'Wrong 18-question review size/coverage: % / %',n,chap;
 END IF;
 INSERT INTO cbse_import.advanced_mock_biology12_substantive_review_round3_20261028
 (source_question_id,expected_answer,evidence_note)
 SELECT id,answer,note FROM (VALUES
(31179::bigint,'A'::text,'Invasive species threaten local biota and sacred groves preserve natural habitat; ex situ and elimination of pollination claims are false.'::text),
(30820::bigint,'B'::text,'Biopatents protect biological inventions and gene therapy addresses genetic defects; transgenic animals do carry added material; biopiracy is exploitation.'::text),
(30732::bigint,'A'::text,'Competent bacteria can acquire DNA, ligase seals DNA backbone; unlabelled gels are not white-light visible and bioreactors control conditions.'::text),
(31054::bigint,'A'::text,'Aquatic standing biomass pyramids can invert; NPP=GPP-R; trophic positions vary in food webs, which interconnect feeding chains.'::text),
(30429::bigint,'A'::text,'Stabilising selection favours intermediates; analogy may show convergence; heterozygote frequency 2pq; mutations are not selected purposively.'::text),
(30425::bigint,'B'::text,'Founder effect small sample; antibiotics select pre-existing resistant variants; directional selection shifts favored phenotype rather than stabilizing mean.'::text),
(30529::bigint,'D'::text,'Plasmodium causes malaria; maternal antibodies passive; allergy often IgE/histamine; vaccination develops recipient immunity.'::text),
(29915::bigint,'C'::text,'Inner mass and trophoblast functions are not reversed; oxytocin promotes uterine contractions; spermiogenesis and prolactin claims correct.'::text),
(29922::bigint,'B'::text,'One primary spermatocyte forms four spermatids via meiosis; cleavage partitions zygote; oxytocin and telophase-II claims are wrong.'::text),
(30633::bigint,'A'::text,'Aeration supports secondary sewage microbes; streptokinase dissolves clots; Aspergillus niger makes citric acid; Bt biological control.'::text),
(30637::bigint,'A'::text,'Aeration promotes oxidation and activated sludge holds settled microbial flocs; mycorrhiza helps P acquisition; Acetobacter makes acetic acid.'::text),
(30308::bigint,'C'::text,'Coding strand matches mRNA except T/U; allolactose releases lac repressor; DNA semiconservative; code degeneracy involves multiple codons.'::text),
(30274::bigint,'A'::text,'DNA phosphodiester bonds and tRNA anticodon pairing correct; introns removed; double-stranded DNA has A=T and G=C.'::text),
(30918::bigint,'A'::text,'Competition may harm both; immigration adds individuals; logistic absolute growth maximal K/2; exponential ideal growth unbounded.'::text),
(30149::bigint,'A'::text,'Incomplete dominance can show 1:2:1 phenotypes, PKU autosomal recessive, ABO i recessive, Aa times aa ratio 1:1.'::text),
(30145::bigint,'D'::text,'Recessive carriers transmit alleles, Klinefelter generally 47XXY, AaBb four gametes if unlinked, Aa times Aa genotype ratio 1:2:1.'::text),
(30013::bigint,'C'::text,'Pregnancy termination differs from contraception; pills hormonal, condoms physical barriers; reproductive health includes mental and social wellbeing.'::text),
(29846::bigint,'C'::text,'Emasculation removes anthers; ovule becomes seed and ovary fruit; synergids hold filiform apparatus; embryo sac 7 cells 8 nuclei.'::text)
) AS v(id,answer,note);
 IF (SELECT COUNT(*) FROM cbse_import.advanced_mock_biology12_substantive_review_round3_20261028)<>18
 THEN RAISE EXCEPTION '18 evidence rows missing'; END IF;
END $$;
COMMIT;