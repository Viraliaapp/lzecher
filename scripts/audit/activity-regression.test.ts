import test from "node:test";
import assert from "node:assert/strict";
import { MemoryFirestore } from "./support/fake-firestore";
import { getRecentActivity } from "../../src/lib/recent-activity";
import { recentActivityEvents } from "../../src/lib/activity-events";
import { reserveClaims } from "../../src/lib/claim-writes";
import { manageClaim } from "../../src/lib/claim-management";
import { activitySentence, unitLabel } from "../../src/lib/activity-format";

const now = 1793012400000;
const values = { userId: "anonymous", userName: "Learner", userEmail: "private@example.test", claimedAt: now, status: "active" };
function fixture(count = 1) {
  const db = new MemoryFirestore().put("lzecher_projects", "p", { createdBy: "owner", status: "active", nameHebrew: "Memorial" });
  for (let n = 0; n < count; n++) db.put("lzecher_portions", `portion-${n}`, { projectId: "p", trackType: "mishnayos", reference: `Bava Kamma ${n+1}`, status: "available" });
  return db;
}

test("actual reservation writer -> activity -> localized popup contract counts all 525 chapters", async () => {
  const db = fixture(525);
  await reserveClaims(db.asFirestore(), "p", Array.from({length:525},(_,n)=>`portion-${n}`), values,
    {access:true,parentId:"bulk",parent:{trackType:"mishnayos",scope:"shas"}});
  const events = await getRecentActivity(db.asFirestore(), now);
  assert.equal(events.length,1); assert.equal(events[0].count,525);
  assert.equal(recentActivityEvents(events,now).length,1);
  assert.match(activitySentence(events[0],"en"),/Shas Mishnayos/);
  assert.equal(JSON.stringify(events).includes("private@example.test"),false);
});

test("separate reservations in the same second stay separate and stable", async () => {
  const db=fixture(2);
  await reserveClaims(db.asFirestore(),"p",["portion-0"],values,{access:true});
  await reserveClaims(db.asFirestore(),"p",["portion-1"],values,{access:true});
  const events=await getRecentActivity(db.asFirestore(),now);
  assert.equal(events.length,2);assert.ok(events.every(e=>e.count===1));
  assert.equal(new Set(events.map(e=>e.id)).size,2);
  assert.deepEqual(await getRecentActivity(db.asFirestore(),now),events);
});

test("mixed-track bulk counts honor renamed/deleted children, not stale parent summaries", async () => {
  const db=fixture(3);
  db.put("lzecher_portions","portion-2",{projectId:"p",trackType:"tehillim",reference:"Tehillim 1",status:"available"});
  const reserved=await reserveClaims(db.asFirestore(),"p",["portion-0","portion-1","portion-2"],values,{access:true,parentId:"group",parent:{scope:"multi",trackType:"mishnayos"}});
  assert.deepEqual((await getRecentActivity(db.asFirestore(),now)).map(e=>[e.trackType,e.count]).sort(),[["mishnayos",2],["tehillim",1]]);
  await manageClaim(db.asFirestore(),"p",reserved[0].claimId,{uid:"owner"},{type:"rename",name:"Replacement"});
  await manageClaim(db.asFirestore(),"p",reserved[1].claimId,{uid:"owner"},{type:"delete"});
  const events=await getRecentActivity(db.asFirestore(),now);
  assert.deepEqual(events.map(e=>[e.name,e.count]).sort(),[["Learner",1],["Replacement",1]]);
  for(const c of reserved.filter(r=>r.id!=="portion-1")) await manageClaim(db.asFirestore(),"p",c.claimId,{uid:"owner"},{type:"delete"});
  assert.deepEqual(await getRecentActivity(db.asFirestore(),now),[]);
});

