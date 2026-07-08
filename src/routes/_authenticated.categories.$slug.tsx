import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/categories/$slug")({
  component: CategoryDetail,
});

type Category = { name: string; slug: string; imageUrl?: string };
type Sub = { categoryId: string; name: string; slug: string; imageUrl?: string };
type Quiz = {
  title: string;
  description?: string;
  coverUrl?: string;
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
  const catSubs = Object.entries(subs).filter(([, s]) => s && s.categoryId === catId);
  const catQuizzes = Object.entries(quizzes).filter(
    ([, q]) => q && q.categoryId === catId && q.status === "published",
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{cat.name}</h1>
        <p className="text-sm text-muted-foreground">
          {catQuizzes.length} published quiz{catQuizzes.length === 1 ? "" : "zes"}
        </p>
      </div>

      {catSubs.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground/80">
            Subcategories
          </h2>
          <div className="flex flex-wrap gap-3">
            {catSubs.map(([id, s]) => (
              <div key={id} className="flex items-center gap-2 rounded-full border bg-card pr-3 pl-1 py-1 shadow-sm">
                <div className="h-6 w-6 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase">{s.name.slice(0,2)}</span>
                  )}
                </div>
                <span className="text-sm font-medium">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {catQuizzes.map(([qid, q]) => (
          <Card key={qid} className="overflow-hidden flex flex-col hover:border-primary/50 hover:shadow-md transition-all">
            {q.coverUrl ? (
              <div className="h-40 w-full bg-muted relative">
                <img src={q.coverUrl} alt={q.title} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="h-40 w-full bg-gradient-to-tr from-primary/5 to-primary/10 flex items-center justify-center">
                 <span className="text-primary/20 font-black text-4xl uppercase tracking-tighter mix-blend-overlay">
                   {q.title.substring(0, 3)}
                 </span>
              </div>
            )}
            <div className="flex-1 p-5 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-lg leading-tight">{q.title}</h3>
                  <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                    {q.isFree === false ? "Paid" : "Free"}
                  </span>
                </div>
                {q.description && <p className="text-sm text-muted-foreground line-clamp-2">{q.description}</p>}
              </div>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <span>{q.questionIds?.length ?? 0} questions</span>
                  <span>{Math.round((q.durationSec ?? 0) / 60)} min</span>
                </div>
                {q.isFree === false ? (
                  <button
                    className="w-full cursor-not-allowed rounded-md border bg-muted py-2.5 text-sm font-semibold text-muted-foreground/60"
                    disabled
                  >
                    Locked
                  </button>
                ) : (
                  <Link
                    to="/quizzes/$quizId"
                    params={{ quizId: qid }}
                    className="block rounded-md bg-primary py-2.5 text-center text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Start quiz
                  </Link>
                )}
              </div>
            </div>
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
