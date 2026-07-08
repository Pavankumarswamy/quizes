import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/categories/$slug")({
  component: CategoryDetail,
});

type Category = { name: string; slug: string };
type Sub = { categoryId: string; name: string; slug: string };
type Quiz = {
  title: string;
  description?: string;
  categoryId?: string;
  subcategoryId?: string;
  durationSec?: number;
  status?: "draft" | "published" | "archived";
  isFree?: boolean;
  questionIds?: string[];
};

function CategoryDetail() {
  const { slug } = Route.useParams();
  const [cats, setCats] = useState<Record<string, Category>>({});
  const [subs, setSubs] = useState<Record<string, Sub>>({});
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});

  useEffect(() => {
    const db = getFirebaseDb();
    const u1 = onValue(ref(db, "categories"), (s) => setCats(s.val() ?? {}));
    const u2 = onValue(ref(db, "subcategories"), (s) => setSubs(s.val() ?? {}));
    const u3 = onValue(ref(db, "quizzes"), (s) => setQuizzes(s.val() ?? {}));
    return () => {
      u1();
      u2();
      u3();
    };
  }, []);

  const category = Object.entries(cats).find(([, c]) => c.slug === slug);
  if (!category) {
    return <div className="p-6 text-sm text-muted-foreground">Category not found.</div>;
  }
  const [catId, cat] = category;
  const catSubs = Object.entries(subs).filter(([, s]) => s.categoryId === catId);
  const catQuizzes = Object.entries(quizzes).filter(
    ([, q]) => q.categoryId === catId && q.status === "published",
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{cat.name}</h1>
        <p className="text-sm text-muted-foreground">
          {catQuizzes.length} published quiz{catQuizzes.length === 1 ? "" : "zes"}
        </p>
      </div>

      {catSubs.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
            Subcategories
          </h2>
          <div className="flex flex-wrap gap-2">
            {catSubs.map(([id, s]) => (
              <span key={id} className="rounded-full bg-muted px-3 py-1 text-xs">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {catQuizzes.map(([qid, q]) => (
          <Card key={qid}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {q.title}
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {q.isFree === false ? "Paid" : "Free"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {q.description && <p className="text-sm text-muted-foreground">{q.description}</p>}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{q.questionIds?.length ?? 0} questions</span>
                <span>{Math.round((q.durationSec ?? 0) / 60)} min</span>
              </div>
              {q.isFree === false ? (
                <button
                  className="w-full cursor-not-allowed rounded-md border bg-muted py-2 text-sm text-muted-foreground"
                  disabled
                >
                  Locked (purchase later)
                </button>
              ) : (
                <Link
                  to="/quizzes/$quizId"
                  params={{ quizId: qid }}
                  className="block rounded-md bg-primary py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Start quiz
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
        {catQuizzes.length === 0 && (
          <div className="text-sm text-muted-foreground">
            No published quizzes in this category yet.
          </div>
        )}
      </div>
    </div>
  );
}
