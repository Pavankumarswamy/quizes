import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/categories/")({
  component: CategoryList,
});

type Category = { name: string; slug: string };

function CategoryList() {
  const [cats, setCats] = useState<Record<string, Category>>({});
  useEffect(() => {
    const unsub = onValue(ref(getFirebaseDb(), "categories"), (snap) => {
      setCats((snap.val() as Record<string, Category>) ?? {});
    });
    return () => unsub();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">All categories</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(cats).map(([id, c]) => (
          <Link
            key={id}
            to="/categories/$slug"
            params={{ slug: c.slug }}
            className="rounded-xl border bg-card p-6 hover:border-primary/50"
          >
            <div className="font-medium">{c.name}</div>
          </Link>
        ))}
        {Object.keys(cats).length === 0 && (
          <div className="text-sm text-muted-foreground">No categories yet.</div>
        )}
      </div>
    </div>
  );
}
