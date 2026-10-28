#!/usr/bin/env node
'use strict';
// Validate twelve school/admin users selected from the existing secret.
// A legacy secret can have additional accounts; only school/admin accounts are selected.
let all;
try { all=JSON.parse(process.env.E2E_ACCOUNTS_JSON||'null'); }
catch { throw new Error('E2E_ACCOUNTS_JSON is not valid JSON'); }
if(!Array.isArray(all)||all.length<12)throw Error('Configure at least 12 school/admin accounts in E2E_ACCOUNTS_JSON');
const selected=all.filter(a=>a&&typeof a.email==='string'&&(
  a.kind==='admin'||/^test_(8|9|10|11|12)_(free|paid)@gmail\.com$/i.test(a.email)
));
if(selected.length!==12)throw Error('Expected exactly 12 school and admin accounts (10 students + 2 admins)');
const seen=new Set();
for(const [index,a] of selected.entries()){
 if(!a||typeof a.email!=='string'||typeof a.password!=='string'||!a.password.trim()||!['student','admin'].includes(a.kind)||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email)){
  throw Error('Invalid required credential for test account '+(index+1));
 }
 const email=a.email.trim().toLowerCase();
 if(seen.has(email))throw Error('Duplicate school/admin test email');
 seen.add(email);
}
if(selected.filter(a=>a.kind==='student').length!==10||selected.filter(a=>a.kind==='admin').length!==2){
 throw Error('Expected 10 students and 2 administrators');
}
for(const n of [8,9,10,11,12])for(const type of ['free','paid']){
 if(!seen.has('test_'+n+'_'+type+'@gmail.com'))throw Error('Missing test_'+n+'_'+type+'@gmail.com');
}
const admins=selected.filter(a=>a.kind==='admin');
if(!admins.some(a=>/full/i.test(a.email))||!admins.some(a=>/viewer/i.test(a.email)))throw Error('Full and Viewer admin accounts are required');
console.log('Validated 12 school/admin test accounts: 10 students and two administrators.');
console.log('Only Classes 8–12 students and Full/Viewer Admin are in scope.');
console.log('Passwords are never written to test output.');
