import type { DecodedIdToken } from "firebase-admin/auth";
import { getAdminAuth, getAdminDb } from "./firebase/admin";

export type LzecherDecodedToken = DecodedIdToken & {
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  lzecherPermissions?: string[];
};

export async function verifyToken(idToken: string): Promise<LzecherDecodedToken> {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);

  try {
    const profile = await getAdminDb().collection("lzecher_users").doc(decoded.uid).get();
    if (!profile.exists) return decoded as LzecherDecodedToken;

    const data = profile.data() || {};
    const hasProfileAdmin = typeof data.isAdmin === "boolean";
    const hasProfileSuperAdmin = typeof data.isSuperAdmin === "boolean";
    const permissions = Array.isArray(data.permissions)
      ? data.permissions.filter((permission): permission is string => typeof permission === "string")
      : undefined;

    return {
      ...decoded,
      isAdmin: hasProfileAdmin ? data.isAdmin : Boolean(decoded.isAdmin),
      isSuperAdmin: hasProfileSuperAdmin ? data.isSuperAdmin : Boolean(decoded.isSuperAdmin),
      ...(permissions ? { lzecherPermissions: permissions } : {}),
    } as LzecherDecodedToken;
  } catch {
    return decoded as LzecherDecodedToken;
  }
}

export async function requireAdmin(idToken: string, permission?: string) {
  const decoded = await verifyToken(idToken);
  if (!decoded.isAdmin && !decoded.isSuperAdmin) {
    throw new Error("FORBIDDEN:Admin access required");
  }
  if (permission && !hasAdminPermission(decoded, permission)) {
    throw new Error("FORBIDDEN:Missing admin permission");
  }
  return decoded;
}

export function hasAdminPermission(decoded: LzecherDecodedToken, permission: string): boolean {
  if (decoded.isSuperAdmin) return true;
  return Boolean(
    decoded.isAdmin &&
    Array.isArray(decoded.lzecherPermissions) &&
    decoded.lzecherPermissions.includes(permission)
  );
}

export async function requireSuperAdmin(idToken: string) {
  const decoded = await verifyToken(idToken);
  if (!decoded.isSuperAdmin) {
    throw new Error("FORBIDDEN:Super admin access required");
  }
  return decoded;
}
