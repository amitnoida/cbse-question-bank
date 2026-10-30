-- CBSE Class XII Chemistry (2026-27), 60 AI-assisted worked-answer academic checks.
-- All 10 CBSE units, exactly six distinct questions per unit. This stage updates
-- ONLY cbse_import private review status, NOT active questions or release flags.
-- Includes explicit per-ID solution/concept checks and expected answer; no blanket approval.
BEGIN;
DO $$
DECLARE v_changed integer; v_approved integer;
BEGIN
 SELECT COUNT(*) INTO v_approved
 FROM cbse_import.advanced_mock_stage2_candidates_20261028 c
 JOIN cbse_import.advanced_mock_release_review_20261028 r ON r.source_question_id=c.source_question_id
 WHERE r.destination_subject_id=21 AND c.release_approved;
 IF v_approved<>0 THEN RAISE EXCEPTION 'Pre-release ledger not closed'; END IF;
 UPDATE cbse_import.advanced_mock_release_review_20261028 r
 SET review_status='VERIFIED',verified_at=COALESCE(r.verified_at,clock_timestamp()),
 reviewer_note='AI-assisted question-by-question CBSE Class XII 2026-27 Chemistry syllabus and answer check; '
 ||v.reason||'. Four-option solution and chapter alignment reviewed; separate release required.'
 FROM (VALUES
(31846,'D','Nernst: 0.8-0.0591*(-2)=0.9182 V'),
(31988,'D','Rate multiplier 2^2*5^2=100'),
(32471,'A','HI cleaves anisole at methyl carbon; controlled primary alcohol oxidation affords aldehyde; SN2/boiling distractors false'),
(32605,'D','Primary amine carbylamine positive; Gabriel forms suitable primary alkylamine; diazonium/azo distractors false'),
(32152,'D','Cr has [Ar]3d5 4s1; unpaired spins paramagnetic; copper configuration and fixed oxidation state assertions false'),
(31652,'D','Freezing depression iKfm=3*1.86*0.08=0.4464 K'),
(32200,'A','Complex charge balance gives metal oxidation state; high ligand-field splitting may favour pairing; tetrahedral cis/trans and NH3 charge assertions false'),
(32527,'C','Propanone iodoform positive; carbonyl nucleophile attacks electrophilic C; carboxylate resonance and ester vs amide distractors false'),
(32648,'D','DNA deoxyribose RNA ribose, vitamin B/C water-soluble, denaturation not complete hydrolysis, maltose reducing'),
(32426,'B','SN2 at stereocentre inverts; alcoholic base can eliminate; hindered tertiary and aqueous substitution distractors false'),
(32619,'B','Hofmann bromamide reduces carbon count by one; cold aniline diazotization 273-278K'),
(32204,'A','Chelators are multidentate, ligand charge balance yields oxidation state; CN differs from oxidation state and splitting is nonzero'),
(31608,'B','M=1.86*1.5/(0.1*0.2)=139.5 g/mol'),
(32519,'A','NaBH4 reduces aldehydes/ketones; Fischer esterification acid+alcohol; Tollens and carbonyl oxygen distractors false'),
(32439,'C','Primary halide SN2 favoured and alcoholic base elimination favoured; chlorobenzene sp2 and Finkelstein iodide exchange'),
(31852,'B','Nernst:1-(0.0591*4)=0.7636 V'),
(31976,'C','75 percent first order conversion leaves 1/4, t=2*0.693/0.004=346.5 s'),
(32629,'B','Denaturation changes protein conformation; fructose ketohexose; water-soluble vitamin and sucrose distractors false'),
(32149,'A','Colored d-block compounds can show electronic transitions; lanthanoids predominantly +3; zinc ion d10'),
(32492,'A','Phenol ortho/para directs, tertiary Williamson substrate causes elimination; ether mechanism and alcohol H bonds'),
(32438,'D','Grignard reagents destroyed by water; alcoholic base can eliminate; SN2 concerted and tertiary crowding'),
(31655,'D','Osmotic pressure iCRT=1*0.01*0.082*320=0.2624 atm'),
(32142,'A','Lanthanoid contraction from poor 4f shielding; variable transition oxidation states; Mn2+ d5'),
(25552,'B','Cu concentration cell E=(0.0592/2)*log(100)=0.0592 V, oxidation dilute electrode'),
(32584,'C','Hofmann bromamide one carbon shorter; amine basic via N lone pair; primary only carbylamine'),
(32511,'A','Propanone is methyl ketone for iodoform; nucleophile attacks carbonyl carbon; ethanal gives Tollens and iodoform'),
(31929,'C','Arrhenius ln ratio=30000/8.314*(1/300-1/330)~1.093, ratio ~2.985'),
(32503,'B','Primary alcohol controlled oxidation yields aldehyde; phenoxide stabilized versus ethanol; anisole cleavage at methyl'),
(32199,'C','Ethylenediamine bidentate; chlorido -1; ammonia neutral and enantiomers non-superimposable'),
(32643,'D','Denaturation disrupts folding, glucose aldohexose; fructose ketohexose and vitamins B/C water-soluble'),
(32141,'C','Cr ground d5s1; Mn2+ d5; paramagnetism needs unpaired spins'),
(32515,'C','Nucleophile carbonyl-C attack and NaBH4 ketone/aldehyde reduction; Tollens exception and carboxylate stabilization'),
(32630,'C','Glucose aldohexose, cellulose beta-1,4 glucose; fructose ketohexose and catalysts lower activation'),
(32581,'A','Benzenediazonium group replacement and Gabriel primary alkylamine possible; Hofmann carbon count decreases, azo dye retains N=N'),
(31859,'D','E=1.10-(0.0591/2)*2=1.0409 V'),
(31676,'B','Raoult-Dalton yB=(0.3*20)/(0.7*80+0.3*20)=6/62=0.09677'),
(32206,'C','Ethylenediamine bidentate and square-planar cis/trans; tetrahedral d splitting differs; optical isomers not superimposable'),
(32424,'D','Aqueous hydroxide can substitute primary halide; SN1 unimolecular rate; SN2 inversion and alcoholic KOH elimination'),
(31980,'D','Zero order time=(0.25-0.4*0.25)/0.004=37.5 s'),
(32495,'C','Sodium alcohol generates H2; Williamson uses alkoxide and primary haloalkane; alcohol hydrogen bonds'),
(32468,'C','Anisole HI cleaves methyl ether; tertiary halides inefficient Williamson; dehydration is loss of water'),
(32586,'D','Primary carbylamine and cold-vs-unstable aliphatic/aromatic diazonium difference'),
(32437,'A','Aqueous hydroxide substitution and iodide Finkelstein exchange; Grignard must be dry'),
(25498,'D','Cu concentration cell potential=(0.0592/2)*12=0.3552 V'),
(32644,'D','Sucrose nonreducing, glucose aldohexose, proteins often enzymes; denaturation does not hydrolyze entire peptide'),
(25571,'D','Concentration doubling halves t1/2 indicates second order, k=1/(20*0.10)=0.50 M^-1min^-1'),
(32513,'C','Ethanal Tollens and iodoform, esterification acid+alcohol, aldehydes reduce Tollens; benzaldehyde lacks alpha-H'),
(32150,'B','4f poor shielding and common lanthanoid +3; Zn2+ d10 and no allowed d-d excitations of d10'),
(32202,'C','Oxidation state from charges, chelating ligands multidentate, en bidentate and Cl- negative'),
(25601,'C','0.75=300x/(100+200x), x=0.5, Ptotal=200 mmHg'),
(32639,'D','B/C water soluble, sucrose nonreducing; cellulose beta1,4 glucose, DNA deoxyribose'),
(32611,'C','Gabriel primary alkylamines, diazonium behavior and aniline cold diazotization'),
(31998,'D','75% first-order conversion in two half-lives, 20/2=10 min'),
(32143,'A','Transition metals coordinate and unpaired electrons paramagnetic; Cu d10s1 and Mn2+ d5'),
(32210,'C','Oxidation state charge balance, optical isomers nonsuperimposable; en bidentate and tetrahedral MA2B2 no cis/trans'),
(25555,'B','Ni cathode -0.25 minus Mg anode -2.37=+2.12 V'),
(32496,'B','Secondary alcohol oxidation ketone, sodium alcohol H2; anisole HI gives phenol and methyl iodide'),
(31692,'B','Matched freezing depression i*m: glucose 1*0.10=NaCl 2*0.05'),
(32524,'B','Fischer esterification, aldehyde reduction primary alcohol, Tollens silver mirror; carboxylate resonance stabilizes acidity'),
(32425,'C','Alcoholic base elimination and Finkelstein iodide exchange; chlorobenzene sp2 and SN2 concerted')
 ) AS v(source_id,expected_answer,reason)
 JOIN public.questions q ON q.id=v.source_id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=v.source_id
 WHERE r.source_question_id=v.source_id AND r.destination_subject_id=21
 AND r.review_status IN ('PENDING_ACADEMIC_REVIEW','VERIFIED')
 AND btrim(q.correct_option::text)=v.expected_answer
 AND c.source_content_review_status<>'HOLD'
 AND NOT c.media_blocked AND NOT c.duplicate_candidate AND NOT c.answer_issue
 AND c.source_media_ready AND q.media_ready AND q.is_active=false
 AND (q.question_media IS NULL OR q.question_media='{}'::jsonb);
 GET DIAGNOSTICS v_changed=ROW_COUNT;
 IF v_changed<>60 THEN RAISE EXCEPTION 'Expected 60 exact reviews, got %; rolled back',v_changed; END IF;
 IF (SELECT COUNT(*) FROM cbse_import.advanced_mock_release_review_20261028
 WHERE destination_subject_id=21 AND review_status='VERIFIED')<>60
 THEN RAISE EXCEPTION '60 reviews were not verified'; END IF;
END $$;
COMMIT;
