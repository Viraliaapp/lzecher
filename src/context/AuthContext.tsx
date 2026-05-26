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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;

    const unsub = onSnapshot(
      doc(db, "lzecher_users", user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile({ uid: user.uid, ...snap.data() } as UserProfile);
        } else {
          setProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
          });
        }
        resolveLoading();
      },
      (error) => {
        // Firestore profile read failed.
        console.error("[auth] Firestore profile error:", error);
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

    return unsub;
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
