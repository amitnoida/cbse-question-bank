-- Class XII Biology: 52 explicit AI-assisted content + difficulty review records.
-- Independent answer assessment uses question, options, explanation, subject reasoning and
-- CBSE 2026-27 Biology / NCERT Biology XII as reference. NOT human teacher certification.
-- No source or released question updates. Retain the user's final release decision.
BEGIN;
CREATE TABLE IF NOT EXISTS cbse_import.advanced_mock_biology12_substantive_review_20261028 (
 source_question_id bigint PRIMARY KEY,
 expected_answer text NOT NULL CHECK(expected_answer IN('A','B','C','D')),
 content_assessment text NOT NULL CHECK(content_assessment IN('ADVANCED_FIT','TOO_BASIC','AMBIGUOUS')),
 reviewer_type text NOT NULL DEFAULT 'AI_ASSISTED_ITEM_CHECK' CHECK(reviewer_type='AI_ASSISTED_ITEM_CHECK'),
 evidence_note text NOT NULL,
 syllabus_reference text NOT NULL DEFAULT 'CBSE Biology XI-XII 2026-27; NCERT Biology Class XII 2026-27',
 human_expert_certified boolean NOT NULL DEFAULT false CHECK(human_expert_certified=false),
 release_approved boolean NOT NULL DEFAULT false CHECK(release_approved=false),
 reviewed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cbse_import.advanced_mock_biology12_substantive_review_20261028 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON cbse_import.advanced_mock_biology12_substantive_review_20261028 FROM PUBLIC,anon,authenticated;
DO $$
DECLARE matched integer;chap integer;inserted integer;
BEGIN
 SELECT count(*),count(DISTINCT a.destination_chapter_id) INTO matched,chap
 FROM (VALUES
(31220,'A','ADVANCED_FIT','species-area slope Z'),
(31201,'D','TOO_BASIC','ex-situ versus hotspot definitions'),
(31202,'C','TOO_BASIC','species versus ecosystem diversity'),
(31227,'B','ADVANCED_FIT','seed banking ex-situ, hotspots endangered high-endemism'),
(30861,'A','TOO_BASIC','RNA interference silencing, insulin recombinant cells'),
(30875,'C','ADVANCED_FIT','insulin C peptide cleaved, A and B chains remain'),
(30860,'C','TOO_BASIC','RNAi versus provitamin-A golden rice'),
(30859,'B','TOO_BASIC','Bt cotton proteins and therapeutic genetic modification'),
(30802,'A','ADVANCED_FIT','ideal PCR 2^5 equals 32 copies'),
(30805,'A','TOO_BASIC','DNA ori and downstream purification'),
(30809,'A','TOO_BASIC','restriction endonuclease cleavage'),
(30769,'C','TOO_BASIC','restriction nuclease cleavage and ligase joining'),
(31158,'A','TOO_BASIC','GPP definition'),
(31040,'B','ADVANCED_FIT','NPP 1500 minus 600 is 900; 15% is 135'),
(31144,'A','TOO_BASIC','GPP and upright pyramid'),
(31145,'D','TOO_BASIC','NPP and trophic food chain'),
(30488,'D','TOO_BASIC','Hardy Weinberg allele frequency equilibrium'),
(30438,'C','TOO_BASIC','selection and fossil definitions'),
(30437,'B','TOO_BASIC','selection and HWE definitions'),
(30436,'D','TOO_BASIC','analogous structures and fossil evidence'),
(30541,'D','TOO_BASIC','T cell and B cell functions'),
(30543,'A','TOO_BASIC','immune memory and allergic response'),
(30586,'A','TOO_BASIC','Anopheles transmits malaria'),
(30540,'C','TOO_BASIC','B cell plasma-cell lineage; metastasis'),
(29998,'A','TOO_BASIC','oogenesis and secondary-oocyte ovulation'),
(29997,'C','TOO_BASIC','trophoblast hCG supports corpus luteum'),
(29966,'B','TOO_BASIC','LH surge directly triggers ovulation'),
(30009,'A','TOO_BASIC','early embryonic hCG supports corpus luteum'),
(30641,'D','TOO_BASIC','Penicillium and biochemical oxygen demand'),
(30642,'C','TOO_BASIC','Penicillium and biological pest control'),
(30643,'B','TOO_BASIC','Rhizobium symbiotic nitrogen fixation and BOD'),
(30698,'B','TOO_BASIC','Saccharomyces cerevisiae yeast in bread and fermentation'),
(30366,'B','ADVANCED_FIT','allolactose inactivates lac repressor, low glucose favors CAP'),
(30317,'B','TOO_BASIC','DNA helicase and AUG initiation'),
(30328,'A','ADVANCED_FIT','semiconservative 2/2048 times 100 is .097656%'),
(30377,'D','ADVANCED_FIT','internal UAG stop codon terminates early'),
(31023,'B','TOO_BASIC','natality and mortality rates'),
(30970,'A','TOO_BASIC','commensalism and logistic approach to K'),
(31024,'C','TOO_BASIC','predation and mortality definitions'),
(30979,'B','ADVANCED_FIT','mutualism benefits both, logistic growth zero at N=K'),
(30250,'D','ADVANCED_FIT','Tt crossed tt yields half tall, half dwarf'),
(30208,'B','ADVANCED_FIT','affected X father and normal XX mother yields carrier daughters'),
(30248,'D','TOO_BASIC','unlinked independent assortment versus linkage'),
(30188,'C','ADVANCED_FIT','PKU autosomal recessive and Down syndrome trisomy 21'),
(30089,'A','ADVANCED_FIT','copper IUD sperm impairment/phagocytosis'),
(30055,'A','ADVANCED_FIT','ZIFT transfers <=8-cell early embryo to fallopian tube'),
(30100,'D','AMBIGUOUS','population stabilisation is an outcome rather than the unique definition of provided services'),
(30092,'C','TOO_BASIC','amniocentesis prenatal sampling and ICSI sperm injection'),
(29898,'B','TOO_BASIC','tapetum and microsporogenesis'),
(29894,'C','TOO_BASIC','seven-cell eight-nuclei embryo sac and apomixis'),
(29897,'D','TOO_BASIC','pollen transfer and embryo sac definitions'),
(29855,'B','ADVANCED_FIT','syngamy diploid zygote and triple-fusion triploid endosperm')
 ) AS v(id,answer,assessment,evidence)
 JOIN public.questions q ON q.id=v.id AND q.correct_option=v.answer
 JOIN cbse_import.advanced_mock_bulk_academic_audit_20261028 a ON a.source_question_id=v.id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=v.id
 WHERE a.destination_subject_id=20 AND a.automated_qc_status='PASS_PRELIMINARY_AUTOMATED_SCREEN'
 AND c.release_approved=false AND q.is_active=false;
 IF matched<>52 OR chap<>13 THEN RAISE EXCEPTION 'Expected 52 verified-source IDs over 13 chapters; got %/%',matched,chap; END IF;
 INSERT INTO cbse_import.advanced_mock_biology12_substantive_review_20261028
 (source_question_id,expected_answer,content_assessment,evidence_note)
 SELECT id,answer,assessment,evidence FROM (VALUES
(31220,'A','ADVANCED_FIT','species-area slope Z'),
(31201,'D','TOO_BASIC','ex-situ versus hotspot definitions'),
(31202,'C','TOO_BASIC','species versus ecosystem diversity'),
(31227,'B','ADVANCED_FIT','seed banking ex-situ, hotspots endangered high-endemism'),
(30861,'A','TOO_BASIC','RNA interference silencing, insulin recombinant cells'),
(30875,'C','ADVANCED_FIT','insulin C peptide cleaved, A and B chains remain'),
(30860,'C','TOO_BASIC','RNAi versus provitamin-A golden rice'),
(30859,'B','TOO_BASIC','Bt cotton proteins and therapeutic genetic modification'),
(30802,'A','ADVANCED_FIT','ideal PCR 2^5 equals 32 copies'),
(30805,'A','TOO_BASIC','DNA ori and downstream purification'),
(30809,'A','TOO_BASIC','restriction endonuclease cleavage'),
(30769,'C','TOO_BASIC','restriction nuclease cleavage and ligase joining'),
(31158,'A','TOO_BASIC','GPP definition'),
(31040,'B','ADVANCED_FIT','NPP 1500 minus 600 is 900; 15% is 135'),
(31144,'A','TOO_BASIC','GPP and upright pyramid'),
(31145,'D','TOO_BASIC','NPP and trophic food chain'),
(30488,'D','TOO_BASIC','Hardy Weinberg allele frequency equilibrium'),
(30438,'C','TOO_BASIC','selection and fossil definitions'),
(30437,'B','TOO_BASIC','selection and HWE definitions'),
(30436,'D','TOO_BASIC','analogous structures and fossil evidence'),
(30541,'D','TOO_BASIC','T cell and B cell functions'),
(30543,'A','TOO_BASIC','immune memory and allergic response'),
(30586,'A','TOO_BASIC','Anopheles transmits malaria'),
(30540,'C','TOO_BASIC','B cell plasma-cell lineage; metastasis'),
(29998,'A','TOO_BASIC','oogenesis and secondary-oocyte ovulation'),
(29997,'C','TOO_BASIC','trophoblast hCG supports corpus luteum'),
(29966,'B','TOO_BASIC','LH surge directly triggers ovulation'),
(30009,'A','TOO_BASIC','early embryonic hCG supports corpus luteum'),
(30641,'D','TOO_BASIC','Penicillium and biochemical oxygen demand'),
(30642,'C','TOO_BASIC','Penicillium and biological pest control'),
(30643,'B','TOO_BASIC','Rhizobium symbiotic nitrogen fixation and BOD'),
(30698,'B','TOO_BASIC','Saccharomyces cerevisiae yeast in bread and fermentation'),
(30366,'B','ADVANCED_FIT','allolactose inactivates lac repressor, low glucose favors CAP'),
(30317,'B','TOO_BASIC','DNA helicase and AUG initiation'),
(30328,'A','ADVANCED_FIT','semiconservative 2/2048 times 100 is .097656%'),
(30377,'D','ADVANCED_FIT','internal UAG stop codon terminates early'),
(31023,'B','TOO_BASIC','natality and mortality rates'),
(30970,'A','TOO_BASIC','commensalism and logistic approach to K'),
(31024,'C','TOO_BASIC','predation and mortality definitions'),
(30979,'B','ADVANCED_FIT','mutualism benefits both, logistic growth zero at N=K'),
(30250,'D','ADVANCED_FIT','Tt crossed tt yields half tall, half dwarf'),
(30208,'B','ADVANCED_FIT','affected X father and normal XX mother yields carrier daughters'),
(30248,'D','TOO_BASIC','unlinked independent assortment versus linkage'),
(30188,'C','ADVANCED_FIT','PKU autosomal recessive and Down syndrome trisomy 21'),
(30089,'A','ADVANCED_FIT','copper IUD sperm impairment/phagocytosis'),
(30055,'A','ADVANCED_FIT','ZIFT transfers <=8-cell early embryo to fallopian tube'),
(30100,'D','AMBIGUOUS','population stabilisation is an outcome rather than the unique definition of provided services'),
(30092,'C','TOO_BASIC','amniocentesis prenatal sampling and ICSI sperm injection'),
(29898,'B','TOO_BASIC','tapetum and microsporogenesis'),
(29894,'C','TOO_BASIC','seven-cell eight-nuclei embryo sac and apomixis'),
(29897,'D','TOO_BASIC','pollen transfer and embryo sac definitions'),
(29855,'B','ADVANCED_FIT','syngamy diploid zygote and triple-fusion triploid endosperm')
 ) AS v(id,answer,assessment,evidence);
 GET DIAGNOSTICS inserted=ROW_COUNT;
 IF inserted<>52 THEN RAISE EXCEPTION 'Expected exactly 52 reviewed IDs got %',inserted; END IF;
END $$;
COMMIT;