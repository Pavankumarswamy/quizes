import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

  type Category = { name: string; slug: string; imageUrl?: string };

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
              SRR Thota, Karimabad Road,
              <br />
              Warangal, Telangana - 506002
            </div>
          </div>
          <div className="md:text-right shrink-0">
            <h2 className="text-lg font-semibold">
              Welcome back{user?.displayName ? `, ${user.displayName}` : ""}
            </h2>
            <p className="text-xs text-muted-foreground">Pick a category and start learning.</p>
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entries.map(([id, c]) => (
              <Link
                key={id}
                to="/categories/$slug"
                params={{ slug: c.slug }}
                className="flex flex-col group rounded-xl border bg-card overflow-hidden transition-all hover:border-primary/50 hover:shadow-md"
              >
                {c.imageUrl ? (
                  <div className="h-32 w-full bg-muted border-b relative overflow-hidden">
                    <img 
                      src={c.imageUrl} 
                      alt={c.name} 
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                  </div>
                ) : (
                  <div className="h-32 w-full bg-gradient-to-br from-primary/5 to-primary/10 border-b flex items-center justify-center relative overflow-hidden">
                     <span className="text-primary/20 font-black text-6xl uppercase tracking-tighter mix-blend-overlay group-hover:scale-110 transition-transform duration-500">
                       {c.name.substring(0, 2)}
                     </span>
                  </div>
                )}
                <div className="p-5 flex-1 flex flex-col justify-between bg-card">
                  <div className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{c.name}</div>
                  <div className="mt-4 text-xs font-semibold text-primary/70 uppercase tracking-wider flex items-center">
                    Explore modules <span className="ml-1 group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }
