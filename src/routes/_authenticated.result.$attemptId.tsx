import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, get } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  HelpCircle,
  Award,
  Clock,
  Code,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/result/$attemptId")({
  component: QuizResult,
});

type QuestionOption = { id: string; text: string; correct: boolean };
type Question = {
  id: string;
  type: "mcq" | "multi" | "fill" | "match" | "tf" | "coding";
  text: string;
  imageUrl?: string;
  options?: QuestionOption[];
  answer: unknown;
  marks: number;
  negativeMarks: number;
  explanation?: string;
  matchLeft?: { id: string; text: string }[];
  matchRight?: { id: string; text: string }[];
  codingLanguage?: string;
  codingTemplate?: string;
};

type Quiz = {
  title: string;
  durationSec: number;
  questionIds: string[];
  passingMarks: number;
  totalMarks: number;
  categoryId: string;
};

type Attempt = {
  quizId: string;
  userId: string;
  startedAt: number;
  submittedAt: number;
  status: "in_progress" | "submitted";
  score: number;
  maxScore: number;
  durationSec: number;
  questionOrder?: string[];
};

type UserAnswer = {
  answer?: unknown;
  status: "not_visited" | "visited" | "answered" | "marked" | "answered_marked";
};

function QuizResult() {
  const { attemptId } = Route.useParams();
  const { user } = useAuth();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();

    const unsubAttempt = onValue(ref(db, `attempts/${attemptId}`), async (snap) => {
      const val = snap.val() as Attempt | null;
      if (!val) {
        setLoading(false);
        return;
      }
      setAttempt(val);

      const quizRef = ref(db, `quizzes/${val.quizId}`);
      const quizSnap = await get(quizRef);
      if (quizSnap.exists()) {
        const qz = quizSnap.val() as Quiz;
        setQuiz(qz);

        onValue(
          ref(db, `categories/${qz.categoryId}/name`),
          (catSnap) => {
            setCategoryName((catSnap.val() as string) ?? "");
          },
          { onlyOnce: true },
        );

        const qBankSnap = await get(ref(db, "questionBank"));
        const qBank = (qBankSnap.val() as Record<string, Question>) ?? {};
        setQuestions(qBank);
      }
      setLoading(false);
    });

    const unsubAnswers = onValue(ref(db, `attemptAnswers/${attemptId}`), (snap) => {
      setAnswers((snap.val() as Record<string, UserAnswer>) ?? {});
    });

    return () => {
      unsubAttempt();
      unsubAnswers();
    };
  }, [attemptId, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground bg-muted/10">
        Loading quiz results…
      </div>
    );
  }

  if (!attempt || !quiz) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h2 className="text-xl font-semibold">Results not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The attempt or quiz data could not be retrieved.
        </p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const passed = attempt.score >= quiz.passingMarks;
  const totalQuestions = quiz.questionIds?.length ?? 0;
  const answeredCount = Object.values(answers).filter(
    (a) => a.status === "answered" || a.status === "answered_marked",
  ).length;

  const questionOrder = attempt.questionOrder ?? quiz.questionIds ?? [];

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    if (mins > 0) return `${mins}m ${s}s`;
    return `${s}s`;
  };

  const isAnswerEmpty = (ans: unknown, type: string) => {
    if (ans === undefined || ans === null) return true;
    if (type === "multi") return !Array.isArray(ans) || ans.length === 0;
    if (type === "match") return Object.keys(ans).length === 0;
    return String(ans).trim() === "";
  };

  // Grading Helper inside UI
  const isQuestionCorrect = (q: Question, uAns: unknown) => {
    if (isAnswerEmpty(uAns, q.type)) return false;

    if (q.type === "mcq" || q.type === "tf") {
      return String(uAns).trim() === String(q.answer).trim();
    } else if (q.type === "multi") {
      const list = Array.isArray(uAns) ? uAns : [uAns];
      const correct = Array.isArray(q.answer) ? q.answer : [q.answer];
      return (
        list.length === correct.length &&
        list.every((v) => correct.includes(v)) &&
        correct.every((v) => list.includes(v))
      );
    } else if (q.type === "fill") {
      return String(uAns).trim().toLowerCase() === String(q.answer).trim().toLowerCase();
    } else if (q.type === "match") {
      const map = (uAns as Record<string, string>) || {};
      const correctMap = (q.answer as Record<string, string>) || {};
      const keys = Object.keys(correctMap);
      return (
        keys.length === Object.keys(map).length &&
        keys.every((k) => String(map[k]) === String(correctMap[k]))
      );
    } else if (q.type === "coding") {
      return String(uAns).trim().length > 10;
    }
    return false;
  };

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-8">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/dashboard">
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Link>
        </Button>

        <span className="text-xs text-muted-foreground">
          Submitted:{" "}
          {new Date(attempt.submittedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {/* Summary Score Card */}
      <Card
        className={`border-t-4 shadow-sm ${passed ? "border-t-emerald-500" : "border-t-destructive"}`}
      >
        <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {categoryName || "General"}
            </span>
            <CardTitle className="text-2xl mt-1">{quiz.title}</CardTitle>
            <CardDescription className="text-xs">Grade and summary analysis</CardDescription>
          </div>

          <Badge
            variant={passed ? "default" : "destructive"}
            className={`text-sm px-4 py-1 uppercase font-bold tracking-wider ${
              passed ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""
            }`}
          >
            {passed ? "Passed" : "Failed"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6 border-t pt-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="p-4 rounded-lg bg-muted/20 border flex flex-col items-center text-center">
              <Award className="h-5 w-5 text-emerald-500 mb-1" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Your Score
              </span>
              <span className="text-lg font-bold text-foreground mt-0.5">
                {attempt.score} / {quiz.totalMarks}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-muted/20 border flex flex-col items-center text-center">
              <HelpCircle className="h-5 w-5 text-indigo-500 mb-1" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Accuracy
              </span>
              <span className="text-lg font-bold text-foreground mt-0.5">
                {quiz.totalMarks > 0
                  ? `${Math.round((attempt.score / quiz.totalMarks) * 100)}%`
                  : "0%"}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-muted/20 border flex flex-col items-center text-center">
              <Clock className="h-5 w-5 text-sky-500 mb-1" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Duration
              </span>
              <span className="text-lg font-bold text-foreground mt-0.5">
                {formatDuration(attempt.durationSec)}
              </span>
            </div>
            <div className="p-4 rounded-lg bg-muted/20 border flex flex-col items-center text-center">
              <CheckCircle2 className="h-5 w-5 text-amber-500 mb-1" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                Graded
              </span>
              <span className="text-lg font-bold text-foreground mt-0.5">
                {answeredCount} / {totalQuestions} Ans
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review details */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold tracking-tight border-b pb-2">
          Incorrect & Correct Review
        </h2>

        <div className="space-y-6">
          {questionOrder.map((qid, idx) => {
            const q = questions[qid];
            const userAns = answers[qid]?.answer;
            if (!q) return null;

            const isCorrect = isQuestionCorrect(q, userAns);
            const isUnanswered = isAnswerEmpty(userAns, q.type);

            let resultBadge = (
              <Badge variant="outline" className="text-red-500 bg-red-50 border-red-200">
                Incorrect {q.negativeMarks > 0 && `(-${q.negativeMarks})`}
              </Badge>
            );
            if (isUnanswered) {
              resultBadge = (
                <Badge variant="secondary" className="text-muted-foreground">
                  Unanswered
                </Badge>
              );
            } else if (isCorrect) {
              resultBadge = (
                <Badge
                  variant="outline"
                  className="text-emerald-600 bg-emerald-50 border-emerald-200"
                >
                  Correct (+{q.marks})
                </Badge>
              );
            }

            return (
              <Card key={qid} className="overflow-hidden hover:shadow-sm transition select-none">
                <CardHeader className="pb-3 border-b bg-muted/5 flex flex-row items-center justify-between gap-4">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Question {idx + 1} of {totalQuestions}{" "}
                    <Badge variant="secondary" className="ml-1 uppercase text-[9px]">
                      {q.type}
                    </Badge>
                  </span>
                  {resultBadge}
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {q.imageUrl && (
                    <div className="w-full h-40 border rounded-lg overflow-hidden bg-muted">
                      <img
                        src={q.imageUrl}
                        alt="Context"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}

                  <div className="font-semibold text-foreground text-base leading-relaxed">
                    {q.text}
                  </div>

                  {/* RENDER BY TYPE */}
                  <div className="mt-4">
                    {/* MCQ (Single Choice) */}
                    {q.type === "mcq" && (
                      <div className="space-y-2">
                        {q.options?.map((opt) => {
                          const isOptionCorrect = opt.id === q.answer;
                          const isOptionSelected = opt.id === userAns;

                          let styleClass = "border bg-card";
                          let checkIcon = null;

                          if (isOptionCorrect) {
                            styleClass =
                              "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/15 font-medium";
                            checkIcon = (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto" />
                            );
                          } else if (isOptionSelected) {
                            styleClass = "border-red-400 bg-red-50/50 dark:bg-red-950/15";
                            checkIcon = <XCircle className="h-4 w-4 text-red-500 ml-auto" />;
                          }

                          return (
                            <div
                              key={opt.id}
                              className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${styleClass}`}
                            >
                              <span
                                className={`h-6 w-6 flex items-center justify-center rounded-full border text-[11px] font-bold uppercase ${
                                  isOptionCorrect
                                    ? "bg-emerald-600 text-white border-transparent"
                                    : isOptionSelected
                                      ? "bg-red-500 text-white border-transparent"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {opt.id}
                              </span>
                              <span className="flex-1">{opt.text}</span>
                              {checkIcon}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Multi Select */}
                    {q.type === "multi" && (
                      <div className="space-y-2">
                        {q.options?.map((opt) => {
                          const correctList = Array.isArray(q.answer) ? q.answer : [q.answer];
                          const selectedList = Array.isArray(userAns) ? userAns : [];

                          const isOptionCorrect = correctList.includes(opt.id);
                          const isOptionSelected = selectedList.includes(opt.id);

                          let styleClass = "border bg-card";
                          let checkIcon = null;

                          if (isOptionCorrect) {
                            styleClass = "border-emerald-500 bg-emerald-50/50 font-medium";
                            checkIcon = (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 ml-auto" />
                            );
                          } else if (isOptionSelected && !isOptionCorrect) {
                            styleClass = "border-red-400 bg-red-50/50";
                            checkIcon = <XCircle className="h-4 w-4 text-red-500 ml-auto" />;
                          }

                          return (
                            <div
                              key={opt.id}
                              className={`flex items-center gap-3 rounded-lg border p-3 text-sm ${styleClass}`}
                            >
                              <span
                                className={`h-6 w-6 flex items-center justify-center rounded-md border text-[11px] font-bold uppercase ${
                                  isOptionCorrect
                                    ? "bg-emerald-600 text-white border-transparent"
                                    : isOptionSelected
                                      ? "bg-red-500 text-white border-transparent"
                                      : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {opt.id}
                              </span>
                              <span className="flex-1">{opt.text}</span>
                              {checkIcon}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Fill */}
                    {q.type === "fill" && (
                      <div className="space-y-2">
                        <div
                          className={`p-3.5 border rounded-lg text-sm flex justify-between items-center ${
                            isCorrect
                              ? "border-emerald-500 bg-emerald-50/30"
                              : "border-red-400 bg-red-50/30"
                          }`}
                        >
                          <div>
                            <span className="text-muted-foreground text-xs block mb-0.5">
                              Your response:
                            </span>
                            <span
                              className={`font-bold ${isCorrect ? "text-emerald-700" : "text-red-600"}`}
                            >
                              {userAns || "(Blank)"}
                            </span>
                          </div>
                          {isCorrect ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                        {!isCorrect && (
                          <div className="p-3 border rounded-lg bg-emerald-50/20 text-xs">
                            <span className="text-muted-foreground block mb-0.5">
                              Expected Answer:
                            </span>
                            <span className="font-bold text-emerald-700 text-sm">{q.answer}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* T/F */}
                    {q.type === "tf" && (
                      <div className="grid grid-cols-2 gap-4 max-w-md">
                        {["true", "false"].map((val) => {
                          const isKeyCorrect = val === q.answer;
                          const isKeySelected = val === userAns;

                          let styleClass = "border bg-card";
                          if (isKeyCorrect) {
                            styleClass =
                              "border-emerald-500 bg-emerald-50/50 text-emerald-700 font-bold";
                          } else if (isKeySelected && !isKeyCorrect) {
                            styleClass = "border-red-400 bg-red-50/50 text-red-600";
                          }

                          return (
                            <div
                              key={val}
                              className={`p-3 rounded-lg border text-center text-sm capitalize ${styleClass}`}
                            >
                              {val === "true" ? "True Statement" : "False Statement"}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Matching */}
                    {q.type === "match" && (
                      <div className="space-y-2.5 border rounded-lg p-4 bg-muted/5 max-w-xl text-xs">
                        <div className="grid grid-cols-3 gap-2 font-bold text-muted-foreground border-b pb-1.5 uppercase text-[10px]">
                          <span>Column Left</span>
                          <span>Matched Choice</span>
                          <span>Expected Solution</span>
                        </div>
                        {q.matchLeft?.map((left) => {
                          const userMap = (userAns as Record<string, string>) || {};
                          const userPairedId = userMap[left.id];
                          const userPaired = q.matchRight?.find((r) => r.id === userPairedId);

                          const correctPairedId = q.answer[left.id];
                          const correctPaired = q.matchRight?.find((r) => r.id === correctPairedId);

                          const isPairCorrect = userPairedId === correctPairedId;

                          return (
                            <div
                              key={left.id}
                              className="grid grid-cols-3 gap-2 items-center border-b py-2 last:border-b-0"
                            >
                              <span className="font-semibold">{left.text}</span>
                              <span
                                className={`font-semibold ${isPairCorrect ? "text-emerald-600" : "text-red-500"}`}
                              >
                                {userPaired?.text || "—"}
                              </span>
                              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 w-fit">
                                {correctPaired?.text}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Coding */}
                    {q.type === "coding" && (
                      <div className="space-y-2">
                        <div className="border rounded-lg overflow-hidden bg-zinc-950 font-mono text-xs">
                          <div className="flex justify-between items-center px-4 py-2 border-b border-zinc-800 bg-zinc-900 text-zinc-400 text-[10px] uppercase">
                            <div className="flex items-center gap-1.5">
                              <Code className="h-4 w-4 text-emerald-500" />
                              <span>Your Written Solution</span>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-emerald-500 border-emerald-900 bg-emerald-950/20"
                            >
                              Tests Passed (Mock)
                            </Badge>
                          </div>
                          <pre className="p-4 overflow-x-auto whitespace-pre text-emerald-400 leading-relaxed text-[11px]">
                            {userAns || "// No code submitted."}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>

                  {q.explanation && (
                    <div className="rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/50 dark:border-amber-900/30 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                      <div className="flex items-center gap-1 font-semibold mb-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Explanation:
                      </div>
                      <p className="leading-relaxed">{q.explanation}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
