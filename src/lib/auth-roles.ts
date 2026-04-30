import { getAdminAuth } from "./firebase/admin";

export async function verifyToken(idToken: string) {
  const auth = getAdminAuth();
  return auth.verifyIdToken(idToken);
}

export async function requireAdmin(idToken: string) {
  const decoded = await verifyToken(idToken);
  if (!decoded.isAdmin && !decoded.isSuperAdmin) {
    throw new Error("FORBIDDEN:Admin access required");
  }
  return decoded;
}

export async function requireSuperAdmin(idToken: string) {
  const decoded = await verifyToken(idToken);
  if (!decoded.isSuperAdmin) {
    throw new Error("FORBIDDEN:Super admin access required");
  }
  return decoded;
}
