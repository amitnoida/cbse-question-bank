-- Class XI Physics CBSE 2026-27 -- 60 AI-assisted individual solution checks.
-- Source: https://cbseacademic.nic.in/curriculum_2027.html
-- Updates only the private cbse_import academic review queue; no release, no school MCQ changes.
BEGIN;
DO $$
DECLARE n integer;
BEGIN
 UPDATE cbse_import.advanced_mock_release_review_20261028 r
 SET review_status='VERIFIED',
     verified_at=COALESCE(r.verified_at,clock_timestamp()),
     reviewer_note='AI-assisted Class 11 Physics solution/option/chapter check 2026-10-28: '||v.reason||'. Private review only; academic release requires separate transaction.'
 FROM (VALUES
(34207,'A','Closed-open tube ΔL=0.32 m=λ/2; v=520*(0.64)=332.8 m/s'),
(32980,'A','Atwood a=(9-4)*10/(9+4)=50/13=3.846 m/s2'),
(33191,'C','Escape speed sqrt(2*g*R)=sqrt(2*5*2e6)=4472 m/s=4.472 km/s'),
(34203,'A','Least count 0.5/100=0.005mm; 2+12*0.005-0.02=2.04 mm'),
(33328,'A','Capillary h=2*0.07/(1000*10*0.0003)=0.046667m=4.667cm'),
(32880,'A','Relative speed 8+5=13m/s; faster distance=8*150/13=92.31m'),
(33080,'B','Inelastic KE loss=m*M*u^2/[2(m+M)]=1*5*100/12=41.67J'),
(33385,'D','Reversible isothermal work=nRT*ln4=3*8.3*350*1.38629≈1.208e4J'),
(33473,'C','From PV=(2/3)*E, P=2*200/(3*0.01)=13333Pa'),
(33333,'A','Young extension FL/(AY)=50/[2e-6*2e11]=0.000125m=0.125mm'),
(33522,'A','Series spring k_eff=100N/m, period 2*pi*sqrt(0.4/100)=0.3974s'),
(33267,'C','Thermal resistances .02/(100*.01)+.02/(80*.01)=.045K/W; 60/.045=1333W'),
(32916,'B','Crossing time=80/3s, drift=2*80/3=53.33m'),
(33148,'C','Iomega constant: omega_f=5/0.75=6.667rad/s'),
(33353,'C','Adiabatic T2=480*(1/2)^0.667=302.3K'),
(33231,'D','At altitude 2R, distance 3R: g=8/9=0.8889m/s2'),
(33265,'B','Stokes terminal v=2*r^2*deltaRho*g/(9eta)=8.889e-5m/s=.08889mm/s'),
(33115,'C','End-rotating uniform rod I=ML^2/3=4*0.64/3=0.8533kgm2'),
(32759,'D','Max percentage error in g=0.5+2*0.3=1.1 percent'),
(33460,'B','Mean free path ratio for 12-fold pressure at fixed temperature =1/12=.08333'),
(32832,'C','Projectile range=u^2sin(60 degrees)/g=625*.866025/10=54.13m'),
(33541,'A','SHM speed=omega*sqrt(A^2-x^2)=10*sqrt(0.01-.0009)=.9539m/s'),
(28340,'B','Composite series strain: delta_total=delta+delta/2=3delta/2; Y_eff=2/(1/Y+1/(2Y))=4Y/3'),
(32977,'C','Apparent weight N=65*(10+2.5)=812.5N'),
(32877,'A','Equal return distances harmonic average=2*30*48/(30+48)=36.923km/h'),
(33275,'A','Mix water final temperature=(.1*80+.2*10)/(.1+.2)=33.333C'),
(33073,'C','Elastic target velocity=2*m1*u1/(m1+m2)=2*2*8/7=4.571m/s'),
(33483,'D','Beats 6Hz, higher fork f2=250+6=256Hz'),
(28602,'A','Vertical spring equilibrium amplitude mg/k, omega=sqrt(k/m), vmax=g*sqrt(m/k); min extension zero'),
(33087,'D','Spring energy to block kinetic: v=.05*sqrt(100/.4)=.7906m/s'),
(33156,'A','Uniform disc I=.5*3*.4^2=.24 kgm2; alpha=.4/.24=1.667rad/s2'),
(33417,'B','Monatomic constant pressure Q=1*(5/2)*8.3*30=622.5J'),
(33523,'D','Closed tube third harmonic f3=3*340/(4*.4)=637.5Hz'),
(32876,'B','Equal-distance harmonic mean 2*30*60/(30+60)=40km/h'),
(28425,'C','Heat released cooling equal water 4.2*20=84kJ/kg; ice warming needs 2.1*10=21; fraction melted=(84-21)/336=3/16'),
(33459,'B','Gas rms speed sqrt(3*8.3*350/.032)=521.9m/s'),
(32833,'D','Horizontal drop time sqrt(2*80/10)=4s, x=12*4=48m'),
(28371,'A','Elastic energy density=.5*1e11*(5e-4)^2=12500J/m3'),
(33311,'B','Pipe area factor 4 -> speed 10m/s; pressure drop=.5*1000*(100-6.25)=46875Pa'),
(33227,'A','Kepler T2/T1=(2)^(3/2)=2.828'),
(27947,'A','Pendulum g proportional L/T2: 0.2% length +2*(.2/100*100%) timing=.60%'),
(32973,'A','Incline acceleration=10*(sin30-.3*cos30)=2.402m/s2'),
(28400,'C','Equal ice-water mass 12C water loses 4.2*12=50.4kJ, heat ice to 0 needs21; melt fraction=29.4/336=.0875'),
(33319,'B','Continuity when area halves doubles speed; Bernoulli pressure falls'),
(33416,'B','First law deltaU=Q-W=500-200=300J'),
(33172,'C','Center of mass x=5*.9/(3+5)=.5625m'),
(32918,'B','Projectile vertical component=20*sin30=10m/s; max height=100/(2*10)=5m'),
(28342,'A','Series Young modulus 2/(1/130+1/260)=173.333GPa'),
(33521,'B','Equal KE and PE in SHM -> kx2/2 = kA2/4 -> abs(x)=A/sqrt2'),
(32767,'D','rho proportional R*d^2/L, max error=1%+2*1%+.5%=3.5%'),
(33526,'D','String wave speed sqrt(40/.004)=100m/s, f0=100/(2*1.2)=41.67Hz'),
(27984,'C','Accelerating phase v=13*13=169m/s, distance=.5*13*13^2=1098.5m; braking distance=169^2/(2*14)=1020.0357m, total2118.54m'),
(32938,'C','Atwood tension T=2*m1*m2*g/(m1+m2)=2*2*7*10/9=31.11N'),
(33197,'B','Orbital E=-mgR/(2*1.5)=-250*10*4e6/3=-3.333e9J'),
(28544,'D','Equal temperature rms speed ratio=sqrt(M2/M1)=sqrt(14/13)=1.03775'),
(33068,'B','Pump useful P=mgh/t=50*10*12/15=400W; input400/.75=533.3W'),
(28423,'C','Calorimetry Q=m*c*dT=23*17*3=1173J'),
(28485,'A','P-V straight-line work=average(1,2)bar*(15-13)L=3barL=300J'),
(33118,'C','Rolling solid sphere mgh=(7/10)mv2, v=sqrt(10*g*h/7)=sqrt(150/7)=4.629m/s'),
(28247,'B','Radial projectile specific energy -.5GM/R; at turning point -GM/r=-.5GM/R, r=2R')
 ) v(source_id,expected_answer,reason)
 JOIN public.questions q ON q.id=v.source_id
 JOIN cbse_import.advanced_mock_stage2_candidates_20261028 c ON c.source_question_id=v.source_id
 WHERE r.source_question_id=v.source_id
  AND r.destination_subject_id=19
  AND r.review_status IN ('PENDING_ACADEMIC_REVIEW','VERIFIED')
  AND btrim(q.correct_option::text)=v.expected_answer
  AND c.destination_subject_id=19
  AND c.destination_chapter_id=r.destination_chapter_id
  AND c.release_approved=FALSE
  AND c.source_content_review_status<>'HOLD'
  AND NOT c.duplicate_candidate AND NOT c.media_blocked AND NOT c.answer_issue
  AND c.source_media_ready AND q.media_ready AND NOT q.is_active
  AND (q.question_media IS NULL OR q.question_media='{}'::jsonb);
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>60 THEN RAISE EXCEPTION 'Expected exactly 60 private reviews, got %; rollback',n; END IF;
 IF (SELECT COUNT(*) FROM cbse_import.advanced_mock_release_review_20261028 WHERE destination_subject_id=19 AND review_status='VERIFIED')<>60 THEN
 RAISE EXCEPTION 'Incomplete Physics review'; END IF;
END $$;
COMMIT;