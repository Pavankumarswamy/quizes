import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, push, set, serverTimestamp } from "firebase/database";
import { toast } from "sonner";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, HelpCircle, Award, CheckCircle2, ChevronLeft, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quizzes/$quizId")({
  component: QuizDetail,
});

type Quiz = {
  title: string;
  description?: string;
  categoryId: string;
  subcategoryId?: string;
  durationSec: number;
  totalMarks: number;
  passingMarks: number;
  negativeMarking: boolean;
  questionIds: string[];
  status: "draft" | "published" | "archived";
};

function QuizDetail() {
  const { quizId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const db = getFirebaseDb();
    const quizRef = ref(db, `quizzes/${quizId}`);
    const unsub = onValue(
      quizRef,
      (snap) => {
        const val = snap.val() as Quiz | null;
        setQuiz(val);
        setLoading(false);

        // Fetch category name
        if (val?.categoryId) {
          onValue(
            ref(db, `categories/${val.categoryId}/name`),
            (catSnap) => {
              setCategoryName((catSnap.val() as string) ?? "");
            },
            { onlyOnce: true },
          );
        }
      },
      () => {
        setLoading(false);
      },
    );
    return () => unsub();
  }, [quizId]);

  const handleStartQuiz = async () => {
    if (!quiz || !user) return;
    try {
      const db = getFirebaseDb();
      const attemptsRef = ref(db, "attempts");
      const newAttemptRef = push(attemptsRef);
      const attemptId = newAttemptRef.key;

      if (!attemptId) throw new Error("Failed to generate attempt ID");

      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (fullscreenError) {
        console.warn("Fullscreen mode not supported or was blocked.", fullscreenError);
      }

      const attemptData = {
        quizId,
        userId: user.uid,
        startedAt: serverTimestamp(),
        submittedAt: 0,
        durationSec: quiz.durationSec,
        status: "in_progress",
        score: 0,
        maxScore: quiz.totalMarks,
      };

      await set(newAttemptRef, attemptData);
      toast.success("Quiz started!");
      navigate({ to: "/attempt/$attemptId", params: { attemptId } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start quiz.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading quiz details…
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h2 className="text-xl font-semibold">Quiz not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The quiz you're looking for does not exist.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/dashboard">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to dashboard
        </Link>
      </Button>

      <Card className="border-t-4 border-t-primary shadow-sm">
        <CardHeader className="pb-4">
          <div className="text-xs font-semibold text-primary uppercase tracking-wider">
            {categoryName || "General"}
          </div>
          <CardTitle className="text-2xl mt-1">{quiz.title}</CardTitle>
          <CardDescription className="text-sm mt-1">
            {quiz.description || "No description provided."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <InfoCard
              icon={<Clock className="h-4 w-4 text-sky-500" />}
              label="Duration"
              value={`${Math.round(quiz.durationSec / 60)} Mins`}
            />
            <InfoCard
              icon={<HelpCircle className="h-4 w-4 text-indigo-500" />}
              label="Questions"
              value={`${quiz.questionIds?.length ?? 0}`}
            />
            <InfoCard
              icon={<Award className="h-4 w-4 text-emerald-500" />}
              label="Total Marks"
              value={`${quiz.totalMarks}`}
            />
            <InfoCard
              icon={<CheckCircle2 className="h-4 w-4 text-amber-500" />}
              label="Passing Score"
              value={`${quiz.passingMarks}`}
            />
          </div>

          <div className="border-t pt-5 space-y-4">
            <h3 className="font-semibold text-sm">Attempt Guidelines</h3>
            <ul className="list-disc pl-5 text-sm space-y-2 text-muted-foreground">
              <li>Do not close or reload the browser page while taking the quiz.</li>
              <li>You can view and navigate to any question using the sidebar palette.</li>
              <li>
                Your progress is synced in real-time. If you disconnect, you can resume the quiz if
                time remains.
              </li>
              <li>
                {quiz.negativeMarking ? (
                  <span className="text-red-500 font-semibold">Negative marking is enabled.</span>
                ) : (
                  <span>There is no negative marking for incorrect answers.</span>
                )}
              </li>
              <li>The quiz will automatically submit once the time countdown finishes.</li>
            </ul>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button size="lg" onClick={handleStartQuiz} className="px-8 shadow-sm">
              <Play className="mr-2 h-4 w-4 fill-current" /> Start Quiz
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-lg border bg-muted/10 text-center">
      <div className="mb-1.5">{icon}</div>
      <div className="text-[10px] text-muted-foreground uppercase font-semibold">{label}</div>
      <div className="text-sm font-bold text-foreground mt-0.5">{value}</div>
    </div>
  );
}
