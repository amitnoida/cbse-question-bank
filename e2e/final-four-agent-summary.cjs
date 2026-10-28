#!/usr/bin/env node
// Accurate live Playwright job summary; no credentials logged.
'use strict';
const fs=require('node:fs'),p=require('node:path');
const file=p.join(__dirname,'results','results.json');
const scope=process.env.FINAL_TEST_SCOPE||'Production regression';
const rows=[];
const visit=s=>{
 for(const spec of s.specs||[])for(const t of spec.tests||[]){
  const r=t.results?.[t.results.length-1];
  rows.push({title:spec.title,status:r?.status||t.status||'unknown'});
 }
 for(const sub of s.suites||[])visit(sub);
};
if(fs.existsSync(file)){
 const report=JSON.parse(fs.readFileSync(file,'utf8'));
 for(const s of report.suites||[])visit(s);
}
const out={passed:0,failed:0,skipped:0,other:0};
for(const r of rows){
 if(r.status==='passed')out.passed++;
 else if(r.status==='failed'||r.status==='timedOut')out.failed++;
 else if(r.status==='skipped')out.skipped++;
 else out.other++;
}
const lines=['## '+scope,'','Production: https://cbse-question-bank.vercel.app','','| Outcome | Tests |','|---|---:|',
'| Passed | '+out.passed+' |','| Failed / timed out | '+out.failed+' |','| Skipped | '+out.skipped+' |',
'| Unknown / interrupted | '+out.other+' |','| Total | '+rows.length+' |',''];
if(!rows.length) lines.push('No test results found: setup, credentials or browser installation may have failed. Not passed.');
else if(out.failed||out.other){
 lines.push('### Failed or interrupted');
 for(const r of rows.filter(x=>x.status==='failed'||x.status==='timedOut'||!['passed','skipped'].includes(x.status)).slice(0,50))
  lines.push('- '+r.title.replace(/[|\r\n]/g,' ')+': '+r.status);
}else if(out.skipped)lines.push('Some tests skipped. Skips are not passes.');
else lines.push('All recorded tests passed.');
const result=lines.join('\n')+'\n';
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,result);
process.stdout.write(result);
