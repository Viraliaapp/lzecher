import React, { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NextIntlClientProvider } from "next-intl";
import { ActivityBubbles } from "../../src/components/activity/ActivityBubbles";
import type { ActivityEvent } from "../../src/lib/activity-events";

// Real React, settings hook, popup component, formatter and Framer Motion.
// Only service responses and long application timers are controlled. No live
// credentials, network calls, Firebase SDK or production records are used.
const nativeTimeout = window.setTimeout.bind(window);
const nativeClearTimeout = window.clearTimeout.bind(window);
const nativeInterval = window.setInterval.bind(window);
const nativeClearInterval = window.clearInterval.bind(window);
const sleep = (ms = 20) => new Promise<void>(resolve => nativeTimeout(resolve, ms));
let clock = 0, timerId = 1000000;
const base = 1793012400000;
const timers = new Map<number, { at: number; run: () => void }>();
function schedule(run: () => void, ms: number) {
  const id = ++timerId; timers.set(id, { at: clock + ms, run }); return id;
}
Date.now = () => base + clock;
window.setTimeout = ((fn: () => void, ms = 0, ...args: unknown[]) =>
  [6500, 10000, 20000].includes(ms) ? schedule(fn, ms) : nativeTimeout(fn, ms, ...args)) as typeof window.setTimeout;
