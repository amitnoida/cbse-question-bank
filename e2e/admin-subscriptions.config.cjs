const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'.',testMatch:'admin-subscriptions.spec.cjs',timeout:90000,workers:1,retries:1,use:{baseURL:process.env.E2E_BASE_URL||'https://cbse-question-bank.vercel.app',headless:true,trace:'off',video:'off',screenshot:'off'},reporter:[['list']]});
