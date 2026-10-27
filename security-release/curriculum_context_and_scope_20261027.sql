begin;
do $$ declare n integer; begin
 select count(*) into n from questions q join chapters c on c.id=q.chapter_id join subjects s on s.id=c.subject_id join classes cl on cl.id=s.class_id
 where cl.class_number in(9,10) and s.subject_name in('English','Hindi') and q.is_active and c.is_active and c.id not in(133,134,135,152,153,154,638,639) and strpos(lower(q.question_text),lower(c.chapter_name))=0;
 if n<>2057 then raise exception 'Context update set changed: %',n; end if;
end $$;
update questions q set question_text='['||c.chapter_name||'] '||q.question_text,updated_at=now()
from chapters c join subjects s on s.id=c.subject_id join classes cl on cl.id=s.class_id
where q.chapter_id=c.id and cl.class_number in(9,10) and s.subject_name in('English','Hindi') and q.is_active and c.is_active and c.id not in(133,134,135,152,153,154,638,639) and strpos(lower(q.question_text),lower(c.chapter_name))=0;
update chapters set is_active=false,description='Not prescribed for the current Class 10 2026–27 course. Archived for historical results; excluded from new practice and new mock assignments.' where (id=145 and chapter_name='मानवीय करुणा की दिव्य चमक') or (id=172 and chapter_name='Challenges to Democracy');
update chapters c set description=v.note from (values
(229,'Assessment scope: Class 10 Science 2026–27 includes Periodic Classification of Elements for formative assessment only, not summative board assessment.'),
(158,'Assessment scope: Class 10 History 2026–27 assesses this chapter through periodic assessment only.'),
(177,'Assessment scope: Class 10 Economics 2026–27 treats Consumer Rights as project work.'),
(166,'Assessment scope: Class 10 Geography 2026–27 assesses this chapter through board map pointing and an internally assessed interdisciplinary project. General MCQs are supporting practice, not a map-work substitute.'),
(157,'Assessment scope: Board assessment covers subtopics 1–1.3 (the pre-modern world through conquest, disease and trade). Later sections are internal interdisciplinary-project material. This practice bank includes supporting questions from both.'),
(176,'Assessment scope: Board assessment focuses on the meaning of globalisation and the factors enabling it. Production across countries, WTO and fair-globalisation topics are internal interdisciplinary-project material. This practice bank includes both.'),
(636,'Assessment scope: Supplementary reasoning and computational-thinking practice, not a separately named chapter in the CBSE Class 9 2026–27 course outline.'),
(637,'Assessment scope: Supplementary algorithmic and computational-thinking practice, not a separately named chapter in the CBSE Class 9 2026–27 course outline.')
) v(id,note) where c.id=v.id;
commit;
select count(*) as poetry_questions from questions where id between 10477 and 10496 and is_active;
