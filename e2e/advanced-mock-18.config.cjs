const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:__dirname,
  testMatch:'advanced-mock-18.spec.cjs',
  timeout:120000,
  expect:{timeout:30000},
  fullyParallel:false,workers:1,retries:0,
  reporter:[['list'],['json',{outputFile:'results/advanced-18.json'}],['html',{outputFolder:'report-advanced-18',open:'never'}]],
  outputDir:'results/advanced-18-artifacts',
  use:{
    baseURL:process.env.E2E_BASE_URL,
    browserName:'chromium',headless:true,
    trace:'off',video:'off',screenshot:'only-on-failure',
    actionTimeout:30000,
  }
});
