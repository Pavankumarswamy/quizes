import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { onValue, ref, set, update, get, serverTimestamp } from "firebase/database";
import { toast } from "sonner";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitAndGradeAttempt } from "@/lib/quiz.functions";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Check,
  Award,
  AlertCircle,
  HelpCircle,
  Code,
  Play,
  Terminal,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/attempt/$attemptId")({
  component: AttemptEngine,
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
  matchLeft?: { id: string; text: string }[];
  matchRight?: { id: string; text: string }[];
  codingLanguage?: string;
  codingTemplate?: string;
  codingTests?: string;
};

type Quiz = {
  title: string;
  durationSec: number;
  questionIds: string[];
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  negativeMarking: boolean;
};

type Attempt = {
  quizId: string;
  startedAt: number;
  status: "in_progress" | "submitted";
  questionOrder?: string[];
};

type UserAnswer = {
  answer?: unknown;
  status: "not_visited" | "visited" | "answered" | "marked" | "answered_marked";
  updatedAt?: number;
};

function AttemptEngine() {
  const { attemptId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});

  // Navigation & Selection
  const [orderedQuestionIds, setOrderedQuestionIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<unknown>(null);

  // Coding Mock Run State
  const [codeConsoleLog, setCodeConsoleLog] = useState<string>("");
  const [isRunningCode, setIsRunningCode] = useState(false);

  // Timer
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Dialogs
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitPromiseRef = useRef<boolean>(false);

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();

    const unsubAttempt = onValue(ref(db, `attempts/${attemptId}`), async (snap) => {
      const val = snap.val() as Attempt | null;
      if (!val) {
        toast.error("Attempt not found");
        navigate({ to: "/dashboard" });
        return;
      }

      if (val.status === "submitted") {
        toast.info("This quiz attempt has already been submitted.");
        navigate({ to: "/result/$attemptId", params: { attemptId } });
        return;
      }

      setAttempt(val);

      const quizRef = ref(db, `quizzes/${val.quizId}`);
      const quizSnap = await get(quizRef);
      if (quizSnap.exists()) {
        const qz = quizSnap.val() as Quiz;
        setQuiz(qz);

        const qBankSnap = await get(ref(db, "questionBank"));
        const qBank = (qBankSnap.val() as Record<string, Question>) ?? {};
        setQuestions(qBank);

        if (val.questionOrder) {
          setOrderedQuestionIds(val.questionOrder);
        } else {
          const order = [...qz.questionIds];
          if (qz.shuffleQuestions) {
            order.sort(() => Math.random() - 0.5);
          }
          await update(ref(db, `attempts/${attemptId}`), { questionOrder: order });
          setOrderedQuestionIds(order);
        }
      }
    });

    const unsubAnswers = onValue(ref(db, `attemptAnswers/${attemptId}`), (snap) => {
      setAnswers((snap.val() as Record<string, UserAnswer>) ?? {});
    });

    return () => {
      unsubAttempt();
      unsubAnswers();
    };
  }, [attemptId, user]);

  // Countdown timer
  useEffect(() => {
    if (!attempt || !quiz) return;

    const interval = setInterval(() => {
      const elapsedMs = Date.now() - attempt.startedAt;
      const totalMs = quiz.durationSec * 1000;
      const remainingSec = Math.max(0, Math.round((totalMs - elapsedMs) / 1000));

      setTimeLeft(remainingSec);

      if (remainingSec <= 0 && !submitPromiseRef.current) {
        clearInterval(interval);
        toast.warning("Time expired. Submitting now.");
        handleAutoSubmit();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [attempt, quiz]);

  // Hydrate answer states
  useEffect(() => {
    if (orderedQuestionIds.length === 0) return;
    const currentQid = orderedQuestionIds[currentIndex];
    const q = questions[currentQid];
    const savedAns = answers[currentQid]?.answer;

    if (savedAns !== undefined && savedAns !== null && savedAns !== "") {
      setSelectedAnswer(savedAns);
    } else {
      // Set type-specific defaults
      if (q?.type === "multi") {
        setSelectedAnswer([]);
      } else if (q?.type === "match") {
        setSelectedAnswer({});
      } else if (q?.type === "coding") {
        setSelectedAnswer(q.codingTemplate ?? "");
      } else {
        setSelectedAnswer(null);
      }
    }

    setCodeConsoleLog(""); // Clear mock console

    const currentStatus = answers[currentQid]?.status;
    if (!currentStatus || currentStatus === "not_visited") {
      updateAnswerStatus(currentQid, savedAns ?? "", "visited");
    }
  }, [currentIndex, orderedQuestionIds, answers, questions]);

  const updateAnswerStatus = async (qid: string, ans: unknown, status: UserAnswer["status"]) => {
    try {
      const db = getFirebaseDb();
      await set(ref(db, `attemptAnswers/${attemptId}/${qid}`), {
        answer: ans === undefined || ans === null ? "" : ans,
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error("Sync error", e);
    }
  };

  const isAnswerEmpty = (ans: unknown, type: string) => {
    if (ans === undefined || ans === null) return true;
    if (type === "multi") return !Array.isArray(ans) || ans.length === 0;
    if (type === "match") return Object.keys(ans).length === 0;
    return String(ans).trim() === "";
  };

  const handleSaveAndNext = async () => {
    if (orderedQuestionIds.length === 0) return;
    const currentQid = orderedQuestionIds[currentIndex];
    const q = questions[currentQid];

    const hasAnswer = !isAnswerEmpty(selectedAnswer, q.type);
    const nextStatus = hasAnswer ? "answered" : "visited";
    await updateAnswerStatus(currentQid, selectedAnswer, nextStatus);

    if (currentIndex < orderedQuestionIds.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.info("End of quiz. Review your palette or submit.");
    }
  };

  const handleMarkForReview = async () => {
    if (orderedQuestionIds.length === 0) return;
    const currentQid = orderedQuestionIds[currentIndex];
    const q = questions[currentQid];

    const hasAnswer = !isAnswerEmpty(selectedAnswer, q.type);
    const nextStatus = hasAnswer ? "answered_marked" : "marked";
    await updateAnswerStatus(currentQid, selectedAnswer, nextStatus);

    if (currentIndex < orderedQuestionIds.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.info("Marked for review.");
    }
  };

  const handleClearAnswer = async () => {
    if (orderedQuestionIds.length === 0) return;
    const currentQid = orderedQuestionIds[currentIndex];
    const q = questions[currentQid];

    let emptyVal: unknown = null;
    if (q.type === "multi") emptyVal = [];
    if (q.type === "match") emptyVal = {};
    if (q.type === "coding") emptyVal = q.codingTemplate ?? "";

    setSelectedAnswer(emptyVal);
    await updateAnswerStatus(currentQid, emptyVal, "visited");
    toast.info("Answer cleared");
  };

  const handleRunCodingStub = () => {
    setIsRunningCode(true);
    setCodeConsoleLog("Compiling files...\nInitializing test runner...\n");
    setTimeout(() => {
      setCodeConsoleLog((prev) => {
        return (
          prev +
          "Executing main()...\n\n" +
          "✔ Test Case 1: add(2, 3) === 5\n" +
          "✔ Test Case 2: add(-1, 1) === 0\n\n" +
          "Console Output: All tests executed successfully (Mock Exec).\n"
        );
      });
      setIsRunningCode(false);
    }, 1500);
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    submitPromiseRef.current = true;
    try {
      const currentQid = orderedQuestionIds[currentIndex];
      const q = questions[currentQid];
      if (currentQid) {
        const hasAnswer = !isAnswerEmpty(selectedAnswer, q.type);
        await updateAnswerStatus(currentQid, selectedAnswer, hasAnswer ? "answered" : "visited");
      }

      await submitAndGradeAttempt(attemptId);
      toast.success("Quiz submitted successfully!");
      navigate({ to: "/result/$attemptId", params: { attemptId } });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Submission failed.");
      setIsSubmitting(false);
      submitPromiseRef.current = false;
    }
  };

  const handleAutoSubmit = async () => {
    setIsSubmitting(true);
    submitPromiseRef.current = true;
    try {
      await submitAndGradeAttempt(attemptId);
      toast.success("Quiz auto-submitted!");
      navigate({ to: "/result/$attemptId", params: { attemptId } });
    } catch (err) {
      console.error("Auto submit error", err);
    }
  };

  if (!quiz || !attempt || orderedQuestionIds.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground bg-muted/10">
        Loading quiz attempt environment…
      </div>
    );
  }

  const currentQid = orderedQuestionIds[currentIndex];
  const currentQuestion = questions[currentQid];

  // Palette counts
  const answeredCount = Object.values(answers).filter(
    (a) => a.status === "answered" || a.status === "answered_marked",
  ).length;
  const markedCount = Object.values(answers).filter(
    (a) => a.status === "marked" || a.status === "answered_marked",
  ).length;
  const visitedCount = Object.values(answers).filter((a) => a.status === "visited").length;
  const unvisitedCount = orderedQuestionIds.length - answeredCount - markedCount - visitedCount;

  const formatTime = (secs: number | null) => {
    if (secs === null) return "--:--";
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-screen w-full bg-muted/10">
      {/* Top Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-6 shadow-sm z-10">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Taking Quiz</span>
          <span className="font-bold text-foreground text-sm line-clamp-1">{quiz.title}</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 px-3 py-1.5 border border-red-200/50 dark:border-red-900/30 text-red-700 dark:text-red-300">
            <Clock className="h-4 w-4 animate-pulse" />
            <span className="font-mono font-bold text-sm tracking-wider">
              {formatTime(timeLeft)}
            </span>
          </div>

          <Button
            size="sm"
            onClick={() => setShowSubmitConfirm(true)}
            className="shadow-sm font-semibold bg-emerald-600 hover:bg-emerald-600/90 text-white border-transparent"
          >
            Submit Exam
          </Button>
        </div>
      </header>

      {/* Workspace Panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center: Question Canvas */}
        <main className="flex-1 overflow-y-auto p-6 flex flex-col justify-between">
          {currentQuestion ? (
            <div className="max-w-3xl mx-auto w-full space-y-6">
              {/* Question Header Info */}
              <div className="flex justify-between items-center pb-2 border-b">
                <span className="text-sm font-semibold text-muted-foreground">
                  Question {currentIndex + 1} of {orderedQuestionIds.length}
                </span>
                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="secondary"
                    className="uppercase text-[9px] font-bold tracking-wider"
                  >
                    {currentQuestion.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 font-semibold"
                  >
                    +{currentQuestion.marks} Marks
                  </Badge>
                  {currentQuestion.negativeMarks > 0 && (
                    <Badge
                      variant="outline"
                      className="text-red-500 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30 font-semibold"
                    >
                      -{currentQuestion.negativeMarks} Wrong
                    </Badge>
                  )}
                </div>
              </div>

              {/* Question image attachment if present */}
              {currentQuestion.imageUrl && (
                <div className="w-full h-48 border rounded-lg overflow-hidden bg-muted">
                  <img
                    src={currentQuestion.imageUrl}
                    alt="Visual Context"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}

              {/* Question text */}
              <div className="text-base md:text-lg font-medium text-foreground select-none">
                {currentQuestion.text}
              </div>

              {/* WIDGETS BY QUESTION TYPE */}
              <div className="mt-6">
                {/* MCQ (Single Choice) */}
                {currentQuestion.type === "mcq" && (
                  <div className="space-y-3">
                    {currentQuestion.options?.map((opt) => {
                      const selected = selectedAnswer === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedAnswer(opt.id)}
                          className={`w-full text-left flex items-center gap-3.5 rounded-xl border p-4 text-sm transition ${
                            selected
                              ? "border-primary bg-primary/5 shadow-sm font-semibold ring-1 ring-primary"
                              : "bg-card hover:bg-muted/40"
                          }`}
                        >
                          <span
                            className={`h-6 w-6 flex shrink-0 items-center justify-center rounded-full border text-[11px] font-bold uppercase transition ${
                              selected
                                ? "bg-primary text-primary-foreground border-transparent"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {opt.id}
                          </span>
                          <span className="flex-1 text-foreground">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Multi Select (Multiple Choice) */}
                {currentQuestion.type === "multi" && (
                  <div className="space-y-3">
                    {currentQuestion.options?.map((opt) => {
                      const selectedList = Array.isArray(selectedAnswer) ? selectedAnswer : [];
                      const selected = selectedList.includes(opt.id);

                      const toggleSelect = () => {
                        if (selected) {
                          setSelectedAnswer(selectedList.filter((x) => x !== opt.id));
                        } else {
                          setSelectedAnswer([...selectedList, opt.id]);
                        }
                      };

                      return (
                        <button
                          key={opt.id}
                          onClick={toggleSelect}
                          className={`w-full text-left flex items-center gap-3.5 rounded-xl border p-4 text-sm transition ${
                            selected
                              ? "border-primary bg-primary/5 shadow-sm font-semibold ring-1 ring-primary"
                              : "bg-card hover:bg-muted/40"
                          }`}
                        >
                          <span
                            className={`h-6 w-6 flex shrink-0 items-center justify-center rounded-md border text-[11px] font-bold uppercase transition ${
                              selected
                                ? "bg-primary text-primary-foreground border-transparent"
                                : "bg-muted border-muted-foreground"
                            }`}
                          >
                            {selected ? "✓" : opt.id}
                          </span>
                          <span className="flex-1 text-foreground">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Fill in the Blank */}
                {currentQuestion.type === "fill" && (
                  <div className="max-w-md space-y-2">
                    <Label htmlFor="blank-input">Your Answer</Label>
                    <Input
                      id="blank-input"
                      placeholder="Type your response here..."
                      value={(selectedAnswer as string) || ""}
                      onChange={(e) => setSelectedAnswer(e.target.value)}
                      className="text-base"
                    />
                  </div>
                )}

                {/* True / False */}
                {currentQuestion.type === "tf" && (
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    {[
                      { val: "true", label: "True" },
                      { val: "false", label: "False" },
                    ].map((opt) => {
                      const selected = selectedAnswer === opt.val;
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setSelectedAnswer(opt.val)}
                          className={`flex flex-col items-center justify-center py-6 px-4 rounded-xl border text-base font-semibold transition ${
                            selected
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "bg-card hover:bg-muted/40"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Match Following */}
                {currentQuestion.type === "match" && (
                  <div className="space-y-4 border rounded-xl p-4 bg-card">
                    <div className="grid grid-cols-3 gap-2 font-bold text-xs uppercase text-muted-foreground border-b pb-2">
                      <span>Column Left</span>
                      <span className="text-center">Link</span>
                      <span>Column Right Choice</span>
                    </div>

                    <div className="space-y-3.5 pt-2">
                      {currentQuestion.matchLeft?.map((left) => {
                        const currentMapping = (selectedAnswer as Record<string, string>) || {};
                        const selectedRightId = currentMapping[left.id] || "";

                        const handleSelectMapping = (rightId: string) => {
                          setSelectedAnswer({ ...currentMapping, [left.id]: rightId });
                        };

                        return (
                          <div
                            key={left.id}
                            className="grid grid-cols-3 gap-2 items-center text-sm"
                          >
                            <span className="font-semibold text-foreground">{left.text}</span>
                            <span className="text-center font-bold text-muted-foreground">⇌</span>
                            <Select value={selectedRightId} onValueChange={handleSelectMapping}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="Match item" />
                              </SelectTrigger>
                              <SelectContent>
                                {currentQuestion.matchRight?.map((right) => (
                                  <SelectItem key={right.id} value={right.id}>
                                    {right.text}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Coding Stub with terminal mock runner */}
                {currentQuestion.type === "coding" && (
                  <div className="space-y-4">
                    <div className="border rounded-xl overflow-hidden bg-zinc-950 text-zinc-100 font-mono shadow-sm">
                      <div className="flex justify-between items-center px-4 py-2 border-b border-zinc-800 bg-zinc-900 text-xs">
                        <div className="flex items-center gap-2">
                          <Code className="h-4 w-4 text-emerald-500" />
                          <span>Solution Editor ({currentQuestion.codingLanguage})</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRunCodingStub}
                          disabled={isRunningCode}
                          className="text-xs text-zinc-300 hover:text-white bg-zinc-800 border-zinc-700 hover:bg-zinc-700 h-7"
                        >
                          <Play className="h-3 w-3 mr-1 fill-current text-emerald-500" /> Run Mock
                          Tests
                        </Button>
                      </div>
                      <textarea
                        value={(selectedAnswer as string) || ""}
                        onChange={(e) => setSelectedAnswer(e.target.value)}
                        className="w-full min-h-40 p-4 bg-zinc-950 font-mono text-xs leading-relaxed focus:outline-none resize-y border-transparent border-0 ring-0 text-emerald-400"
                        spellCheck="false"
                      />
                    </div>

                    {/* Console Output logs */}
                    {codeConsoleLog && (
                      <div className="border rounded-lg overflow-hidden bg-zinc-900 border-zinc-800 font-mono text-[11px] leading-relaxed text-zinc-300 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-zinc-800 bg-zinc-950 font-bold text-zinc-400 text-[10px] uppercase">
                          <Terminal className="h-3.5 w-3.5 text-sky-500" /> Console Logs
                        </div>
                        <pre className="p-3 overflow-x-auto max-h-36 whitespace-pre-wrap">
                          {codeConsoleLog}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Question could not be resolved. Please skip.
            </div>
          )}

          {/* Footer Actions Panel */}
          <div className="border-t pt-6 mt-12 bg-background/50 backdrop-blur-sm sticky bottom-0 z-10">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentIndex(currentIndex - 1)}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Previous
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClearAnswer}>
                  Clear Answer
                </Button>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkForReview}
                  className="text-indigo-600 hover:text-indigo-700"
                >
                  <Bookmark className="mr-1 h-4 w-4" /> Mark for Review
                </Button>
                <Button size="sm" onClick={handleSaveAndNext}>
                  Save & Next <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar: Palette Grid */}
        <aside className="w-64 border-l bg-card flex flex-col shrink-0 z-10">
          <div className="p-4 border-b">
            <h3 className="font-bold text-sm">Question Palette</h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Click to navigate questions.
            </p>
          </div>

          {/* Legend */}
          <div className="p-3 bg-muted/20 border-b grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="h-3 w-3 rounded bg-emerald-600" />
              <span>Answered ({answeredCount})</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="h-3 w-3 rounded bg-indigo-600" />
              <span>Marked ({markedCount})</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="h-3 w-3 rounded bg-red-500" />
              <span>Unanswered ({visitedCount})</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="h-3 w-3 rounded border border-muted" />
              <span>Unvisited ({unvisitedCount})</span>
            </div>
          </div>

          {/* Numbers list */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-4 gap-2">
              {orderedQuestionIds.map((qid, idx) => {
                const ansState = answers[qid];
                const active = idx === currentIndex;

                let colorClass = "border bg-background text-foreground hover:bg-muted/40";
                if (ansState) {
                  if (ansState.status === "answered") {
                    colorClass =
                      "bg-emerald-600 text-white border-transparent hover:bg-emerald-600/90";
                  } else if (ansState.status === "marked") {
                    colorClass =
                      "bg-indigo-600 text-white border-transparent hover:bg-indigo-600/90";
                  } else if (ansState.status === "answered_marked") {
                    colorClass =
                      "bg-indigo-600 text-white border-transparent hover:bg-indigo-600/90 relative after:content-[''] after:absolute after:bottom-1 after:right-1 after:h-1.5 after:w-1.5 after:rounded-full after:bg-emerald-400";
                  } else if (ansState.status === "visited") {
                    colorClass = "bg-red-500 text-white border-transparent hover:bg-red-500/90";
                  }
                }

                return (
                  <button
                    key={qid}
                    onClick={async () => {
                      const currentQid = orderedQuestionIds[currentIndex];
                      const currentQ = questions[currentQid];
                      const hasAnswer = !isAnswerEmpty(selectedAnswer, currentQ.type);
                      await updateAnswerStatus(
                        currentQid,
                        selectedAnswer,
                        hasAnswer ? "answered" : "visited",
                      );
                      setCurrentIndex(idx);
                    }}
                    className={`h-9 w-full flex items-center justify-center rounded-lg text-xs font-bold transition select-none ${colorClass} ${
                      active ? "ring-2 ring-primary ring-offset-2" : ""
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Confirmation Submit Dialog */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" /> Confirm Exam Submission
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to end and submit your exam?
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 border-y grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <div className="text-muted-foreground">Total Questions:</div>
              <div className="font-bold text-sm text-foreground">{orderedQuestionIds.length}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-emerald-600">Answered:</div>
              <div className="font-bold text-sm text-emerald-600">{answeredCount}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-indigo-600">Marked for Review:</div>
              <div className="font-bold text-sm text-indigo-600">{markedCount}</div>
            </div>
            <div className="space-y-1.5">
              <div className="text-red-500">Unanswered:</div>
              <div className="font-bold text-sm text-red-500">
                {orderedQuestionIds.length - answeredCount}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowSubmitConfirm(false)}
              disabled={isSubmitting}
            >
              Back to Quiz
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-transparent"
            >
              {isSubmitting ? "Submitting..." : "Submit & Grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
