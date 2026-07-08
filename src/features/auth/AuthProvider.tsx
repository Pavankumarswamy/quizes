import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { getFirebaseAuth, getFirebaseDb, isFirebaseConfigured } from "@/lib/firebase";

export type Role = "user" | "admin";

type AuthState = {
  user: User | null;
  role: Role | null;
  loading: boolean;
  configured: boolean;
};

const AuthContext = createContext<AuthState>({
  user: null,
  role: null,
  loading: true,
  configured: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !isFirebaseConfigured) return;
    const db = getFirebaseDb();
    const roleRef = ref(db, `users/${user.uid}/role`);
    const unsub = onValue(
      roleRef,
      (snap) => {
        const val = snap.val() as Role | null;
        setRole(val ?? "user");
        setLoading(false);
      },
      () => {
        setRole("user");
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, role, loading, configured: isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
