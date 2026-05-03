export const HADRAN_TEXT = {
  he: `הדרן עלך ועלן דעתך. לא נתנשי מינך ולא תתנשי מינן, לא בעלמא הדין ולא בעלמא דאתי.`,
  en: `We shall return to you, and you shall return to us. We shall not forget you, and you shall not forget us — not in this world, and not in the world to come.`,
  es: `Volveremos a ti, y tu volveras a nosotros. No te olvidaremos, y no nos olvidaras — ni en este mundo, ni en el mundo venidero.`,
  fr: `Nous reviendrons vers toi, et tu reviendras vers nous. Nous ne t'oublierons pas, et tu ne nous oublieras pas — ni dans ce monde, ni dans le monde a venir.`,
};

export function checkSiyumEligible(project: { totalPortions: number; completedPortions: number }): boolean {
  return project.totalPortions > 0 && project.completedPortions >= project.totalPortions;
}

export function getCompletionPercentage(project: { totalPortions: number; completedPortions: number }): number {
  if (project.totalPortions === 0) return 0;
  return Math.round((project.completedPortions / project.totalPortions) * 100);
}

export function getMilestone(pct: number): 'none' | '25' | '50' | '75' | '100' {
  if (pct >= 100) return '100';
  if (pct >= 75) return '75';
  if (pct >= 50) return '50';
  if (pct >= 25) return '25';
  return 'none';
}