test("interrupted bulk reports only committed children and grows to the exact count", async () => {
  const db=fixture(250),ids=Array.from({length:250},(_,n)=>`portion-${n}`);
  db.failTransaction=2;
  await assert.rejects(reserveClaims(db.asFirestore(),"p",ids,values,{access:true,parentId:"group",parent:{scope:"shas"}}));
  const partial=await getRecentActivity(db.asFirestore(),now);assert.equal(partial[0].count,200);
  db.failTransaction=-1;
  await reserveClaims(db.asFirestore(),"p",ids,values,{access:true,parentId:"group",parent:{scope:"shas"}});
  const complete=await getRecentActivity(db.asFirestore(),now);assert.equal(complete[0].count,250);assert.equal(complete[0].id,partial[0].id);
});

test("future, malformed, canceled and deleted-project activity is omitted", async () => {
  const db=fixture();
  for(const [id,extra] of Object.entries({future:{claimedAt:now+120000},bad:{claimedAt:"bad"},canceled:{status:"cancelled"},missing:{projectId:"missing"},cross:{projectId:"p",parentClaimId:"cross-parent"}})) db.put("lzecher_claims",id,{...values,projectId:"p",trackType:"tehillim",...extra});
  db.put("lzecher_claims","cross-parent",{...values,projectId:"other",trackType:"tehillim",isParent:true,claimedAt:now+1});
  assert.deepEqual(await getRecentActivity(db.asFirestore(),now),[]);
});

test("client validates payloads, deduplicates IDs, sorts new first and retains old activity", () => {
  const valid={id:"one",name:null,count:1,trackType:"tehillim",projectId:"p",honoreeHebrew:"Memorial",honoreeHonorific:"",claimedAt:now};
  assert.deepEqual(recentActivityEvents({},now),[]);
  const input=[valid,{...valid},{...valid,id:"zero",count:0},{...valid,id:"nan",count:NaN},{...valid,id:"old",claimedAt:now-365*24*3600000},{...valid,id:"new",claimedAt:now+1},null,{...valid,id:"name",name:5}];
  assert.deepEqual(recentActivityEvents(input,now).map(e=>e.id),["new","one","old"]);
});

test("old bulk activity retains every chapter and its original timestamp", async () => {
  const db=fixture(120),old=now-365*24*3600000;
  await reserveClaims(db.asFirestore(),"p",Array.from({length:120},(_,n)=>`portion-${n}`),{...values,claimedAt:old},{access:true,parentId:"old-bulk",parent:{scope:"masechta"}});
  const events=await getRecentActivity(db.asFirestore(),now);
  assert.equal(events.length,1);assert.equal(events[0].count,120);assert.equal(events[0].claimedAt,old);
  assert.equal(recentActivityEvents(events,now).length,1);
  assert.doesNotMatch(activitySentence(events[0],"en"),/just now|today|recently/i);
});

test("oversized bulk is omitted instead of publishing a partial count; single events survive the read budget", async () => {
  const db=fixture();
  db.put("lzecher_claims","parent",{...values,projectId:"p",isParent:true,claimedAt:now+1});
  for(let n=0;n<2001;n++) db.put("lzecher_claims",`child-${n}`,{...values,projectId:"p",trackType:"mishnayos",parentClaimId:"parent",claimedAt:now-1});
  db.put("lzecher_claims","single",{...values,projectId:"p",trackType:"tehillim",claimedAt:now});
  const events=await getRecentActivity(db.asFirestore(),now);
  assert.equal(events.length,1);assert.equal(events[0].trackType,"tehillim");assert.equal(events[0].count,1);
});

test("Mishnah reservations are chapters in all four languages; names remain ordinary text", () => {
  for(const [locale,one,many] of [["en","1 perek of Mishnayos","2 perakim of Mishnayos"],["he","פרק אחד","שני פרקים"],["es","1 capítulo de Mishná","2 capítulos de Mishnayot"],["fr","1 chapitre de Michna","2 chapitres de Michna"]]) {
    assert.equal(unitLabel("mishnayos",1,locale),one);assert.equal(unitLabel("mishnayos",2,locale),many);
    assert.ok(activitySentence({name:null,count:1,trackType:"tehillim",honoreeHebrew:"Memorial",honoreeHonorific:""},locale).includes("Memorial"));
  }
});
