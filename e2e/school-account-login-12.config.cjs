const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:__dirname,
  testMatch:'school-account-login-12.spec.cjs',
  timeout:120000,expect:{timeout:30000},
  fullyParallel:false,workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:'results/school-login-12.json'}],['html',{outputFolder:'report-school-login-12',open:'never'}]],
  outputDir:'results/school-login-12-artifacts',
  use:{
    baseURL:process.env.E2E_BASE_URL,
    browserName:'chromium',headless:true,trace:'off',video:'off',
    screenshot:'only-on-failure',actionTimeout:30000,
  }
});
