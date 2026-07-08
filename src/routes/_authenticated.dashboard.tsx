import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Category = { name: string; slug: string; iconUrl?: string };

function Dashboard() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Record<string, Category>>({});

  useEffect(() => {
    const unsub = onValue(ref(getFirebaseDb(), "categories"), (snap) => {
      setCategories((snap.val() as Record<string, Category>) ?? {});
    });
    return () => unsub();
  }, []);

  const entries = Object.entries(categories);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome back{user?.displayName ? `, ${user.displayName}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">Pick a category and start a quiz.</p>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No categories yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ask an admin to create categories and publish quizzes.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([id, c]) => (
            <Link
              key={id}
              to="/categories/$slug"
              params={{ slug: c.slug }}
              className="block rounded-xl border bg-card p-6 transition hover:border-primary/50 hover:shadow-sm"
            >
              <div className="mb-3 h-10 w-10 rounded-lg bg-primary/10" />
              <div className="font-medium">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">Open category →</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
