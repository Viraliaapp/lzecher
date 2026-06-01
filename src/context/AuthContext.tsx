"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { onAuthChange, logout, type User } from "@/lib/firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  permissions?: string[];
  createdAt?: number;
  language?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
});

async function roleClaims(user: User) {
  try {
    const token = await user.getIdTokenResult(true);
    const claims = token.claims as {
      isAdmin?: unknown;
      isSuperAdmin?: unknown;
      lzecherPermissions?: unknown;
    };
    return {
      isAdmin: claims.isAdmin === true,
      isSuperAdmin: claims.isSuperAdmin === true,
      permissions: Array.isArray(claims.lzecherPermissions)
        ? claims.lzecherPermissions.filter((permission): permission is string => typeof permission === "string")
        : undefined,
    };
  } catch {
    return { isAdmin: false, isSuperAdmin: false, permissions: undefined };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const resolved = useRef(false);

  function resolveLoading() {
    if (!resolved.current) {
      resolved.current = true;
      setLoading(false);
    }
  }

  useEffect(() => {
    // Safety timeout: if auth hasn't resolved within 8s, force logged-out state.
    // This self-heals corrupt IndexedDB / stale token situations that previously
    // caused an infinite spinner requiring manual cookie clearing.
    const timeout = setTimeout(() => {
      if (!resolved.current) {
        console.warn("[auth] 8s timeout — forcing logged-out state");
        setUser(null);
        setProfile(null);
        resolveLoading();
        logout().catch(() => {});
      }
    }, 8000);

    const unsub = onAuthChange((firebaseUser) => {
      clearTimeout(timeout);
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        resolveLoading();
      }
    });

    return () => {
      clearTimeout(timeout);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const unsub = onSnapshot(
      doc(db, "lzecher_users", user.uid),
      async (snap) => {
        const claims = await roleClaims(user);
        if (cancelled) return;
        const profileData = snap.exists()
          ? ({ uid: user.uid, ...snap.data() } as UserProfile)
          : ({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          } as UserProfile);
        setProfile({
          ...profileData,
          isAdmin: Boolean(profileData.isAdmin || claims.isAdmin || claims.isSuperAdmin),
          isSuperAdmin: Boolean(profileData.isSuperAdmin || claims.isSuperAdmin),
          permissions: Array.isArray(profileData.permissions) ? profileData.permissions : claims.permissions,
        });
        resolveLoading();
      },
      async (error) => {
        // Firestore profile read failed.
        const expectedFallback = error.code === "permission-denied" || error.code === "unauthenticated";
        if (!expectedFallback) {
          console.error("[auth] Firestore profile error:", error);
        }
        const claims = await roleClaims(user);
        if (!cancelled && (claims.isAdmin || claims.isSuperAdmin)) {
          setProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            isAdmin: Boolean(claims.isAdmin || claims.isSuperAdmin),
            isSuperAdmin: claims.isSuperAdmin,
            permissions: claims.permissions,
          });
        }
        resolveLoading();
        // 'unauthenticated' = Firebase explicitly rejected the ID token (stale /
        // revoked) → sign out and self-heal.
        // 'permission-denied' is NOT forced-logout: it can be transient (App Check
        // token not ready on fresh page load) and must not kick out a valid user.
        if (error.code === "unauthenticated") {
          logout().catch(() => {});
        }
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
