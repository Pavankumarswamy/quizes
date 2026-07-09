import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { onValue, ref, query, orderByChild, equalTo, update } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Clock,
  Zap,
  Play,
  Trophy,
  ArrowRight,
  Sparkles,
  History,
  TrendingUp,
  FileText,
  Download,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Category = { name: string; slug: string; imageUrl?: string };
type Quiz = {
  id: string;
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
type StudyMaterial = {
  id: string;
  title: string;
  thumbnailUrl: string;
  fileUrl: string;
  price: number;
  categoryId: string;
  subcategoryId?: string;
  createdAt: number;
  uploadedBy: string;
};

function Dashboard() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [materials, setMaterials] = useState<Record<string, StudyMaterial>>({});
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<"attempts" | "materials">("attempts");

  // User Profile
  const [userProfile, setUserProfile] = useState<{
    isPremium?: boolean;
    hasPass?: boolean;
    purchasedQuizzes?: Record<string, boolean>;
    purchasedMaterials?: Record<string, boolean>;
  } | null>(null);

  // Dialog & Paywall states
  const [openPassDialog, setOpenPassDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch Categories, Quizzes, & Study Materials
  useEffect(() => {
    const db = getFirebaseDb();
    const unsubCats = onValue(ref(db, "categories"), (snap) => {
      setCategories((snap.val() as Record<string, Category>) ?? {});
    });
    const unsubQuizzes = onValue(ref(db, "quizzes"), (snap) => {
      setQuizzes((snap.val() as Record<string, Quiz>) ?? {});
    });
    const unsubMats = onValue(ref(db, "studyMaterials"), (snap) => {
      setMaterials((snap.val() as Record<string, StudyMaterial>) ?? {});
    });
    return () => {
      unsubCats();
      unsubQuizzes();
      unsubMats();
    };
  }, []);

  // Fetch Attempt History
  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const attemptsQuery = query(ref(db, "attempts"), orderByChild("userId"), equalTo(user.uid));
    
    const unsub = onValue(attemptsQuery, (snap) => {
      const data = snap.val() as Record<string, Omit<Attempt, 'id'>> | null;
      if (!data) {
        setAttempts([]);
        setLoadingAttempts(false);
        return;
      }
      const attemptList = Object.entries(data).map(([id, val]) => ({
        id,
        ...val,
      }));
      attemptList.sort((a, b) => b.startedAt - a.startedAt);
      setAttempts(attemptList);
      setLoadingAttempts(false);
    });

    return () => unsub();
  }, [user]);

  // Fetch User Profile info
  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
      setUserProfile(snap.val() || null);
    });
    return () => unsub();
  }, [user]);

  const handleBuyPass = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      const db = getFirebaseDb();
      await update(ref(db, `users/${user.uid}`), {
        isPremium: true,
        hasPass: true,
      });
      toast.success("Premium Pass activated successfully! All materials & quizzes unlocked.");
      setOpenPassDialog(false);
    } catch (e) {
      toast.error("Failed to purchase Pass.");
    } finally {
      setIsProcessing(false);
    }
  };

  const isMaterialUnlocked = (item: StudyMaterial) => {
    return item.price === 0 || 
           userProfile?.isPremium === true || 
           userProfile?.hasPass === true || 
           userProfile?.purchasedMaterials?.[item.id] === true;
  };

  // Published quizzes
  const allPublishedQuizzes = useMemo(() => {
    return Object.entries(quizzes)
      .map(([id, q]) => ({ id, ...q }))
      .filter((q) => q.status === "published");
  }, [quizzes]);

  // User scorecard calculations
  const completedAttempts = useMemo(() => {
    return attempts.filter((a) => a.status === "submitted");
  }, [attempts]);

  const activeAttempt = useMemo(() => {
    return attempts.find((a) => a.status === "in_progress");
  }, [attempts]);

  const avgAccuracy = useMemo(() => {
    if (completedAttempts.length === 0) return 0;
    const totalAccuracy = completedAttempts.reduce((acc, curr) => {
      return acc + (curr.maxScore > 0 ? (curr.score / curr.maxScore) * 100 : 0);
    }, 0);
    return Math.round(totalAccuracy / completedAttempts.length);
  }, [completedAttempts]);

  const activeAttemptQuizTitle = useMemo(() => {
    if (!activeAttempt) return "";
    return quizzes[activeAttempt.quizId]?.title || "Unfinished Quiz";
  }, [activeAttempt, quizzes]);

  // Unlocked user materials
  const myMaterials = useMemo(() => {
    return Object.entries(materials)
      .map(([id, item]) => ({ id, ...item }))
      .filter((item) => isMaterialUnlocked(item))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [materials, userProfile]);

  // Quiz Recommendations
  const quizRecommendations = useMemo(() => {
    const attemptedQuizIds = new Set(attempts.map((a) => a.quizId));
    const recs = allPublishedQuizzes.filter((q) => !attemptedQuizIds.has(q.id));
    return recs.slice(0, 3);
  }, [allPublishedQuizzes, attempts]);

  const hasPass = userProfile?.isPremium === true || userProfile?.hasPass === true;

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Learner Dashboard
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Access your dashboard materials, track test scores, and download notes.
          </p>
        </div>

        <div>
          {hasPass ? (
            <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-800 font-bold border-none text-[10px] py-1.5 px-3 uppercase tracking-wider gap-1.5 shadow-sm">
              <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              Premium Pass Active
            </Badge>
          ) : (
            <Button
              onClick={() => setOpenPassDialog(true)}
              size="sm"
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs h-9 rounded-xl shadow-md cursor-pointer border-none animate-pulse"
            >
              <Zap className="h-3.5 w-3.5 mr-1 fill-white shrink-0" />
              Get Premium Pass (₹199)
            </Button>
          )}
        </div>
      </div>

      {/* Grid: Resume Banner & scorecard */}
      <div className="grid gap-6 md:grid-cols-3">
        {activeAttempt ? (
          <Card className="md:col-span-2 border-amber-200 bg-amber-50/50 relative overflow-hidden flex flex-col justify-between p-5 hover:border-amber-300 transition-all rounded-2xl">
            <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wide">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Active Attempt In Progress
              </div>
              <h3 className="text-base font-extrabold text-slate-800 leading-snug">
                {activeAttemptQuizTitle}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                You have an unfinished attempt. Click resume to return to the exam interface.
              </p>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Started: {new Date(activeAttempt.startedAt).toLocaleDateString()}
              </span>
              <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-9 rounded-xl shadow-sm px-4">
                <Link to="/attempt/$attemptId" params={{ attemptId: activeAttempt.id }}>
                  <Play className="h-3 w-3 mr-1 fill-white shrink-0" /> Resume Quiz
                </Link>
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="md:col-span-2 border-slate-100 bg-blue-50/15 flex flex-col justify-between p-5 rounded-2xl">
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-800">
                Welcome Back, {user?.displayName || user?.email?.split("@")[0] || "Learner"}!
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Your preparation workspace is set. Explore mock exams or manage downloaded study handouts inside your tabs below.
              </p>
            </div>
            <div className="mt-5 flex gap-2">
              <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm">
                <Link to="/exams">
                  Practice Exams
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="text-xs font-bold rounded-xl shadow-sm">
                <Link to="/materials">
                  Study Materials
                </Link>
              </Button>
            </div>
          </Card>
        )}

        {/* Scorecard */}
        <Card className="p-5 flex flex-col justify-between border-slate-100 rounded-2xl bg-white shadow-xs">
          <div>
            <div className="font-bold text-[10px] text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
              <Trophy className="h-3.5 w-3.5 text-yellow-500" />
              Personal Scorecard
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="border-r border-slate-100 pr-2">
                <div className="text-2xl font-black text-slate-800">{completedAttempts.length}</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-snug">Completed Tests</div>
              </div>
              <div className="pl-2">
                <div className="text-2xl font-black text-blue-600">{avgAccuracy}%</div>
                <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-snug">Average Accuracy</div>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-50 text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            Keep taking mocks to boost accuracy!
          </div>
        </Card>
      </div>

      {/* Main content area splits: Tabs vs recommendations */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Tabs for Attempts and Materials */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab buttons */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("attempts")}
              className={`px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "attempts"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <History className="h-4 w-4" />
              Mock Attempts ({attempts.length})
            </button>
            <button
              onClick={() => setActiveTab("materials")}
              className={`px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "materials"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <FileText className="h-4 w-4" />
              My Materials ({myMaterials.length})
            </button>
          </div>

          <div className="mt-2 space-y-3">
            {/* Tab content 1: Attempts */}
            {activeTab === "attempts" && (
              <>
                {loadingAttempts ? (
                  <div className="text-center py-8 text-xs text-slate-400">Loading attempts...</div>
                ) : attempts.length === 0 ? (
                  <Card className="p-12 text-center border-slate-150 border-dashed rounded-2xl bg-white flex flex-col items-center">
                    <History className="h-8 w-8 text-slate-350 mb-2" />
                    <p className="text-xs text-slate-500 font-medium">You haven't attempted any tests yet.</p>
                    <Button asChild size="sm" className="mt-4 text-xs rounded-xl font-bold">
                      <Link to="/exams">Browse Mock Exams</Link>
                    </Button>
                  </Card>
                ) : (
                  attempts.slice(0, 8).map((attempt) => {
                    const isSubmitted = attempt.status === "submitted";
                    const quiz = quizzes[attempt.quizId];
                    const title = quiz?.title || attempt.quizTitle || "Deleted Quiz";
                    const date = new Date(attempt.startedAt).toLocaleDateString();

                    return (
                      <Card key={attempt.id} className="border-slate-100 p-4 bg-white hover:border-slate-200 hover:shadow-sm transition-all rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <h4 className="font-bold text-xs text-slate-800 truncate">{title}</h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                            <span>{date}</span>
                            <span>•</span>
                            {isSubmitted ? (
                              <Badge variant="outline" className="bg-emerald-50/50 text-emerald-600 border-emerald-100 text-[8px] py-0 px-1 font-bold uppercase">
                                Submitted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50/50 text-amber-600 border-amber-100 text-[8px] py-0 px-1 font-bold uppercase">
                                In Progress
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
                          {isSubmitted ? (
                            <div className="text-left sm:text-right">
                              <div className="text-xs font-black text-slate-800">
                                Score: {attempt.score} / {attempt.maxScore}
                              </div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                Accuracy: {attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 100) : 0}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                              Suspended
                            </span>
                          )}

                          <Button asChild size="sm" variant={isSubmitted ? "outline" : "default"} className="h-8 text-xs font-semibold rounded-xl px-3.5">
                            <Link
                              to={isSubmitted ? "/result/$attemptId" : "/attempt/$attemptId"}
                              params={{ attemptId: attempt.id }}
                            >
                              {isSubmitted ? "Report" : "Resume"}
                            </Link>
                          </Button>
                        </div>
                      </Card>
                    );
                  })
                )}
              </>
            )}

            {/* Tab content 2: Materials */}
            {activeTab === "materials" && (
              <>
                {myMaterials.length === 0 ? (
                  <Card className="p-12 text-center border-slate-150 border-dashed rounded-2xl bg-white flex flex-col items-center">
                    <FileText className="h-8 w-8 text-slate-350 mb-2" />
                    <p className="text-xs text-slate-500 font-medium">You don't have any unlocked study materials yet.</p>
                    <p className="text-[10px] text-slate-400 font-medium max-w-xs mt-0.5">Free items or materials purchased from the library will appear here.</p>
                    <Button asChild size="sm" className="mt-4 text-xs rounded-xl font-bold">
                      <Link to="/materials">Browse Handouts</Link>
                    </Button>
                  </Card>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {myMaterials.map((item) => (
                      <Card key={item.id} className="p-4 border-slate-100 bg-white hover:border-slate-200 hover:shadow-md transition-all rounded-xl flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-lg overflow-hidden border shrink-0 bg-slate-50">
                            <img
                              src={item.thumbnailUrl}
                              alt={item.title}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?auto=format&fit=crop&w=100&q=80";
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-slate-800 truncate">{item.title}</h4>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-0.5">
                              Ready to read
                            </span>
                          </div>
                        </div>

                        <Button asChild size="icon" variant="outline" className="h-8 w-8 rounded-lg shrink-0 border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer">
                          <a href={item.fileUrl} download target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Column: Recommendations */}
        <div className="space-y-4">
          <div className="border-b pb-2">
            <h3 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
              <Sparkles className="h-4.5 w-4.5 text-blue-500 fill-blue-500" />
              Practice Matches
            </h3>
          </div>

          <div className="space-y-3">
            {quizRecommendations.map((quiz) => (
              <Card key={quiz.id} className="p-4 border-slate-100 hover:border-blue-500/20 bg-white shadow-xs rounded-xl flex flex-col justify-between min-h-[140px] transition-all">
                <div className="space-y-1.5">
                  <span className="text-[8px] font-bold text-blue-600 uppercase tracking-widest block">
                    Recommended
                  </span>
                  <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight">
                    {quiz.title}
                  </h4>
                  <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400">
                    <Clock className="h-2.5 w-2.5" />
                    <span>{Math.round((quiz.durationSec ?? 0) / 60)} mins</span>
                    <span>•</span>
                    <span>{quiz.questionIds?.length ?? 0} Questions</span>
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-between border-t border-slate-50 mt-2">
                  <Badge variant="outline" className="text-[8px] font-bold tracking-wider uppercase px-1.5 py-0 bg-blue-100/10 text-blue-700 border-blue-200">
                    Syllabus Exam
                  </Badge>
                  <Button asChild size="xs" className="h-7 text-[10px] font-bold rounded-lg px-2.5 cursor-pointer">
                    <Link to="/quizzes/$quizId" params={{ quizId: quiz.id }}>
                      Start
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
            {quizRecommendations.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400">
                No mock test matches recommended at this time.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog for Pass Purchase */}
      <Dialog open={openPassDialog} onOpenChange={setOpenPassDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
              Unlock All Test Pass
            </DialogTitle>
            <DialogDescription className="text-xs">
              Get immediate unlimited access to all paid exams, mock tests, and syllabus notes.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>Premium Pass (1 Year Validity)</span>
              <span className="text-blue-600">₹199</span>
            </div>
            <div className="text-[10px] text-muted-foreground leading-relaxed font-medium">
              Includes full leaderboard ranking eligibility, facial anti-cheat check simulations, and detailed step-by-step report maps.
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between items-center gap-4 pt-2 border-t">
            <div className="text-xs text-muted-foreground font-semibold">
              Total due: ₹199
            </div>
            <Button
              onClick={handleBuyPass}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer border-none"
            >
              {isProcessing ? "Processing..." : "Confirm & Pay"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
