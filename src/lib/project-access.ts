/**
 * SERVER-ONLY. Checks whether the current request's device cookie grants access to a
 * password-protected project. Used by the memorial SSR page to gate full detail.
 */
import { cookies } from "next/headers";
import { verifyToken } from "./signed-tokens";

export function accessCookieName(projectId: string): string {
  return `lz_access_${projectId}`;
}

export async function hasProjectAccess(projectId: string): Promise<boolean> {
  try {
    const store = await cookies();
    const raw = store.get(accessCookieName(projectId))?.value;
    if (!raw) return false;
    const payload = verifyToken(raw);
    return Boolean(
      payload && payload.purpose === "project_access" && payload.projectId === projectId
    );
  } catch {
    return false;
  }
}
