const path=require('node:path');
const {defineConfig,devices}=require('@playwright/test');
module.exports=defineConfig({
 testDir:__dirname,testMatch:'mobile-compatibility.spec.cjs',timeout:120000,
 expect:{timeout:15000},workers:2,retries:0,
 reporter:[['list'],['html',{outputFolder:path.join(__dirname,'../results/mobile-report'),open:'never'}],['json',{outputFile:path.join(__dirname,'../results/mobile-results.json')}]],
 outputDir:path.join(__dirname,'../results/mobile-artifacts'),
 use:{baseURL:process.env.E2E_BASE_URL||'https://examshuru.com',headless:true,actionTimeout:15000,screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'android-small',use:{...devices['Pixel 5'],viewport:{width:360,height:740},browserName:'chromium'}},
  {name:'android-large',use:{...devices['Pixel 7'],browserName:'chromium'}},
  {name:'iphone-small',use:{...devices['iPhone SE'],browserName:'webkit'}},
  {name:'iphone-large',use:{...devices['iPhone 13'],browserName:'webkit'}}
 ]
});
