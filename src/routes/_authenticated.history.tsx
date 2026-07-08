import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, query, orderByChild, equalTo, get, remove } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/history")({
  component: HistoryPage,
});

type Attempt = {
  id: string;
  quizId: string;
  score: number;
  maxScore: number;
  startedAt: number;
  submittedAt: number;
  status: "in_progress" | "submitted";
  quizTitle?: string;
};

function HistoryPage() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    
    // Fetch attempts for this user
    const attemptsQuery = query(ref(db, "attempts"), orderByChild("userId"), equalTo(user.uid));
    
    const unsub = onValue(attemptsQuery, async (snap) => {
      const data = snap.val() as Record<string, Omit<Attempt, 'id' | 'quizTitle'>> | null;
      if (!data) {
        setAttempts([]);
        setLoading(false);
        return;
      }

      const attemptList: Attempt[] = Object.entries(data).map(([id, val]) => ({
        id,
        ...val,
      }));

      // Sort by newest first
      attemptList.sort((a, b) => b.startedAt - a.startedAt);

      // Fetch quiz titles
      for (const attempt of attemptList) {
        if (attempt.quizId) {
          const quizSnap = await get(ref(db, `quizzes/${attempt.quizId}/title`));
          attempt.quizTitle = (quizSnap.val() as string) || "Unknown Quiz";
        }
      }

      setAttempts([...attemptList]);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading history...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="border-b border-primary/10 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Attempt History</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review your past quiz performances and jump back into unfinished drafts.
        </p>
      </div>

      {attempts.length === 0 ? (
        <Card className="bg-muted/10 border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <p>You haven't taken any quizzes yet.</p>
            <Button asChild variant="outline" className="mt-4 shadow-sm">
              <Link to="/dashboard">Browse Categories</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {attempts.map((attempt) => {
            const isCompleted = attempt.status === "submitted";
            const accuracy =
              attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 100) : 0;

            return (
              <Card key={attempt.id} className="overflow-hidden transition hover:border-primary/50 hover:shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between p-5 gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{attempt.quizTitle || "Loading..."}</h3>
                      {isCompleted ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">Completed</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/30">In Progress</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                      <span className="flex h-1.5 w-1.5 rounded-full bg-primary/40"></span>
                      Started: {format(new Date(attempt.startedAt), "MMM d, yyyy • h:mm a")}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {isCompleted && (
                      <div className="flex items-center gap-6 text-center shrink-0 border-r border-border/60 pr-4">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Score</div>
                          <div className="font-bold text-lg">{attempt.score} <span className="text-xs text-muted-foreground font-semibold">/ {attempt.maxScore}</span></div>
                        </div>
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Accuracy</div>
                          <div className="font-bold text-lg text-primary">{accuracy}%</div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Button asChild variant={isCompleted ? "outline" : "default"} className="shrink-0 w-32 shadow-sm font-semibold">
                        {isCompleted ? (
                          <Link to="/result/$attemptId" params={{ attemptId: attempt.id }}>
                            View Results
                          </Link>
                        ) : (
                          <Link to="/attempt/$attemptId" params={{ attemptId: attempt.id }}>
                            Resume Quiz
                          </Link>
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                        title="Delete Result"
                        onClick={async () => {
                          if (!confirm("Are you sure you want to delete this attempt? This cannot be undone.")) return;
                          try {
                            const db = getFirebaseDb();
                            await remove(ref(db, `attempts/${attempt.id}`));
                            setAttempts((prev) => prev.filter((a) => a.id !== attempt.id));
                            toast.success("Attempt deleted successfully");
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : "Failed to delete attempt");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
