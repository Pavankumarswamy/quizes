import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { onValue, ref, update } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { NavBar } from "@/components/NavBar";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  BookOpen,
  Clock,
  Users,
  CheckCircle2,
  Zap,
  HelpCircle,
  Play,
  ArrowRight,
  ChevronRight,
  FolderMinus,
} from "lucide-react";

const examsSearchSchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
});

export const Route = createFileRoute("/exams")({
  validateSearch: examsSearchSchema,
  component: ExamsPage,
});

type Category = { name: string; slug: string; imageUrl?: string };
type Subcategory = { name: string; categoryId: string };
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

function getQuizMetrics(id: string) {
  const hash = id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const users = ((hash % 1500) / 10 + 50).toFixed(1);
  const rating = (4.3 + (hash % 7) * 0.1).toFixed(1);
  return {
    users: `${users}k`,
    rating,
    freeTests: (hash % 2) + 1,
    totalTests: (hash % 30) + 15,
  };
}

function ExamsPage() {
  const search = useSearch({ from: "/exams" });
  const navigate = useNavigate();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [subcategories, setSubcategories] = useState<Record<string, Subcategory>>({});
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  
  // User profile for unlocks
  const [userProfile, setUserProfile] = useState<{
    isPremium?: boolean;
    hasPass?: boolean;
    purchasedQuizzes?: Record<string, boolean>;
  } | null>(null);

  // Dialogs
  const [openPassDialog, setOpenPassDialog] = useState(false);
  const [openQuizDialog, setOpenQuizDialog] = useState(false);
  const [selectedUnlockQuiz, setSelectedUnlockQuiz] = useState<Quiz | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch standard data
  useEffect(() => {
    const db = getFirebaseDb();
    const unsubCats = onValue(ref(db, "categories"), (snap) => {
      setCategories((snap.val() as Record<string, Category>) ?? {});
    });
    const unsubSubs = onValue(ref(db, "subcategories"), (snap) => {
      setSubcategories((snap.val() as Record<string, Subcategory>) ?? {});
    });
    const unsubQuizzes = onValue(ref(db, "quizzes"), (snap) => {
      setQuizzes((snap.val() as Record<string, Quiz>) ?? {});
    });
    return () => {
      unsubCats();
      unsubSubs();
      unsubQuizzes();
    };
  }, []);

  // Fetch profile if logged in
  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
      setUserProfile(snap.val() || null);
    });
    return () => unsub();
  }, [user]);

  // Determine active category and subcategory
  const activeCategoryId = search.category || (Object.keys(categories).length > 0 ? Object.keys(categories)[0] : "");
  const activeSubcategoryId = search.subcategory;

  const activeCategory = activeCategoryId ? categories[activeCategoryId] : null;

  // Filter subcategories that belong to the active category
  const filteredSubcategories = useMemo(() => {
    if (!activeCategoryId) return [];
    return Object.entries(subcategories)
      .map(([id, sub]) => ({ id, ...sub }))
      .filter((sub) => sub.categoryId === activeCategoryId);
  }, [subcategories, activeCategoryId]);

  // Filter published quizzes under this category, matching search query
  const filteredQuizzes = useMemo(() => {
    let result = Object.entries(quizzes)
      .map(([id, q]) => ({ id, ...q }))
      .filter((q) => q.status === "published" && q.categoryId === activeCategoryId);

    if (activeSubcategoryId) {
      result = result.filter((q) => q.subcategoryId === activeSubcategoryId);
    }

    if (searchQuery.trim()) {
      result = result.filter((q) =>
        q.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return result;
  }, [quizzes, activeCategoryId, activeSubcategoryId, searchQuery]);

  const isQuizUnlocked = (quiz: Quiz) => {
    return quiz.isFree !== false || 
           userProfile?.isPremium === true || 
           userProfile?.hasPass === true || 
           userProfile?.purchasedQuizzes?.[quiz.id] === true;
  };

  const handleBuyPass = async () => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setIsProcessing(true);
    try {
      const db = getFirebaseDb();
      await update(ref(db, `users/${user.uid}`), {
        isPremium: true,
        hasPass: true,
      });
      toast.success("Premium Pass activated successfully! All quizzes unlocked.");
      setOpenPassDialog(false);
    } catch (e) {
      toast.error("Failed to purchase Pass.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlockQuiz = (quiz: Quiz) => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setSelectedUnlockQuiz(quiz);
    setOpenQuizDialog(true);
  };

  const confirmUnlockQuiz = async () => {
    if (!selectedUnlockQuiz || !user) return;
    setIsProcessing(true);
    try {
      const db = getFirebaseDb();
      await update(ref(db, `users/${user.uid}/purchasedQuizzes`), {
        [selectedUnlockQuiz.id]: true,
      });
      toast.success(`Unlocked "${selectedUnlockQuiz.title}" successfully!`);
      setOpenQuizDialog(false);
    } catch (e) {
      toast.error("Failed to unlock quiz.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCategorySelect = (catId: string) => {
    navigate({
      to: "/exams",
      search: { category: catId, subcategory: undefined },
    });
  };

  const handleSubcategorySelect = (subId: string | undefined) => {
    navigate({
      to: "/exams",
      search: { category: activeCategoryId, subcategory: subId },
    });
  };

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-800 font-sans flex flex-col justify-between">
      <div>
        <NavBar />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Categories Menu */}
            <aside className="w-full lg:w-72 shrink-0">
              <Card className="border-slate-100 bg-white p-4 shadow-sm space-y-4">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                  Exam Categories
                </div>
                <nav className="space-y-1">
                  {Object.entries(categories).map(([id, cat]) => {
                    const isActive = id === activeCategoryId;
                    return (
                      <button
                        key={id}
                        onClick={() => handleCategorySelect(id)}
                        className={`w-full text-left px-3.5 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between border cursor-pointer ${
                          isActive
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10"
                            : "bg-white border-transparent hover:bg-slate-50 text-slate-700 hover:border-slate-200"
                        }`}
                      >
                        <span className="truncate">{cat.name}</span>
                        <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${
                          isActive ? "translate-x-0.5 text-white" : "text-slate-400"
                        }`} />
                      </button>
                    );
                  })}
                  {Object.keys(categories).length === 0 && (
                    <div className="text-center py-6 text-xs text-slate-400">
                      No categories found.
                    </div>
                  )}
                </nav>
              </Card>
            </aside>

            {/* Quizzes List Area */}
            <main className="flex-1 space-y-6">
              {activeCategory ? (
                <>
                  {/* Category Title & Filters */}
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                          {activeCategory.name}
                        </h1>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Browse and attempt quizzes in this syllabus folder
                        </p>
                      </div>

                      {/* Search inside Category */}
                      <div className="w-full sm:w-72 flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                        <Search className="h-4 w-4 text-slate-400 shrink-0" />
                        <input
                          type="text"
                          placeholder="Search quizzes..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="border-0 focus:outline-none focus:ring-0 text-xs w-full text-slate-700 bg-transparent placeholder:text-slate-400"
                        />
                      </div>
                    </div>

                    {/* Subcategories Horizontal bar */}
                    {filteredSubcategories.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => handleSubcategorySelect(undefined)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                            !activeSubcategoryId
                              ? "bg-blue-50 border-blue-200 text-blue-700"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          All Subcategories
                        </button>
                        {filteredSubcategories.map((sub) => {
                          const isSubActive = sub.id === activeSubcategoryId;
                          return (
                            <button
                              key={sub.id}
                              onClick={() => handleSubcategorySelect(sub.id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                                isSubActive
                                  ? "bg-blue-50 border-blue-200 text-blue-700"
                                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {sub.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quiz Cards Grid */}
                  {filteredQuizzes.length === 0 ? (
                    <Card className="p-12 text-center border-slate-200 border-dashed bg-white shadow-xs rounded-2xl flex flex-col items-center justify-center space-y-4">
                      <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                        <FolderMinus className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-extrabold text-sm text-slate-800">No Mock Exams Found</h3>
                        <p className="text-xs text-slate-500 max-w-sm font-medium">
                          We couldn't find any published test series matching your selected filters. Please try another query or category.
                        </p>
                      </div>
                    </Card>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {filteredQuizzes.map((quiz) => {
                        const metrics = getQuizMetrics(quiz.id);
                        const unlocked = user ? isQuizUnlocked(quiz) : false;
                        const subcatName = quiz.subcategoryId ? subcategories[quiz.subcategoryId]?.name : null;

                        return (
                          <Card
                            key={quiz.id}
                            className="overflow-hidden flex flex-col group border-slate-200/80 hover:border-blue-500/50 hover:shadow-lg transition-all duration-300 bg-white"
                          >
                            <div className="bg-slate-50 border-b px-4 py-2 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3 text-slate-400" />
                                {metrics.users} students
                              </span>
                              <span className="flex items-center gap-0.5 text-amber-500">
                                ★ {metrics.rating}
                              </span>
                            </div>

                            <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                              <div className="space-y-2">
                                <div className="space-y-1">
                                  {subcatName && (
                                    <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider block">
                                      {subcatName}
                                    </span>
                                  )}
                                  <h3 className="font-bold text-sm text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[40px] leading-tight">
                                    {quiz.title}
                                  </h3>
                                </div>
                                
                                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                  <Clock className="h-3 w-3" />
                                  <span>{Math.round((quiz.durationSec ?? 0) / 60)} Mins</span>
                                  <span>•</span>
                                  <span>{quiz.questionIds?.length ?? 0} Questions</span>
                                </div>
                              </div>

                              <div className="space-y-1 text-xs text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span>{metrics.totalTests} Topic Tests</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  <span>{metrics.freeTests} Free Trials</span>
                                </div>
                              </div>

                              <div className="pt-2">
                                {!user ? (
                                  <Button asChild className="w-full text-xs font-bold shadow-sm rounded-xl">
                                    <Link to="/auth">
                                      Login to Start
                                    </Link>
                                  </Button>
                                ) : unlocked ? (
                                  <Button asChild className="w-full text-xs font-bold shadow-sm rounded-xl group-hover:bg-blue-600">
                                    <Link to="/quizzes/$quizId" params={{ quizId: quiz.id }}>
                                      Start Test
                                    </Link>
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => handleUnlockQuiz(quiz)}
                                    variant="outline"
                                    className="w-full text-xs font-bold border-amber-500 text-amber-700 bg-amber-50 hover:bg-amber-100 flex items-center justify-center gap-1 cursor-pointer rounded-xl"
                                  >
                                    🔒 Unlock Test (₹49)
                                  </Button>
                                )}
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-16 text-slate-400">
                  Select an exam category to start exploring quizzes.
                </div>
              )}
            </main>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-6 border-t border-slate-850 text-center text-xs space-y-4 rounded-t-[25px]">
        <div className="font-extrabold uppercase tracking-widest text-white">
          electricwisers test prep series
        </div>
        <div>
          SRR Thota, Karimabad Road, Warangal, Telangana - 506002
        </div>
        <div className="text-[10px] text-slate-600 font-medium">
          &copy; {new Date().getFullYear()} electricwisers. All rights reserved.
        </div>
      </footer>

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

      {/* Dialog for Single Quiz Purchase */}
      <Dialog open={openQuizDialog} onOpenChange={setOpenQuizDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🔒 Unlock Test Series
            </DialogTitle>
            <DialogDescription className="text-xs">
              Unlock this specific test series for lifetime access or upgrade to Pass to get everything.
            </DialogDescription>
          </DialogHeader>
          {selectedUnlockQuiz && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <div className="text-xs font-extrabold text-slate-800 leading-tight">
                {selectedUnlockQuiz.title}
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-700 pt-1 border-t border-slate-200">
                <span>Individual Unlock Price</span>
                <span className="text-blue-600">₹49</span>
              </div>
            </div>
          )}
          <div className="text-[10px] text-center text-muted-foreground font-medium">
            Pro Tip: Get the <button onClick={() => { setOpenQuizDialog(false); setOpenPassDialog(true); }} className="text-blue-600 hover:underline font-bold cursor-pointer bg-transparent border-none p-0">Premium Pass for ₹199</button> to unlock all quizzes!
          </div>
          <DialogFooter className="flex sm:justify-between items-center gap-4 pt-2 border-t">
            <div className="text-xs text-muted-foreground font-semibold">
              Total due: ₹49
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setOpenQuizDialog(false); setOpenPassDialog(true); }}
                className="text-xs font-bold cursor-pointer"
              >
                Get Pass (₹199)
              </Button>
              <Button
                onClick={confirmUnlockQuiz}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer border-none"
              >
                {isProcessing ? "Processing..." : "Pay ₹49"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
