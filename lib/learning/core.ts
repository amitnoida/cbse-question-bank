export const OPTIONS = ["A", "B", "C", "D"] as const;
export type Option = typeof OPTIONS[number];
export type LearningQuestion = {id:number;chapter_id:number;chapter_name:string;subject_name:string;question_text:string;option_a:string;option_b:string;option_c:string;option_d:string;correct_option?:string;explanation?:string};
export type LearningSession = {id:string;mode:string;title:string;questions:LearningQuestion[];answers:Record<string,string>;completed_at:string|null;score:number;total:number};
export function isOption(value:unknown):value is Option {return typeof value==="string" && (OPTIONS as readonly string[]).includes(value);}
export function positiveId(value:unknown):value is number {return typeof value==="number"&&Number.isSafeInteger(value)&&value>0;}
export function scoreQuestions(questions:LearningQuestion[], answers:Record<string,string>){return questions.reduce((n,q)=>n+(answers[q.id]===q.correct_option?.trim()?1:0),0);}
/** Answers are disclosed only for questions whose answer has been saved. */
export function publicSession(row:{id:string;mode:string;title:string;questions:LearningQuestion[];answers:Record<string,string>;completed_at:string|null}):LearningSession {
 const questions=row.questions.map(q=>{if(row.answers[String(q.id)])return q;const {correct_option,explanation,...safe}=q;void correct_option;void explanation;return safe;});
 return {id:row.id,mode:row.mode,title:row.title,answers:row.answers,completed_at:row.completed_at,questions,score:scoreQuestions(row.questions,row.answers),total:row.questions.length};
}
export function istDay(date=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);}
export function shareUrl(path:string){return `https://examyari.com${path}`;}
