import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, update } from "firebase/database";
import { toast } from "sonner";
import { getFirebaseDb } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: UsersAdmin,
});

type UserRow = { email: string; displayName?: string; role: "user" | "admin" };

function UsersAdmin() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<Record<string, UserRow>>({});

  useEffect(() => {
    const unsub = onValue(ref(getFirebaseDb(), "users"), (s) => setUsers(s.val() ?? {}));
    return () => unsub();
  }, []);

  async function setRole(uid: string, role: "user" | "admin") {
    try {
      await update(ref(getFirebaseDb(), `users/${uid}`), { role });
      toast.success(`Role set to ${role}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const rows = Object.entries(users);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">Grant or revoke admin access.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{rows.length} accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {rows.map(([uid, u]) => (
              <li key={uid} className="flex items-center gap-3 py-3">
                <div className="flex-1">
                  <div className="font-medium">{u.displayName || u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    u.role === "admin"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {u.role}
                </span>
                {uid !== me?.uid && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setRole(uid, u.role === "admin" ? "user" : "admin")}
                  >
                    {u.role === "admin" ? "Demote" : "Promote"}
                  </Button>
                )}
              </li>
            ))}
            {rows.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">No users yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
