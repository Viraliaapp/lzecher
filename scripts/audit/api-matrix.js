// Public API endpoint matrix against production
const https = require("https");
const path = require("path");
const fs = require("fs");

function req(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const opts = {
      method,
      hostname: "lzecher.com",
      path,
      headers: { "Content-Type": "application/json", ...headers },
    };
    const r = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data.slice(0, 200) }));
    });
    r.on("error", (e) => resolve({ status: 0, body: e.message }));
    if (body) r.write(typeof body === "string" ? body : JSON.stringify(body));
    r.end();
  });
}

const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

(async () => {
  // GET /api/version
  let r = await req("GET", "/api/version");
  log(`GET /api/version → ${r.status} ${r.body.startsWith("{") ? "JSON" : "HTML/other"}`);

  // POST /api/claims unauth, missing fields
  r = await req("POST", "/api/claims", {});
  log(`POST /api/claims (empty body) → ${r.status} ${r.body}`);

  // POST /api/claims malformed
  r = await req("POST", "/api/claims", { portionId: "fake", projectId: "fake", claimerName: "x" });
  log(`POST /api/claims (bad ids) → ${r.status} ${r.body}`);

  // POST /api/claims/bulk unauth
  r = await req("POST", "/api/claims/bulk", {});
  log(`POST /api/claims/bulk (empty body) → ${r.status} ${r.body}`);

  // POST /api/claims/complete unauth
  r = await req("POST", "/api/claims/complete", {});
  log(`POST /api/claims/complete (empty body, no auth) → ${r.status} ${r.body}`);

  // GET /api/claims/preview-bulk
  r = await req("GET", "/api/claims/preview-bulk?projectId=foo&scope=masechta&scopeId=bar");
  log(`GET /api/claims/preview-bulk → ${r.status} ${r.body}`);

  // POST /api/cron/send-reminders no auth
  r = await req("POST", "/api/cron/send-reminders");
  log(`POST /api/cron/send-reminders (no Bearer) → ${r.status} ${r.body}`);

  // GET /api/claims/mark-complete-via-link no token
  r = await req("GET", "/api/claims/mark-complete-via-link");
  log(`GET /api/claims/mark-complete-via-link (no token) → ${r.status} ${r.body}`);

  // GET /api/claims/mark-complete-via-link bad token
  r = await req("GET", "/api/claims/mark-complete-via-link?token=invalidtoken");
  log(`GET /api/claims/mark-complete-via-link (bad token) → ${r.status} ${r.body}`);

  // POST /api/feedback (likely public for anon feedback)
  r = await req("POST", "/api/feedback", {});
  log(`POST /api/feedback (empty body) → ${r.status} ${r.body}`);

  // POST /api/send-magic-link
  r = await req("POST", "/api/send-magic-link", {});
  log(`POST /api/send-magic-link (empty body) → ${r.status} ${r.body}`);

  // POST /api/projects/create no auth
  r = await req("POST", "/api/projects/create", {});
  log(`POST /api/projects/create (no auth) → ${r.status} ${r.body}`);

  // POST /api/admin/projects/x (no auth)
  r = await req("POST", "/api/admin/projects/foo", {});
  log(`POST /api/admin/projects/foo (no auth) → ${r.status} ${r.body}`);

  // POST /api/seed/portions (no auth — should be admin-only)
  r = await req("POST", "/api/seed/portions", {});
  log(`POST /api/seed/portions (no auth) → ${r.status} ${r.body}`);

  // POST /api/unsubscribe
  r = await req("POST", "/api/unsubscribe", {});
  log(`POST /api/unsubscribe (empty) → ${r.status} ${r.body}`);

  // POST /api/dashboard
  r = await req("POST", "/api/dashboard", {});
  log(`POST /api/dashboard (no auth) → ${r.status} ${r.body}`);

  fs.writeFileSync(path.join(__dirname, "..", "screenshots", "api-matrix.txt"), REPORT.join("\n"));
})();
