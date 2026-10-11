import { defineConfig, devices } from '@playwright/test';
// Set PORT to test against a free port. reuseExistingServer happily adopts whatever already
// listens, and a `next dev` server's HMR socket breaks hydration under test, so a stray dev
// server on the default port makes every interactive test fail for unrelated reasons.
const port=Number(process.env.PORT)||3000;
const baseURL=`http://127.0.0.1:${port}`;
// The site now follows the device's colour scheme. The suites were written against dark, so they run as a dark
// device; tests/theme-follows-device.spec.ts emulates light and dark itself.
export default defineConfig({testDir:'./tests',testIgnore:'**/unit/**',fullyParallel:true,retries:0,workers:2,reporter:[['list'],['html',{open:'never'}]],use:{baseURL,trace:'retain-on-failure',colorScheme:'dark'},projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],webServer:{command:`npm run start -- --port ${port}`,url:`${baseURL}/en`,reuseExistingServer:true,timeout:60000}});
