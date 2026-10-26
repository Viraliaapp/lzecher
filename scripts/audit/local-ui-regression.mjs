import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { chromium } from 'playwright';
const root=process.cwd(), out=path.join(root,'test-results','audit-ui'); fs.mkdirSync(out,{recursive:true});
const catalogs=Object.fromEntries(['en','he','es','fr'].map(l=>[l,JSON.parse(fs.readFileSync(`messages/${l}.json`,'utf8'))]));
const stubs={
 'next/navigation': `export const useSearchParams=()=>new URLSearchParams(location.search);`,
 'firebase/firestore': `export const doc=()=>({});export const getDoc=async()=>({exists:()=>false});export const setDoc=async(ref,data,options)=>{window.__audit.profileWrite={data,options}};`,
 '@/components/layout/Navbar': `export const Navbar=()=>null;`,
 '@/lib/firebase/auth': `export const sendMagicLink=async(email,locale,redirect)=>{window.__audit.signInRequests??=[];window.__audit.signInRequests.push({email,locale,redirect});await new Promise(r=>setTimeout(r,200));};export const isMagicLinkSignIn=()=>new URLSearchParams(location.search).has('finishSignIn');export const completeMagicLinkSignIn=async()=>({user:{uid:'owner',email:'audit@example.test'}});`,
 '@/i18n/navigation': `import React from 'react'; export const Link=({href,children,...props})=><a href={href} {...props}>{children}</a>; export const useRouter=()=>({replace:path=>{window.__audit.redirect=path}});`,
 '@/context/AuthContext': `const user={uid:'owner',email:'owner@example.test'}; export const useAuth=()=>({user:window.__audit.signedOut?null:user,profile:{displayName:'Audit owner'},loading:false});`,
 '@/lib/firebase/config': `export const db={}; export const auth={currentUser:{getIdToken:async()=>'synthetic'}};`,
 '@/components/memorial/ShareTemplates': `export const ShareTemplates=()=>null;`,
 '@/components/activity/GlobalCounter': `export const GlobalCounter=()=>null;export const SiteViewsCounter=()=>null;`,
 '@/components/activity/ActivityBubbles': `export const ActivityBubbles=()=>null;`,
};
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';import {NextIntlClientProvider} from 'next-intl';import {Toaster} from 'sonner';import {HomeClient} from './src/components/landing/HomeClient';import Dashboard from './src/app/[locale]/(app)/dashboard/page';import Login from './src/app/[locale]/(auth)/login/page';
const query=new URLSearchParams(location.search),locale=query.get('locale')||'en';const messages=${JSON.stringify(catalogs)};
const project={id:'audit',slug:'audit',createdBy:'owner',status:'active',nameHebrew:'לומד בדיקה',familyNameHebrew:'',nameEnglish:'Audit Memorial',trackTypes:['mishnayos'],tracks:['mishnayos'],totalPortions:525,claimedPortions:1,completedPortions:0,participantCount:1,createdAt:Date.now(),showLeaderboard:true};
window.__audit={signedOut:query.has('signedOut'),failSave:false,delaySave:0,patches:[],claims:[{id:'claim',projectId:'audit',portionId:'one',trackType:'mishnayos',reference:'Bava Kamma 1',userId:'learner',userName:'Original learner',status:'active',claimedAt:Date.now()}]};
window.fetch=async(url,options={})=>{const state=window.__audit;let data={};let status=200;if(url==='/api/dashboard')data={projects:[project],claims:[],stats:{totalClaimedPortions:1,uniqueParticipants:1,claimsThisWeek:1}};else if(url==='/api/projects/audit/claims')data={claims:state.claims};else if(options.method==='PATCH'){state.patches.push(JSON.parse(options.body));await new Promise(r=>setTimeout(r,state.delaySave));if(state.failSave)status=500;else state.claims[0].userName=JSON.parse(options.body).userName;}else if(options.method==='DELETE'){state.claims=[];}else throw new Error('Unexpected fixture request '+url);return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})};
document.documentElement.dir=locale==='he'?'rtl':'ltr';document.documentElement.lang=locale;
createRoot(document.getElementById('root')).render(<NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC"><Toaster/>{query.get('page')==='login'?<Login/>:query.get('page')==='dashboard'?<Dashboard/>:<HomeClient memorials={[project]}/>}</NextIntlClientProvider>);`;
await build({stdin:{contents:entry,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',jsx:'automatic',outfile:path.join(out,'app.js'),define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'synthetic-services',setup(b){b.onResolve({filter:/.*/},a=>stubs[a.path]?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path],loader:'jsx',resolveDir:root}));}}]});
const css=await postcss([tailwind({base:root})]).process(fs.readFileSync('src/app/globals.css','utf8'),{from:path.join(root,'src/app/globals.css')});fs.writeFileSync(path.join(out,'app.css'),css.css);
const server=http.createServer((req,res)=>{const name=req.url.startsWith('/app.js')?'app.js':req.url.startsWith('/app.css')?'app.css':null;res.setHeader('Content-Type',name?.endsWith('js')?'text/javascript':name?'text/css':'text/html');res.end(name?fs.readFileSync(path.join(out,name)):'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:'msedge',headless:true});const results=[],errors=[];
try{
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});await page.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 for(const locale of ['en','he','es','fr'])for(const width of [1280,320]){
  await page.setViewportSize({width,height:900});await page.goto(`${origin}/?locale=${locale}`);const search=page.getByRole('searchbox',{name:catalogs[locale].landing.searchPlaceholder});await search.waitFor();
  assert.equal(await page.getByRole('link',{name:/Audit Memorial|לומד בדיקה/}).count(),1);
  await search.fill('  impossible-person  ');assert.equal(await page.getByRole('link',{name:/Audit Memorial|לומד בדיקה/}).count(),0);
  await search.fill('  ');assert.equal(await page.getByRole('link',{name:/Audit Memorial|לומד בדיקה/}).count(),1);
  await page.getByRole('button',{name:locale==='he'?'תצוגת רשימה':'List view',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`home overflow ${locale} ${width}`);
  if(locale==='en')assert.match(await page.locator('main').innerText(),/1 participant\b/);
  await page.screenshot({path:path.join(out,`home-${locale}-${width}.png`),fullPage:true});results.push(`home ${locale} ${width}: labelled search, whitespace/empty states, grid/list, overflow`);
 }
 for(const locale of ['en','he'])for(const width of [1280,320]){
  await page.setViewportSize({width,height:900});await page.goto(`${origin}/?page=dashboard&locale=${locale}`);await page.getByRole('button',{name:/Manage Participants|ניהול משתתפים/}).click();await page.getByRole('button',{name:catalogs[locale].common.edit,exact:true}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`dashboard overflow ${locale} ${width}`);
  await page.screenshot({path:path.join(out,`dashboard-${locale}-${width}.png`),fullPage:true});results.push(`dashboard ${locale} ${width}: participant manager rendered without overflow`);
 }
 await page.goto(`${origin}/?page=dashboard&locale=en`);await page.getByRole('button',{name:/Manage Participants/}).click();
 await page.getByRole('button',{name:'Edit',exact:true}).click();const input=page.getByRole('textbox',{name:catalogs.en.dashboard.participantName});await input.fill('Replacement learner');
 await page.evaluate(()=>{window.__audit.delaySave=300;window.__audit.failSave=true});await page.getByRole('button',{name:'Save',exact:true}).click();assert.equal(await input.isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Cancel',exact:true}).isDisabled(),true);
 await page.getByText(catalogs.en.dashboard.claimSaveError,{exact:true}).waitFor();assert.equal(await input.inputValue(),'Replacement learner');
 await page.evaluate(()=>{window.__audit.failSave=false});await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByText('Replacement learner',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.__audit.patches.length),2);
 await page.getByRole('button',{name:'Edit',exact:true}).click();await input.fill('Discarded');await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByText('Replacement learner',{exact:true}).waitFor();
 page.on('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Reset',exact:true}).click();await page.getByText('No participants yet',{exact:true}).waitFor();results.push('dashboard edit: pending controls, failed-save feedback, retry, cancel, reset');
 await page.goto(`${origin}/?page=dashboard&signedOut=1`);await page.getByRole('link',{name:catalogs.en.dashboard.signIn}).waitFor();results.push('dashboard signed-out sign-in recovery');
 for(const locale of ['en','he','es','fr']){
  await page.goto(`${origin}/?page=login&signedOut=1&locale=${locale}&redirect=%2Fhe%2Fdashboard%3Ftab%3Dlearning`);
  const email=page.getByRole('textbox',{name:catalogs[locale].auth.emailPlaceholder});await email.fill('audit@example.test');
  await email.press('Enter');await page.keyboard.press('Enter');assert.equal(await email.isDisabled(),true);
  await page.getByText(catalogs[locale].auth.checkEmail,{exact:true}).waitFor();
  const requests=await page.evaluate(()=>window.__audit.signInRequests);assert.equal(requests.length,1);assert.equal(requests[0].redirect,'/dashboard?tab=learning');
  await page.getByRole('button',{name:catalogs[locale].auth.useDifferentEmail}).click();assert.equal(await email.inputValue(),'');
  results.push(`login ${locale}: labelled email, repeated Enter guarded, destination preserved, reset`);
 }
 await page.goto(`${origin}/?page=login&redirect=%2Fen%2F%2Fexample.test`);await page.waitForFunction(()=>window.__audit.redirect==='/dashboard');results.push('login rejects locale-prefixed external redirect');
 await page.addInitScript(()=>localStorage.setItem('lzecher_email_for_signin','audit@example.test'));
 await page.goto(`${origin}/?page=login&signedOut=1&finishSignIn=1`);await page.waitForFunction(()=>window.__audit.profileWrite);
 const profile=await page.evaluate(()=>window.__audit.profileWrite);
 const ruleSource=fs.readFileSync('firebase/lzecher-firestore.rules','utf8');
 const allowed=[...ruleSource.split('function userWritableKeys()')[1].split('];')[0].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.ok(Object.keys(profile.data).every(key=>allowed.includes(key)));assert.equal(profile.options.merge,true);results.push('first-login profile writes only keys allowed by repository rules, using merge');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));console.log(JSON.stringify({passed:results.length,results,errors},null,2));
}finally{await browser.close();await new Promise(r=>server.close(r));}
