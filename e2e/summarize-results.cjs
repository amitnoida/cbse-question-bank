#!/usr/bin/env node
'use strict';
const fs=require('node:fs');
const path=require('node:path');

const file=path.join(__dirname,'results','results.json');
const lines=['## CBSE Full E2E — 18 Test Accounts','','Run scope: **live production website**, using dedicated GitHub-stored test accounts only.'];
if(!fs.existsSync(file)){
  lines.push('','**No Playwright results were found.** Check the preceding install, account-validation or browser-test step.');
}else{
  const report=JSON.parse(fs.readFileSync(file,'utf8'));
  const rows=[];
  const visit=suite=>{
    for(const spec of suite.specs||[]){
      for(const test of spec.tests||[]){
        const result=test.results?.[test.results.length-1];
        const status=result?.status||test.status||'unknown';
        rows.push({title:spec.title,status,location:spec.file||suite.file||''});
      }
    }
    for(const child of suite.suites||[])visit(child);
  };
  for(const suite of report.suites||[])visit(suite);
  const summary={passed:0,failed:0,skipped:0,other:0};
  for(const row of rows){
    if(row.status==='passed')summary.passed++;
    else if(row.status==='failed'||row.status==='timedOut')summary.failed++;
    else if(row.status==='skipped')summary.skipped++;
    else summary.other++;
  }
  lines.push('',
    '| Status | Number |','|---|---:|',
    `| Passed | ${summary.passed} |`,
    `| Failed | ${summary.failed} |`,
    `| Skipped | ${summary.skipped} |`,
    `| Other / interrupted | ${summary.other} |`,
    `| **Total** | **${rows.length}** |`);
  const errors=rows.filter(r=>['failed','timedOut'].includes(r.status));
  if(errors.length){
    lines.push('','### Failed tests (do not treat as passed)');
    for(const row of errors.slice(0,50))lines.push('- '+row.title.replace(/[\r\n|]/g,' '));
    if(errors.length>50)lines.push('- ...plus '+(errors.length-50)+' additional failures');
  }else if(summary.other>0){
    lines.push('','Some tests were interrupted or did not complete. Inspect the uploaded Playwright report.');
  }else{
    lines.push('','**No test failures were recorded.** Skipped tests, if any, were not executed and do not count as passes.');
  }
  lines.push('','### What this suite checks',
    '- Login and authorized access for all 18 users, including full/viewer administrators',
    '- Student membership, class/subject navigation, dashboard visibility',
    '- Homepage, SEO routes, sitemap, registration dropdown and authentication entry points',
    '- Selected free practice and paid mock submission journeys on dedicated test accounts',
    '- Competitive JEE/NEET login and subject-readiness checks (fail when content is missing)',
    '','Practice and mock tests can create attempts or consume free allowance in **test accounts only**.');
}
const output=lines.join('\n')+'\n';
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,output);
console.log(output);