window.clearTimeout = ((id: number | undefined) => { if (id != null && !timers.delete(id)) nativeClearTimeout(id); }) as typeof window.clearTimeout;
// Also control the previous implementation's polling interval so the exact
// released component can run through this same before/after browser fixture.
window.setInterval = ((fn: () => void, ms = 0, ...args: unknown[]) => {
  if (ms !== 20000) return nativeInterval(fn, ms, ...args);
  const id = ++timerId;
  const run = () => { timers.set(id, { at: clock + ms, run }); fn(); };
  timers.set(id, { at: clock + ms, run }); return id;
}) as typeof window.setInterval;
window.clearInterval = ((id: number | undefined) => { if (id != null && !timers.delete(id)) nativeClearInterval(id); }) as typeof window.clearInterval;
async function advance(ms: number) {
  await sleep();
  const target = clock + ms;
  for (let steps = 0; steps < 1000; steps++) {
    const due = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) { clock = target; await sleep(); return; }
    clock = due[1].at; timers.delete(due[0]); due[1].run(); await sleep();
  }
  throw new Error("Unexpected timer loop");
}
type Scenario = {
  settingsDelay: number; enabled: boolean; settingsError: boolean; malformedSettings: boolean;
  activityDelay: number; events: unknown; failActivity: boolean; malformedActivity: boolean;
};
type Call = { url: string; aborted: boolean };
let scenario: Scenario, calls: Call[] = [], root: Root | null = null;
const errors: string[] = [];
window.addEventListener("error", e => errors.push(e.message));
window.addEventListener("unhandledrejection", e => errors.push(String(e.reason)));
window.fetch = async (input, options) => {
  const url = String(input), signal = options?.signal;
  if (!["/api/settings", "/api/activity/recent"].includes(url)) throw new Error(`External/unexpected request blocked: ${url}`);
  const call = { url, aborted: false }; calls.push(call);
  const delay = url === "/api/settings" ? scenario.settingsDelay : scenario.activityDelay;
  await new Promise<void>((resolve, reject) => {
    const abort = () => { call.aborted = true; timers.delete(id); reject(new DOMException("Aborted", "AbortError")); };
    const id = schedule(() => { signal?.removeEventListener("abort", abort); resolve(); }, delay);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
  if (url === "/api/settings") return new Response(JSON.stringify(scenario.malformedSettings ? {} : { featureFlags: { activityBubbles: scenario.enabled } }), { status: scenario.settingsError ? 503 : 200 });
  return new Response(JSON.stringify(scenario.malformedActivity ? { events: "invalid" } : { events: scenario.events }), { status: scenario.failActivity ? 503 : 200 });
};
const event = (n: number, extra: Partial<ActivityEvent> = {}): ActivityEvent => ({
  id: `event-${n}`, name: `Learner ${n}`, count: n, trackType: "tehillim", projectId: "fixture",
  honoreeHebrew: "Fixture Memorial", honoreeHonorific: "", claimedAt: base + n, ...extra,
});
const text = () => [...document.querySelectorAll("#fixture [aria-live] p")].map(p => p.textContent || "");
const equal = (a: unknown, b: unknown, label = "value") => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const assert = (value: unknown, label: string) => { if (!value) throw new Error(label); };
async function eventually(predicate: () => boolean, label: string) {
  // Framer Motion uses real animation frames, independent of the controlled
  // application clock. Wait for its observable result instead of a 550ms race
  // against a busy or background browser's animation scheduling.
  for (let n = 0; n < 60; n++) { if (predicate()) return; await sleep(50); }
  assert(predicate(), label);
}
const activityCalls = () => calls.filter(c => c.url === "/api/activity/recent");
async function mount(options: Partial<Scenario> = {}, locale = "en", strict = false) {
  root?.unmount(); await sleep(); timers.clear(); clock = 0; calls = [];
  scenario = { settingsDelay: 0, enabled: true, settingsError: false, malformedSettings: false,
    activityDelay: 0, events: [event(1)], failActivity: false, malformedActivity: false, ...options };
  document.documentElement.lang = locale; document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  root = createRoot(document.getElementById("fixture")!);
  const app = <NextIntlClientProvider locale={locale} messages={{}} timeZone="UTC"><ActivityBubbles /></NextIntlClientProvider>;
  root.render(strict ? <StrictMode>{app}</StrictMode> : app);
  await advance(0);
}
const results: { name: string; passed: boolean; error?: string }[] = [];
function report() {
  document.getElementById("results")!.textContent = JSON.stringify({ running: true, results, errors }, null, 2);
}
async function check(name: string, run: () => Promise<void>) {
  try { await run(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: String(error) }); }
  report();
}

async function run() {
  await check("slow settings: popup gets its full visible lifetime after settings resolve", async () => {
    await mount({ settingsDelay: 8000 }); await advance(7999); equal(text(), []);
    await advance(1); equal(text().length, 1);
    await eventually(() => Number(getComputedStyle(document.querySelector("#fixture [aria-live] p")!.parentElement!).opacity) > 0.99, "Popup must actually be visible");
    await advance(6499); equal(text().length, 1); await advance(1); await eventually(() => text().length === 0, "Popup exits after its full lifetime"); equal(text(), []);
  });
  await check("settings timeout falls back safely instead of hiding popups forever", async () => {
    await mount({ settingsDelay: 30000 }); await advance(10000); equal(calls[0].aborted, true); equal(text().length, 1);
  });
  await check("disabled activity does not fetch or display activity", async () => {
    await mount({ enabled: false }); await advance(60000); equal(activityCalls().length, 0); equal(text(), []);
  });
  await check("disable then enable on navigation starts a fresh, single popup lifecycle", async () => {
    await mount({ enabled: false }); await advance(20000); equal(text(), []);
    await mount({ enabled: true }); equal(text().length, 1); equal(activityCalls().length, 1);
    await mount({ enabled: false }); await advance(20000); equal(text(), []); equal(activityCalls().length, 0);
  });
  await check("partial settings payload retains defaults without crashing", async () => {
    await mount({ malformedSettings: true }); equal(text().length, 1);
  });
  await check("initial feed shows only the newest available event, including activity older than a day", async () => {
    await mount({ events: [event(1), event(3), event(2), event(4, { claimedAt: base - 25 * 3600000 })] });
    assert(text()[0]?.includes("Learner 3"), "Newest event shown"); equal(text().length, 1);
    await mount({ events: [event(1, { claimedAt: base - 25 * 3600000 })] }); equal(text().length, 1);
  });
  await check("year-old latest activity displays once, keeps truthful wording and never repeats on unchanged polls", async () => {
    await mount({ events: [event(1, { claimedAt: base - 365 * 24 * 3600000 })] }); equal(text().length, 1);
    assert(!/just now|today|recently/i.test(text()[0]), "Old activity must not claim to be newly taken");
    await advance(6500); await eventually(() => text().length === 0, "Old popup dismissed");
    for (let n = 0; n < 3; n++) { await advance(20000); equal(text(), []); }
  });
  await check("unchanged polls do not replay an already dismissed popup", async () => {
    await mount(); await advance(6500); await eventually(() => text().length === 0, "Initial popup dismissed"); await advance(13500); equal(text(), []); equal(activityCalls().length, 2);
  });
  await check("new activity after an empty feed appears on the next poll", async () => {
    await mount({ events: [] }); scenario.events = [event(2)]; await advance(20000);
    assert(text()[0]?.includes("Learner 2"), "New event appears");
  });
  await check("burst of eight is queued, capped at three visible, and all eight are displayed", async () => {
    await mount({ events: [] }); scenario.events = Array.from({ length: 8 }, (_, n) => event(n + 1)); await advance(20000);
    const shown = new Set<string>();
    for (let batch = 0; batch < 3; batch++) {
      assert(text().length <= 3, "No more than three visible"); text().forEach(t => shown.add(t));
      equal(text().map(t => Number(t.match(/Learner (\d+)/)?.[1])), Array.from({ length: Math.min(3, 8 - batch * 3) }, (_, n) => batch * 3 + n + 1), "oldest-first burst ordering");
      await advance(6500); await eventually(() => text().length === Math.min(3, Math.max(0, 8 - (batch + 1) * 3)), "Next burst batch has settled");
    }
    equal(shown.size, 8); await advance(20000); equal(text(), []);
  });
  await check("partial bulk count updates while queued without a duplicate event", async () => {
    await mount({ events: [] }); scenario.events = Array.from({ length: 20 }, (_, n) => event(n + 1)); await advance(20000);
    scenario.events = Array.from({ length: 20 }, (_, n) => event(n + 1, n === 19 ? { count: 525 } : {}));
    await advance(20000);
    await advance(19000); await eventually(() => text().length === 2, "Last two queued popups have settled");
    equal(text().filter(t => t.includes("Learner 20")).length, 1);
    assert(text().some(t => t.includes("525 Tehillim chapters")), "Queued count refreshed from the next poll");
  });
  await check("HTTP failures and malformed feeds recover without poisoning seen state", async () => {
    await mount({ failActivity: true }); equal(text(), []); scenario.failActivity = false; scenario.malformedActivity = true;
    await advance(20000); equal(text(), []); scenario.malformedActivity = false; await advance(20000); equal(text().length, 1);
  });
  await check("malformed event entries are ignored; valid entries still display", async () => {
    await mount({ events: [null, {}, event(1, { count: 0 }), event(2), event(3, { name: 12 as unknown as string })] });
    equal(text().length, 1); assert(text()[0].includes("Learner 2"), "Valid event survives");
  });
  await check("hung activity aborts and retries serially, without overlapping requests", async () => {
    await mount({ activityDelay: 30000 }); await advance(10000); equal(activityCalls().length, 1); equal(activityCalls()[0].aborted, true);
    await advance(19999); equal(activityCalls().length, 1); scenario.activityDelay = 0; await advance(1); equal(activityCalls().length, 2); equal(text().length, 1);
  });
  await check("unmount aborts in-flight activity and cancels all application timers", async () => {
    await mount({ activityDelay: 1000 }); root!.unmount(); root = null; await sleep();
    equal(activityCalls()[0].aborted, true); equal(timers.size, 0); const count = calls.length; await advance(60000); equal(calls.length, count);
  });
  await check("StrictMode cleanup and remount do not suppress or duplicate the initial popup", async () => {
    await mount({}, "en", true); equal(text().length, 1);
    await mount({}, "en", true); equal(text().length, 1);
  });
  for (const locale of ["en", "he", "es", "fr"]) await check(`${locale}: real localized chapter wording, direction and safe participant text`, async () => {
    const name = '<img src=x onerror="alert(1)">';
    await mount({ events: [event(2, { name, trackType: "mishnayos" })] }, locale);
    equal(text().length, 1); assert(text()[0].includes(name), "Name rendered as text");
    equal(document.querySelectorAll("#fixture img").length, 0);
    const expected = { en: "2 Mishnah chapters", he: "2 פרקי משניות", es: "2 capítulos de Mishná", fr: "2 chapitres de Michna" }[locale]!;
    assert(text()[0].includes(expected), "Correct chapter unit");
    equal(document.querySelector<HTMLElement>("#fixture [aria-live] p")!.parentElement!.style.direction, locale === "he" ? "rtl" : "ltr");
  });
  await mount({ events: [event(2, { name: "לומד לדוגמה", trackType: "mishnayos", honoreeHebrew: "הנצחה לדוגמה" })] }, "he");
  await eventually(() => Number(getComputedStyle(document.querySelector("#fixture [aria-live] p")!.parentElement!).opacity) > 0.99, "Final preview is visible");
  const result = { running: false, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results, errors,
    coverage: "Actual React component/settings hook/formatter/Framer Motion; synthetic fetch and controlled application timers; no live data." };
  document.getElementById("results")!.textContent = JSON.stringify(result, null, 2);
  document.title = result.failed || errors.length ? "Activity browser tests FAILED" : `Activity browser tests: ${result.passed} passed`;
}
void run().catch(error => { document.getElementById("results")!.textContent = String(error); document.title = "Activity browser fixture FAILED"; });
