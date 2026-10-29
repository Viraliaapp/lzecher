import test, { before } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { MemoryFirestore } from "./support/fake-firestore";
import { computeProgress, progressFromProject } from "../../src/lib/progress";
import { getRecentActivity } from "../../src/lib/recent-activity";
import { activityScopeLabel } from "../../src/lib/activity-scope";
import { runLearningTransaction } from "../../src/lib/learning-transaction";
const now=Date.now(), day=86400000;
const state={db:new MemoryFirestore(), sent:[] as any[]};
(globalThis as any).__recovery=state;
let sender:any;
before(async()=>{
 process.env.REMINDER_ACTION_SECRET="isolated-recovery-test-secret";
 const out=path.resolve(".next/audit-unit/recovery-sender.cjs");fs.mkdirSync(path.dirname(out),{recursive:true});
 await build({entryPoints:["src/lib/reminder-sender.ts"],outfile:out,bundle:true,platform:"node",format:"cjs",packages:"external",plugins:[{name:"isolated",setup(b){
  b.onResolve({filter:/firebase\/admin$|^resend$/},a=>({path:a.path,namespace:"mock"}));
  b.onLoad({filter:/.*/,namespace:"mock"},a=>({loader:"js",contents:a.path==="resend"?`export class Resend {emails={send:async(payload,options)=>{globalThis.__recovery.sent.push({payload,options});return {data:{id:'synthetic'},error:null}}}}`:`export const getAdminDb=()=>globalThis.__recovery.db;export const getAdminStorageBucket=()=>{throw new Error('Storage forbidden in tests')};`}));
 }}]});sender=createRequire(import.meta.url)(out);
});
function setup(type="confirmation",extra={}){
 state.sent=[];state.db=new MemoryFirestore().put("lzecher_projects","p",{status:"active",createdBy:"owner",nameHebrew:"Test"})
 .put("lzecher_claims","c",{projectId:"p",status:"active",userEmail:"learner@example.test",durationEndDate:now+30*day,reminderPreferences:["confirmation","halfway","sevenDays"]})
 .put("lzecher_scheduled_emails","e",{status:"pending",type,reminderType:type,toEmail:"learner@example.test",projectId:"p",claimId:"c",createdAt:now,sendAt:now,...extra});
 return state.db.collection("lzecher_scheduled_emails").doc("e") as any;
}
test("mixed-track repeats contribute their real share, not an extra 100 percent",()=>{
 const p=[...Array.from({length:525},(_,i)=>({trackType:"mishnayos",setNumber:1,status:i<219?"claimed":"available"})),...Array.from({length:300},(_,i)=>({trackType:"tehillim",setNumber:i<150?1:2,status:"completed"}))];
 assert.deepEqual(computeProgress(p),{pct:77,completedPct:44,cycles:0,hasTM:true});
 assert.equal(progressFromProject({tracks:["tehillim"],progressPct:150,completedCycles:1}).pct,150);
 assert.equal(computeProgress([{trackType:"tehillim",status:undefined}]).pct,0);
});
test("unknown email types fail closed rather than becoming confirmations",async()=>{const ref=setup("unknown");await sender.sendScheduledReminderNow(ref,now);assert.equal(state.sent.length,0);assert.equal(state.db.data("lzecher_scheduled_emails","e")!.cancelReason,"unsupported_reminder_type");});
test("a month-old confirmation is canceled without sending",async()=>{const ref=setup("confirmation",{createdAt:now-30*day});await sender.sendScheduledReminderNow(ref,now);assert.equal(state.sent.length,0);});
test("creator warning is not sent for a project with any existing claim",async()=>{const ref=setup("creatorZeroClaimsFinalWarning");await sender.sendScheduledReminderNow(ref,now);assert.equal(state.sent.length,0);assert.equal(state.db.data("lzecher_projects","p")!.status,"active");});
test("finished learning never receives a new reminder",async()=>{const ref=setup("halfway");state.db.put("lzecher_claims","c",{projectId:"p",status:"completed"});await sender.sendScheduledReminderNow(ref,now);assert.equal(state.sent.length,0);});
test("concurrent immediate send and cron can send a confirmation only once",async()=>{const ref=setup();await Promise.all([sender.sendScheduledReminderNow(ref,now),sender.sendReadyReminderEmails({now})]);assert.equal(state.sent.length,1);assert.equal(state.sent[0].options.idempotencyKey,"lzecher-reminder-e");assert.equal(state.db.data("lzecher_scheduled_emails","e")!.status,"sent");});
test("future queue entries cannot starve a due reminder",async()=>{setup();for(let i=0;i<100;i++)state.db.put("lzecher_scheduled_emails",`f${i}`,{status:"pending",sendAt:now+day});const r=await sender.sendReadyReminderEmails({now,limit:1});assert.equal(r.sent,1);});
test("autodeletion requires a genuine final warning, never the mislabeled legacy confirmation",async()=>{const ref=setup("creatorZeroClaimsAutoDelete");state.db.records.delete("lzecher_claims/c");state.db.put("lzecher_scheduled_emails","p_creatorZeroClaimsFinalWarning",{status:"sent",sentAt:now-4*day});await sender.sendScheduledReminderNow(ref,now);assert.equal(state.sent.length,0);assert.equal(state.db.data("lzecher_projects","p")!.status,"active");assert.equal(state.db.data("lzecher_scheduled_emails","e")!.cancelReason,"valid_final_warning_required");});
test("soft-deleted project activity is excluded",async()=>{setup();state.db.put("lzecher_claims","c",{projectId:"p",trackType:"tehillim",status:"active",userName:"Learner",claimedAt:now});state.db.put("lzecher_projects","p",{status:"deleted"});assert.deepEqual(await getRecentActivity(state.db.asFirestore(),now),[]);});
test("scope wording is only used when all chapters of the scope remain reserved",()=>{const p={trackType:"mishnayos",scope:"masechta",scopeId:"Avot"};assert.equal(activityScopeLabel(p,4),undefined);assert.ok(activityScopeLabel({trackType:"tehillim",scope:"whole_tehillim"},150)?.he.includes("תהילים"));assert.equal(activityScopeLabel({trackType:"tehillim",scope:"whole_tehillim"},149),undefined);});

