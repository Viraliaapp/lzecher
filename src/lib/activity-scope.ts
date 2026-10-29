import { MASECHTOS } from "./seed-data";
import { learningScopeLabel } from "./learning-label";
type Parent = { scope?: string; scopeId?: string; trackType?: string; projectId?: string; userName?: string; userId?: string };
export function activityScopeLabel(parent: Parent | undefined, count: number) {
  if (!parent) return undefined;
  const { scope, scopeId, trackType } = parent;
  const matches = (a: string, b?: string) => a.toLowerCase() === b?.toLowerCase();
  let expected = 0;
  if (trackType === "mishnayos") {
    if (scope === "shas") expected = MASECHTOS.reduce((n, m) => n + m.perakim, 0);
    if (scope === "seder") expected = MASECHTOS.filter(m => matches(m.seder, scopeId) || matches(m.sederHebrew, scopeId)).reduce((n, m) => n + m.perakim, 0);
    if (scope === "masechta") expected = MASECHTOS.find(m => [m.id, m.name, m.nameHebrew].some(n => matches(n, scopeId)))?.perakim || 0;
  }
  if (trackType === "tehillim") {
    if (scope === "whole_tehillim") expected = 150;
    if (scope === "tehillim_book") expected = [0, 41, 31, 17, 17, 44][Number(scopeId)] || 0;
  }
  if (!expected || count !== expected) return undefined;
  const he = learningScopeLabel("he", scope, scopeId, trackType, count);
  const en = learningScopeLabel("en", scope, scopeId, trackType, count);
  return { he: `את ${he}`, en, es: scope === "whole_tehillim" ? "todo Tehilim" : `el ${en}`, fr: scope === "whole_tehillim" ? "tout le Tehilim" : `le ${en}` };
}
