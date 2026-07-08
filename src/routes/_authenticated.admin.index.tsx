import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

function useCount(path: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const unsub = onValue(ref(getFirebaseDb(), path), (s) => {
      setN(s.exists() ? Object.keys(s.val() as object).length : 0);
    });
    return () => unsub();
  }, [path]);
  return n;
}

function AdminOverview() {
  const cats = useCount("categories");
  const subs = useCount("subcategories");
  const quizzes = useCount("quizzes");
  const questions = useCount("questionBank");
  const users = useCount("users");
  const docs = useCount("documents");

  const stats = [
    { label: "Categories", value: cats },
    { label: "Subcategories", value: subs },
    { label: "Quizzes", value: quizzes },
    { label: "Questions", value: questions },
    { label: "Users", value: users },
    { label: "Documents", value: docs },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Live counts from your Firebase Realtime Database.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