test("closed transaction retries are bounded and unrelated errors are never swallowed",async()=>{
 let attempts=0;
 const db={runTransaction:async()=>{if(++attempts<3)throw {code:3,details:"Transaction is invalid or closed."};return "ok";}} as any;
 assert.equal(await runLearningTransaction(db,async()=>null),"ok");assert.equal(attempts,3);
 attempts=0;db.runTransaction=async()=>{attempts++;throw {code:3,details:"Invalid document path"};};
 await assert.rejects(runLearningTransaction(db,async()=>null));assert.equal(attempts,1);
});

test("overdue creator stages do not send three warnings at once",async()=>{
 const ref=setup("creatorZeroClaimsTwoWeeks");state.db.records.delete("lzecher_claims/c");
 state.db.put("lzecher_scheduled_emails","later",{projectId:"p",reminderType:"creatorZeroClaimsFinalWarning",status:"pending",sendAt:now});
 await sender.sendScheduledReminderNow(ref,now);assert.equal(state.sent.length,0);
 assert.equal(state.db.data("lzecher_scheduled_emails","e")!.cancelReason,"superseded_creator_warning");
});

test("a changed recipient cannot receive a stale prepared email",async()=>{
 const ref=setup();state.db.put("lzecher_claims","c",{projectId:"p",status:"active",userEmail:"new@example.test"});
 await sender.sendScheduledReminderNow(ref,now);assert.equal(state.sent.length,0);
 assert.equal(state.db.data("lzecher_scheduled_emails","e")!.cancelReason,"recipient_changed");
});
