#!/usr/bin/env node
'use strict';

// Validates presence and shape only; never writes or prints passwords.
let accounts;
try {
  accounts = JSON.parse(process.env.E2E_ACCOUNTS_JSON || 'null');
} catch {
  throw new Error('E2E_ACCOUNTS_JSON is not valid JSON');
}
if (!Array.isArray(accounts) || accounts.length !== 18) {
  throw new Error('Exactly 18 test accounts must be configured in E2E_ACCOUNTS_JSON');
}
const seen = new Set();
for (const [index, account] of accounts.entries()) {
  if (!account || typeof account.email !== 'string' ||
      typeof account.password !== 'string' || !account.password.trim() ||
      !['student','admin'].includes(account.kind) ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(account.email)) {
    throw new Error('Invalid email/password/kind at test account index '+(index+1));
  }
  const email=account.email.trim().toLowerCase();
  if (seen.has(email)) throw new Error('Duplicate test account at index '+(index+1));
  seen.add(email);
}
const student=accounts.filter(a=>a.kind==='student'), admin=accounts.filter(a=>a.kind==='admin');
if (student.length!==16 || admin.length!==2) throw new Error('Expected 16 students and 2 admins; check E2E_ACCOUNTS_JSON');
for(const n of [8,9,10,11,12]) {
  for(const type of ['free','paid']) {
    const email='test_'+n+'_'+type+'@gmail.com';
    if(!seen.has(email)) throw new Error('Missing required test account: '+email);
  }
}
if(!admin.some(a=>/full/i.test(a.email)) || !admin.some(a=>/viewer/i.test(a.email))) {
  throw new Error('Expected full and viewer admin test accounts');
}
const competition=student.filter(a=>!/test_(8|9|10|11|12)_(free|paid)@gmail\.com$/i.test(a.email));
if(competition.length!==6 || competition.filter(a=>/jee/i.test(a.email)).length!==4 || competition.filter(a=>/neet/i.test(a.email)).length!==2) {
  throw new Error('Expected six JEE/NEET students (four JEE, two NEET)');
}
console.log('E2E account configuration valid: 18 total (16 students and 2 administrators).');
console.log('Regular classes: 8, 9, 10, 11, 12 (free and paid); competitions: JEE (4), NEET (2).');
console.log('Credentials are kept in GitHub Actions secrets and are not printed.');
