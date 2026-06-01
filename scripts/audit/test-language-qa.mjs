import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const superAdminEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "solomon2145@gmail.com";

function initAdmin() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher language QA audit");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function idTokenForEmail(email) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");
  const user = await admin.auth().getUserByEmail(email);
  const customToken = await admin.auth().createCustomToken(user.uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.idToken) {
    throw new Error(`Could not create id token for ${email}: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function post(pathname, body) {
  const res = await fetch(`${origin}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

async function main() {
  initAdmin();
  const idToken = await idTokenForEmail(superAdminEmail);

  const res = await post("/api/admin/super/translations", { idToken });
  assert(res.status === 200, `Language QA endpoint failed: ${res.status} ${res.text}`);

  for (const locale of res.json?.locales || []) {
    assert(locale.missingKeys.length === 0, `${locale.locale} has missing translation keys: ${locale.missingKeys.join(", ")}`);
    assert(locale.emptyKeys.length === 0, `${locale.locale} has empty translation keys: ${locale.emptyKeys.join(", ")}`);
    assert(locale.forbiddenHits.length === 0, `${locale.locale} has forbidden Hebrew copy: ${JSON.stringify(locale.forbiddenHits)}`);
  }

  assert(
    Array.isArray(res.json?.forbiddenPhrases) &&
      res.json.forbiddenPhrases.includes("ניהול תביעות") &&
      res.json.forbiddenPhrases.includes("המתמידים"),
    "Language QA must keep guarding previously rejected Hebrew wording"
  );
  assert(
    (res.json?.hebrewEnglishSamples || []).length === 0,
    `Hebrew copy still has mixed-language review samples: ${JSON.stringify(res.json?.hebrewEnglishSamples)}`
  );

  console.log(`Language QA passed for ${origin}`);
  console.log("Hebrew English review samples: 0");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
