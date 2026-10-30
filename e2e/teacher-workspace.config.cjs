const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'.',testMatch:'teacher-workspace.spec.cjs',timeout:240000,workers:1,retries:0,use:{baseURL:'https://cbse-question-bank.vercel.app',headless:true,trace:'off',video:'off',screenshot:'off'},reporter:[['list']]});
