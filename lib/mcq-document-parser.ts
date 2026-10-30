// Deterministic extraction only: never invent an answer, explanation or missing option.
export const MCQ_PARSER_VERSION=1;
export const MAX_IMPORT_TEXT=1_000_000;
export type ImportQuestion={ordinal:number;question_text:string;option_a:string;option_b:string;option_c:string;option_d:string;correct_option:string;explanation:string};
export type ParsedMcqs={total:number;questions:ImportQuestion[];skipped:number;reasons:Record<string,number>};
const questionStart=/^(?:Q(?:uestion)?\s*[.:-]?\s*)?(\d{1,5})\s*[.):\-]\s*(.*)$/i;
const optionStart=/^(?:\(([A-Da-d])\)|([A-Da-d])[.):])\s*(.*)$/;
const answerStart=/^(?:correct\s+(?:answer|option)|answer|ans\.?)[\s:：\-]+(.+)$/i;
const explanationStart=/^(?:explanation|solution|reason)[\s:：\-]+(.*)$/i;
const clean=(s:string)=>s.replace(/\s+/g,' ').trim();
export function parseMcqDocument(text:string):ParsedMcqs{
 if(typeof text!=='string'||text.length>MAX_IMPORT_TEXT)throw Error('Document text exceeds the POC limit. Split the file into smaller documents.');
 const lines=text.replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').split('\n').map(s=>s.trim()).filter(Boolean);
 const blocks:{ordinal:number;lines:string[]}[]=[];
 for(const line of lines){const m=line.match(questionStart);if(m){blocks.push({ordinal:blocks.length+1,lines:[m[2]]});}else if(blocks.length)blocks[blocks.length-1].lines.push(line);}
 if(blocks.length>3000)throw Error('Maximum 3,000 numbered questions per file. Split this document before processing.');
 const questions:ImportQuestion[]=[],reasons:Record<string,number>={};
 const skip=(reason:string)=>{reasons[reason]=(reasons[reason]||0)+1;};
 for(const block of blocks){
 const options:Record<string,string>={};let question='',answer='',explanation='',section='question',invalid=false;
 for(const line of block.lines){
 const a=line.match(answerStart),e=line.match(explanationStart),o=line.match(optionStart);
 if(a){if(answer)invalid=true;answer=clean(a[1]);section='answer';}
 else if(e){if(explanation)invalid=true;explanation=e[1];section='explanation';}
 else if(o){const key=(o[1]||o[2]).toUpperCase();if(options[key]!==undefined)invalid=true;options[key]=o[3];section=key;}
 else if(section==='question')question+=' '+line;
 else if(section==='explanation')explanation+=' '+line;
 else if(options[section]!==undefined)options[section]+=' '+line;
 else invalid=true;
 }
 question=clean(question);explanation=clean(explanation);for(const k of Object.keys(options))options[k]=clean(options[k]);
 const answerMatch=answer.match(/^\(?([A-Da-d])\)?(?:\s*[.):\-]\s*.*)?$/);const correct=answerMatch?.[1].toUpperCase();
 const whole=block.lines.join(' ');
 if(/\[\[UNSUPPORTED_IMAGE\]\]|\b(?:diagram|figure|image|graph)\b|चित्र|आकृति/i.test(whole)){skip('image_or_diagram');continue;}
 if(invalid||/[\uFFFD\u0000-\u0008\u000e-\u001f]/.test(whole)){skip('unclear_layout');continue;}
 if(question.length<5||question.length>4000||!['A','B','C','D'].every(k=>options[k]&&options[k].length<=1500)||new Set(Object.values(options).map(s=>s.toLowerCase())).size!==4){skip('incomplete_question_or_options');continue;}
 if(!correct){skip('missing_or_unclear_answer');continue;}
 if(explanation.length<5||explanation.length>8000){skip('missing_or_unclear_explanation');continue;}
 questions.push({ordinal:block.ordinal,question_text:question,option_a:options.A,option_b:options.B,option_c:options.C,option_d:options.D,correct_option:correct,explanation});
 }
 return {total:blocks.length,questions,skipped:blocks.length-questions.length,reasons};
}
