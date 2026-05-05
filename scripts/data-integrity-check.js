/**
 * Data Integrity Check Script for Lzecher Platform
 * Run with: npx dotenv-cli -e .env.local -- npx tsx scripts/data-integrity-check.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey,
  }),
});

const db = getFirestore();

function separator(title) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function subsection(title) {
  console.log(`\n── ${title} ──`);
}

async function sampleFields(collectionName, limit = 10) {
  const snap = await db.collection(collectionName).limit(limit).get();
  const fieldSet = new Set();
  const docs = [];
  snap.forEach(doc => {
    const data = doc.data();
    Object.keys(data).forEach(k => fieldSet.add(k));
    docs.push({ id: doc.id, data });
  });
  return { fields: Array.from(fieldSet).sort(), docs, total: snap.size };
}

async function main() {
  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 1: Field sampling per collection
  // ─────────────────────────────────────────────────────────────────────────
  separator('SECTION 1: Field Sampling (up to 10 docs per collection)');

  const collections = [
    'lzecher_projects',
    'lzecher_portions',
    'lzecher_claims',
    'lzecher_users',
    'lzecher_scheduled_emails',
  ];

  for (const col of collections) {
    subsection(col);
    try {
      const { fields, total } = await sampleFields(col);
      console.log(`  Docs sampled: ${total}`);
      console.log(`  Fields present: ${fields.length > 0 ? fields.join(', ') : '(none)'}`);
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 2: Project counter drift
  // ─────────────────────────────────────────────────────────────────────────
  separator('SECTION 2: Project Counter Drift');

  const projectsSnap = await db.collection('lzecher_projects').get();
  const allProjects = [];
  projectsSnap.forEach(doc => allProjects.push({ id: doc.id, ...doc.data() }));

  console.log(`\n  Total projects found: ${allProjects.length}`);

  if (allProjects.length === 0) {
    console.log('  No projects to check.');
  } else {
    // Fetch all portions grouped by projectId
    const portionsSnap = await db.collection('lzecher_portions').get();
    const portionsByProject = {};
    portionsSnap.forEach(doc => {
      const d = doc.data();
      const pid = d.projectId;
      if (!portionsByProject[pid]) portionsByProject[pid] = [];
      portionsByProject[pid].push({ id: doc.id, ...d });
    });

    let driftFound = false;

    for (const proj of allProjects) {
      const portions = portionsByProject[proj.id] || [];
      const actualTotal = portions.length;
      const actualClaimed = portions.filter(p => p.status !== 'available').length;
      const actualCompleted = portions.filter(p => p.status === 'completed').length;

      const storedTotal = proj.totalPortions ?? null;
      const storedClaimed = proj.claimedPortions ?? null;
      const storedCompleted = proj.completedPortions ?? null;

      const totalDrift = storedTotal !== null && storedTotal !== actualTotal;
      const claimedDrift = storedClaimed !== null && storedClaimed !== actualClaimed;
      const completedDrift = storedCompleted !== null && storedCompleted !== actualCompleted;

      if (totalDrift || claimedDrift || completedDrift) {
        driftFound = true;
        console.log(`\n  PROJECT: ${proj.id} (${proj.nameHebrew || proj.name || 'unnamed'})`);
        if (totalDrift) {
          console.log(`    DRIFT totalPortions:     stored=${storedTotal}  actual=${actualTotal}  diff=${actualTotal - storedTotal}`);
        }
        if (claimedDrift) {
          console.log(`    DRIFT claimedPortions:   stored=${storedClaimed}  actual=${actualClaimed}  diff=${actualClaimed - storedClaimed}`);
        }
        if (completedDrift) {
          console.log(`    DRIFT completedPortions: stored=${storedCompleted}  actual=${actualCompleted}  diff=${actualCompleted - storedCompleted}`);
        }
      } else {
        console.log(`  OK  ${proj.id} (${proj.nameHebrew || proj.name || 'unnamed'}) — total=${actualTotal} claimed=${actualClaimed} completed=${actualCompleted}`);
      }
    }

    if (!driftFound) {
      console.log('\n  All project counters match actual portion counts. No drift detected.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 3: claimMode field on all portions
  // ─────────────────────────────────────────────────────────────────────────
  separator('SECTION 3: Portions Missing claimMode Field');

  {
    const portionsSnap2 = await db.collection('lzecher_portions').get();
    let missing = 0;
    const missingIds = [];
    portionsSnap2.forEach(doc => {
      const d = doc.data();
      if (d.claimMode === undefined || d.claimMode === null) {
        missing++;
        if (missingIds.length < 20) missingIds.push(doc.id);
      }
    });
    console.log(`\n  Total portions: ${portionsSnap2.size}`);
    if (missing === 0) {
      console.log('  All portions have claimMode set.');
    } else {
      console.log(`  MISSING claimMode on ${missing} portions`);
      console.log(`  Sample IDs: ${missingIds.join(', ')}${missing > 20 ? ` ... (+${missing - 20} more)` : ''}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 4: duration field on all claims
  // ─────────────────────────────────────────────────────────────────────────
  separator('SECTION 4: Claims Missing duration Field');

  {
    const claimsSnap = await db.collection('lzecher_claims').get();
    let missing = 0;
    const missingIds = [];
    claimsSnap.forEach(doc => {
      const d = doc.data();
      if (d.duration === undefined || d.duration === null) {
        missing++;
        if (missingIds.length < 20) missingIds.push(doc.id);
      }
    });
    console.log(`\n  Total claims: ${claimsSnap.size}`);
    if (missing === 0) {
      console.log('  All claims have duration set.');
    } else {
      console.log(`  MISSING duration on ${missing} claims`);
      console.log(`  Sample IDs: ${missingIds.join(', ')}${missing > 20 ? ` ... (+${missing - 20} more)` : ''}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 5: familyNameHebrew on all projects
  // ─────────────────────────────────────────────────────────────────────────
  separator('SECTION 5: Projects Missing familyNameHebrew Field');

  {
    const projectsSnap2 = await db.collection('lzecher_projects').get();
    let missing = 0;
    const missingIds = [];
    projectsSnap2.forEach(doc => {
      const d = doc.data();
      if (!d.familyNameHebrew) {
        missing++;
        if (missingIds.length < 20) missingIds.push(`${doc.id} (${d.nameHebrew || d.name || 'unnamed'})`);
      }
    });
    console.log(`\n  Total projects: ${projectsSnap2.size}`);
    if (missing === 0) {
      console.log('  All projects have familyNameHebrew set.');
    } else {
      console.log(`  MISSING familyNameHebrew on ${missing} projects:`);
      missingIds.forEach(id => console.log(`    - ${id}`));
      if (missing > 20) console.log(`    ... (+${missing - 20} more)`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SECTION 6: Orphaned claims (portionId references non-existent portion)
  // ─────────────────────────────────────────────────────────────────────────
  separator('SECTION 6: Orphaned Claims');

  {
    const portionsSnap3 = await db.collection('lzecher_portions').get();
    const portionIds = new Set();
    portionsSnap3.forEach(doc => portionIds.add(doc.id));

    const claimsSnap2 = await db.collection('lzecher_claims').get();
    let orphaned = 0;
    const orphanedList = [];
    claimsSnap2.forEach(doc => {
      const d = doc.data();
      if (d.portionId && !portionIds.has(d.portionId)) {
        orphaned++;
        if (orphanedList.length < 20) {
          orphanedList.push(`claim ${doc.id} -> missing portion ${d.portionId}`);
        }
      }
    });

    console.log(`\n  Total claims checked: ${claimsSnap2.size}`);
    console.log(`  Total portion IDs in index: ${portionIds.size}`);
    if (orphaned === 0) {
      console.log('  No orphaned claims found.');
    } else {
      console.log(`  ORPHANED CLAIMS: ${orphaned}`);
      orphanedList.forEach(s => console.log(`    - ${s}`));
      if (orphaned > 20) console.log(`    ... (+${orphaned - 20} more)`);
    }
  }

  separator('CHECK COMPLETE');
  console.log('');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
