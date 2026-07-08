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
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-primary/10 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground bg-clip-text">
            electricwisers
          </h1>
          <div className="text-xs text-muted-foreground leading-normal font-medium">
            SRR Thota, Karimabad Road,<br />
            Warangal, Telangana - 506002
          </div>
        </div>
        <div className="md:text-right shrink-0">
          <h2 className="text-lg font-semibold">
            Welcome back{user?.displayName ? `, ${user.displayName}` : ""}
          </h2>
          <p className="text-xs text-muted-foreground">Pick a category and start a quiz.</p>
        </div>
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
