import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthProvider";
import { useEffect, useState, useMemo } from "react";
import { onValue, ref, query, orderByChild, equalTo, update } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { NavBar } from "@/components/NavBar";
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
  ArrowRight,
  ShieldAlert,
  BrainCircuit,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
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

type Testimonial = {
  name: string;
  achievement: string;
  avatar: string;
  quote: string;
};

// Fallback high-fidelity default data
const DEFAULT_HERO_IMAGES = [
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1600&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1600&q=80"
];

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    name: "Samridhi Talwar",
    achievement: "AIR 1 | Delhi Judicial 2024",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80",
    quote: "The practice tests on electricwisers were identical to the real exam pattern. It helped me manage time and build confidence.",
  },
  {
    name: "Rohan Kumar Biswal",
    achievement: "AIR 27 | GATE CS 2025",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80",
    quote: "Test series analysis is top-notch. It highlights weak chapters and compares performance with toppers in detail.",
  },
  {
    name: "Ishant Shukla",
    achievement: "AIR 8 | SSC CGL 2024",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=100&q=80",
    quote: "Choosing this platform was the turning point in my preparation. The free live tests gave me real-time exam vibes.",
  },
];

const FEATURES = [
  "Dynamic Practice Exams",
  "Anti-Cheating Simulations",
  "Structured Syllabus Progress",
  "Scorecard Performance Metrics",
  "Facial Presence Checks",
  "Tab Lockout Shield",
  "Real-Time Leaderboards",
  "Downloadable PDF Law Guides",
  "Interactive Unit Revision Trees",
  "Chapter Completion Badges",
  "Adaptive Difficulty Mocks",
  "Detailed Explanatory Solutions",
  "Countdown Mock Timers",
  "Progress Attempt Resumptions",
  "Flashcard Summary Handouts",
  "Section-Wise Scorecard Maps",
  "Instant Grade Reports",
  "Peer Percentage Comparators",
  "Syllabus Unit Navigation",
  "Premium Exam Passes",
  "Law Topic Revision Notes",
  "Daily Quiz Challenges",
  "AI Preparation Planner",
  "Accuracy Progress Tracking",
];

function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // DB States
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [materials, setMaterials] = useState<Record<string, StudyMaterial>>({});
  const [userProfile, setUserProfile] = useState<{
    isPremium?: boolean;
    hasPass?: boolean;
    purchasedQuizzes?: Record<string, boolean>;
    purchasedMaterials?: Record<string, boolean>;
  } | null>(null);

  // Admin Managed Homepage Content
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [topSections, setTopSections] = useState<Record<string, boolean>>({});
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  // Local UI States
  const [heroSearch, setHeroSearch] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openPassDialog, setOpenPassDialog] = useState(false);
  const [openQuizDialog, setOpenQuizDialog] = useState(false);
  const [selectedUnlockQuiz, setSelectedUnlockQuiz] = useState<Quiz | null>(null);
  
  const [openMaterialDialog, setOpenMaterialDialog] = useState(false);
  const [selectedUnlockMaterial, setSelectedUnlockMaterial] = useState<StudyMaterial | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch standard data
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

    // Fetch Admin Managed Homepage configurations
    const unsubHero = onValue(ref(db, "homepage/heroImages"), (snap) => {
      setHeroImages(snap.val() || []);
    });
    const unsubTop = onValue(ref(db, "homepage/topSections"), (snap) => {
      setTopSections(snap.val() || {});
    });
    const unsubTestimonials = onValue(ref(db, "homepage/testimonials"), (snap) => {
      setTestimonials(snap.val() || []);
    });

    return () => {
      unsubCats();
      unsubQuizzes();
      unsubMats();
      unsubHero();
      unsubTop();
      unsubTestimonials();
    };
  }, []);

  // Fetch User Profile
  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
      setUserProfile(snap.val() || null);
    });
    return () => unsub();
  }, [user]);

  // Slideshow automatic rotation
  const slides = heroImages.length > 0 ? heroImages : DEFAULT_HERO_IMAGES;
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [slides]);

  // Helper to verify if quiz is unlocked
  const isQuizUnlocked = (quiz: Quiz) => {
    return quiz.isFree !== false || 
           userProfile?.isPremium === true || 
           userProfile?.hasPass === true || 
           userProfile?.purchasedQuizzes?.[quiz.id] === true;
  };

  // Paywall checkout handlers
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

  // Published quizzes
  const allPublishedQuizzes = useMemo(() => {
    return Object.entries(quizzes)
      .map(([id, q]) => ({ id, ...q }))
      .filter((q) => q.status === "published");
  }, [quizzes]);

  // Filter quizzes by search query
  const searchedQuizzes = useMemo(() => {
    if (!heroSearch.trim()) return [];
    return allPublishedQuizzes.filter((q) =>
      q.title.toLowerCase().includes(heroSearch.toLowerCase())
    );
  }, [allPublishedQuizzes, heroSearch]);

  // Filter categories marked by admin as "Top Sections"
  const topSectionsCategories = useMemo(() => {
    return Object.entries(categories)
      .map(([id, cat]) => ({ id, ...cat }))
      .filter((cat) => topSections[cat.id] === true);
  }, [categories, topSections]);

  const isMaterialUnlocked = (item: StudyMaterial) => {
    return item.price === 0 || 
           userProfile?.isPremium === true || 
           userProfile?.hasPass === true || 
           userProfile?.purchasedMaterials?.[item.id] === true;
  };

  const handleUnlockMaterial = (item: StudyMaterial) => {
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setSelectedUnlockMaterial(item);
    setOpenMaterialDialog(true);
  };

  const confirmUnlockMaterial = async () => {
    if (!selectedUnlockMaterial || !user) return;
    setIsProcessing(true);
    try {
      const db = getFirebaseDb();
      await update(ref(db, `users/${user.uid}/purchasedMaterials`), {
        [selectedUnlockMaterial.id]: true,
      });
      toast.success(`Unlocked "${selectedUnlockMaterial.title}" successfully!`);
      setOpenMaterialDialog(false);
    } catch (e) {
      toast.error("Failed to unlock material.");
    } finally {
      setIsProcessing(false);
    }
  };

  const latestQuizzesList = useMemo(() => {
    return [...allPublishedQuizzes].slice(-4).reverse();
  }, [allPublishedQuizzes]);

  const latestMaterialsList = useMemo(() => {
    return Object.entries(materials)
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 4);
  }, [materials]);

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-800 font-sans flex flex-col justify-between">
      <div>
        {/* Navigation Bar */}
        <NavBar />

        {/* Hero Section with Admin Slideshow */}
        <div className="relative w-full h-[570px] md:h-[690px] overflow-hidden flex items-center justify-center bg-slate-950 -mt-[120px] pt-[80px] md:pt-[120px] rounded-b-[25px]">
          {/* Background Images Slideshow */}
          {slides.map((url, index) => (
            <div
              key={url}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentSlide ? "opacity-40" : "opacity-0"
              }`}
            >
              <img
                src={url}
                alt={`Hero slide ${index + 1}`}
                className="w-full h-full object-cover scale-105 transform transition duration-[5000ms]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
            </div>
          ))}



          {/* Content Overlay */}
          <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white space-y-6">
            <Badge className="bg-blue-600/90 text-white font-extrabold tracking-wider uppercase px-4 py-1.5 text-[10px] border-none shadow-lg shadow-blue-500/20">
              India's Premier Syllabus Prep Engine
            </Badge>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight" style={{ textShadow: "0 4px 12px rgba(0,0,0,0.6)" }}>
              Master Your Prep With <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-200 to-white">
                electricwisers Syllabus Quizzes
              </span>
            </h1>

            <p className="text-sm md:text-base text-slate-300 max-w-xl mx-auto font-medium" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
              Take mock challenges, revise syllabus components, and track live statistics. Ingest your materials and start practicing today.
            </p>

            {/* Search Bar */}
            <div className="max-w-xl mx-auto mt-8 relative">
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl rounded-2xl p-2.5 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20">
                <Search className="h-5 w-5 text-slate-300 ml-3 shrink-0" />
                <Input
                  type="text"
                  placeholder="Which exam are you preparing for? Search quizzes..."
                  value={heroSearch}
                  onChange={(e) => setHeroSearch(e.target.value)}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-3 text-sm placeholder:text-slate-400 text-white bg-transparent h-9"
                />
                {heroSearch && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHeroSearch("")}
                    className="text-slate-300 hover:text-white text-xs shrink-0 rounded-lg px-2 h-7"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Instant Search Results Dropdown */}
              {heroSearch.trim() && (
                <div className="absolute left-0 right-0 mt-2 bg-white text-slate-800 border rounded-xl shadow-2xl z-30 text-left overflow-hidden divide-y divide-slate-100">
                  <div className="px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Matches found ({searchedQuizzes.length})
                  </div>
                  {searchedQuizzes.length === 0 ? (
                    <div className="p-4 text-xs text-muted-foreground text-center">
                      No quizzes found matching "{heroSearch}"
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {searchedQuizzes.map((q) => {
                        const unlocked = user ? isQuizUnlocked(q) : false;
                        return (
                          <Link
                            key={q.id}
                            to={!user ? "/auth" : (!unlocked ? "/" : "/quizzes/$quizId")}
                            params={user && unlocked ? { quizId: q.id } : undefined}
                            onClick={() => {
                              if (!user) {
                                navigate({ to: "/auth" });
                              } else if (!unlocked) {
                                handleUnlockQuiz(q);
                              }
                            }}
                            className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 transition-colors"
                          >
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-slate-800">{q.title}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {Math.round((q.durationSec ?? 0) / 60)} mins • {q.questionIds?.length ?? 0} questions
                              </div>
                            </div>
                            <Badge variant={!user ? "outline" : (unlocked ? "default" : "outline")} className="text-[9px] font-bold">
                              {!user ? "🔒 Login to attempt" : (unlocked ? "Unlocked / Free" : "🔒 Unlock (₹49)")}
                            </Badge>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Features Marquee Strip */}
        <div className="w-full bg-[#fafbfc] dark:bg-slate-950 py-3 overflow-hidden relative">
          {/* Subtle shading overlays for left and right edges */}
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#fafbfc] dark:from-slate-950 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#fafbfc] dark:from-slate-950 to-transparent z-10 pointer-events-none" />

          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .marquee-track {
              display: flex;
              width: max-content;
              animation: marquee 35s linear infinite;
            }
            .marquee-track:hover {
              animation-play-state: paused;
            }
          `}</style>

          <div className="marquee-track flex gap-4">
            {/* First Set */}
            {FEATURES.map((f, i) => (
              <div
                key={`f1-${i}`}
                className="bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 px-5 py-2.5 rounded-full text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap shadow-xs select-none hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
              >
                {f}
              </div>
            ))}
            {/* Second Set (Duplicate for Loop) */}
            {FEATURES.map((f, i) => (
              <div
                key={`f2-${i}`}
                className="bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 px-5 py-2.5 rounded-full text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap shadow-xs select-none hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
              >
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Content Container */}
        <div className="max-w-7xl mx-auto px-6 py-16 space-y-20">
          
          {/* Main Quiz Sections */}
          <div className="space-y-8">
            <div className="flex items-end justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  Browse Exam Categories
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Select a section to explore syllabus components and mock test series
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs font-bold gap-1 cursor-pointer">
                <Link to="/exams">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {Object.entries(categories).map(([id, cat]) => (
                <Link
                  key={id}
                  to="/exams"
                  search={{ category: id }}
                  className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 hover:shadow-xl hover:shadow-slate-100 hover:border-blue-500/20 transition-all duration-300 flex flex-col justify-between min-h-[140px]"
                >
                  <div className="space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <h3 className="font-bold text-sm text-slate-800 leading-snug group-hover:text-blue-600 transition-colors">
                      {cat.name}
                    </h3>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider pt-2">
                    <span>Explore syllabus</span>
                    <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
              {Object.keys(categories).length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-400 border border-dashed rounded-2xl">
                  No exam categories published yet.
                </div>
              )}
            </div>
          </div>

          {/* New Row: Latest Quizzes */}
          <div className="space-y-8">
            <div className="flex items-end justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  Latest Prep Quizzes
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Freshly updated mock challenges to test your speed and accuracy
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs font-bold gap-1 cursor-pointer">
                <Link to="/exams">
                  View All Quizzes <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {latestQuizzesList.map((quiz) => {
                const catName = quiz.categoryId ? categories[quiz.categoryId]?.name : null;
                const unlocked = user ? isQuizUnlocked(quiz) : false;

                return (
                  <Card key={quiz.id} className="overflow-hidden border-slate-150 hover:border-blue-500/20 hover:shadow-lg transition-all duration-300 bg-white flex flex-col justify-between">
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-50">
                      <img
                        src={quiz.coverUrl || "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=350&q=80"}
                        alt={quiz.title}
                        className="h-full w-full object-cover"
                      />
                      {catName && (
                        <Badge className="absolute top-3 left-3 bg-blue-600 text-white font-bold text-[8px] uppercase px-2 py-0.5 border-none">
                          {catName}
                        </Badge>
                      )}
                      <Badge className={`absolute top-3 right-3 font-bold text-[8px] px-2 py-0.5 border-none shadow-sm ${
                        unlocked || quiz.isFree !== false ? "bg-emerald-500 text-white" : "bg-blue-600 text-white"
                      }`}>
                        {quiz.isFree !== false ? "Free" : unlocked ? "Unlocked" : "₹49"}
                      </Badge>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-800 line-clamp-2 leading-tight">
                          {quiz.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{Math.round((quiz.durationSec ?? 0) / 60)} Mins</span>
                          <span>•</span>
                          <span>{quiz.questionIds?.length ?? 0} Mocks</span>
                        </div>
                      </div>

                      <div className="pt-1">
                        {!user ? (
                          <Button asChild className="w-full text-xs font-bold rounded-xl h-8 cursor-pointer">
                            <Link to="/auth">Login to Attempt</Link>
                          </Button>
                        ) : unlocked ? (
                          <Button asChild className="w-full text-xs font-bold rounded-xl h-8 cursor-pointer">
                            <Link to="/quizzes/$quizId" params={{ quizId: quiz.id }}>
                              Attempt Now
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleUnlockQuiz(quiz)}
                            className="w-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-8 cursor-pointer border-none"
                          >
                            Unlock Quiz (₹49)
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {latestQuizzesList.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-400 border border-dashed rounded-2xl">
                  No mock quizzes published yet.
                </div>
              )}
            </div>
          </div>

          {/* New Row: Latest Uploaded Materials */}
          <div className="space-y-8">
            <div className="flex items-end justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  Latest Study Handouts
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Structured law syllabi, notes, and revision documents added recently
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 text-xs font-bold gap-1 cursor-pointer">
                <Link to="/materials">
                  View All Handouts <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {latestMaterialsList.map((item) => {
                const catName = item.categoryId ? categories[item.categoryId]?.name : null;
                const unlocked = user ? isMaterialUnlocked(item) : false;

                return (
                  <Card key={item.id} className="overflow-hidden border-slate-150 hover:border-blue-500/20 hover:shadow-lg transition-all duration-300 bg-white flex flex-col justify-between">
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-50">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?auto=format&fit=crop&w=350&q=80";
                        }}
                      />
                      {catName && (
                        <Badge className="absolute top-3 left-3 bg-blue-600 text-white font-bold text-[8px] uppercase px-2 py-0.5 border-none">
                          {catName}
                        </Badge>
                      )}
                      <Badge className={`absolute top-3 right-3 font-bold text-[8px] px-2 py-0.5 border-none shadow-sm ${
                        unlocked || item.price === 0 ? "bg-emerald-500 text-white" : "bg-blue-600 text-white"
                      }`}>
                        {item.price === 0 ? "Free" : unlocked ? "Unlocked" : `₹${item.price}`}
                      </Badge>
                    </div>

                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-800 line-clamp-2 leading-tight">
                          {item.title}
                        </h4>
                        <div className="text-[9px] text-slate-400 font-semibold mt-1">
                          Uploaded: {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="pt-1">
                        {!user ? (
                          <Button asChild className="w-full text-xs font-bold rounded-xl h-8 cursor-pointer">
                            <Link to="/auth">Login to Download</Link>
                          </Button>
                        ) : unlocked ? (
                          <Button asChild className="w-full text-xs font-bold rounded-xl h-8 cursor-pointer">
                            <a href={item.fileUrl} download target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5">
                              <Download className="h-3 w-3" /> Download
                            </a>
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleUnlockMaterial(item)}
                            className="w-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-8 cursor-pointer border-none flex items-center justify-center gap-1"
                          >
                            <Lock className="h-3 w-3" /> Buy Handout (₹{item.price})
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}

              {latestMaterialsList.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-400 border border-dashed rounded-2xl">
                  No study handouts published yet.
                </div>
              )}
            </div>
          </div>

          {/* Top Sections (Marked by Admin) */}
          {topSectionsCategories.length > 0 && (
            <div className="space-y-8">
              <div className="flex items-end justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Featured Syllabus Sectors
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Hand-picked categories marked as high popularity by our education team
                  </p>
                </div>
                <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-700 font-bold border-none text-[9px] px-2 py-0.5 uppercase tracking-wide">
                  Top Choice ★
                </Badge>
              </div>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {topSectionsCategories.map((cat) => {
                  const quizCount = allPublishedQuizzes.filter(q => q.categoryId === cat.id).length;
                  return (
                    <Card key={cat.id} className="overflow-hidden border-slate-100 hover:border-slate-200/80 hover:shadow-lg transition-all duration-300 bg-white flex flex-col justify-between">
                      <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50/50 px-2 py-0.5 rounded-md">
                            Featured
                          </span>
                          <span className="text-xs font-semibold text-slate-400">
                            {quizCount} Practice Quizzes
                          </span>
                        </div>
                        <h3 className="font-extrabold text-base text-slate-800">
                          {cat.name}
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Syllabus modules mapped according to real exams. Ingest syllabus documents, generate tests, and practice.
                        </p>
                      </div>
                      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                          Ready to practice
                        </span>
                        <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-8 text-[11px] rounded-lg">
                          <Link to="/exams" search={{ category: cat.id }}>
                            Attempt mock
                          </Link>
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Premium Test Pass Promo Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white p-8 md:p-12 shadow-xl shadow-indigo-500/10 border-none">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none -translate-y-12 translate-x-12" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none translate-y-12 -translate-x-12" />

            <div className="relative z-10 max-w-3xl space-y-6">
              <Badge className="bg-amber-400 text-slate-900 font-extrabold hover:bg-amber-300 border-none uppercase tracking-wider px-3.5 py-1 text-[10px]">
                electricwisers pass
              </Badge>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight leading-none">
                Get Unlimited Exam Access with Pass!
              </h2>
              <p className="text-xs md:text-sm text-blue-100 font-medium leading-relaxed max-w-xl">
                Unlock our complete catalog of mock quizzes, subject test guides, live practice papers, and detailed solution reviews. Practice without constraints.
              </p>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-bold text-blue-50">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> 10,000+ Questions
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Full Detailed Reports
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" /> Re-attempt Anytime
                </span>
              </div>

              <div className="pt-4 flex flex-wrap gap-3">
                <Button 
                  onClick={() => {
                    if (!user) {
                      navigate({ to: "/auth" });
                    } else {
                      setOpenPassDialog(true);
                    }
                  }}
                  size="lg" 
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-6 py-5 rounded-xl shadow-lg hover:shadow-emerald-500/10 transition-all text-xs cursor-pointer border-none"
                >
                  Unlock Premium Pass (₹199)
                </Button>
              </div>
            </div>
          </div>

          {/* Testimonials Wall of Fame */}
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Hear It Directly From Our Students
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Join thousands of successful candidates who trained with our dashboards
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {(testimonials.length > 0 ? testimonials : DEFAULT_TESTIMONIALS).map((t, index) => (
                <Card key={index} className="p-6 flex flex-col justify-between space-y-4 border-slate-100 hover:border-slate-200 hover:shadow-md transition-all duration-300 bg-white">
                  <p className="text-xs text-slate-600 leading-relaxed italic font-medium">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 bg-slate-100 border border-slate-100">
                      <img src={t.avatar} alt={t.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-800">{t.name}</h4>
                      <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide">
                        {t.achievement}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
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

      {/* Dialog for Study Material Purchase */}
      <Dialog open={openMaterialDialog} onOpenChange={setOpenMaterialDialog}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              🔒 Purchase Study Material
            </DialogTitle>
            <DialogDescription className="text-xs">
              Gain lifetime access to view and download this specialized resource, or upgrade to Pass to unlock everything.
            </DialogDescription>
          </DialogHeader>
          {selectedUnlockMaterial && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
              <div className="text-xs font-extrabold text-slate-800 leading-tight">
                {selectedUnlockMaterial.title}
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-700 pt-1 border-t border-slate-200">
                <span>Unlock Price</span>
                <span className="text-blue-600">₹{selectedUnlockMaterial.price}</span>
              </div>
            </div>
          )}
          <div className="text-[10px] text-center text-muted-foreground font-medium">
            Pro Tip: Get the <button onClick={() => { setOpenMaterialDialog(false); setOpenPassDialog(true); }} className="text-blue-600 hover:underline font-bold cursor-pointer bg-transparent border-none p-0">Premium Pass for ₹199</button> to unlock all resources!
          </div>
          <DialogFooter className="flex sm:justify-between items-center gap-4 pt-2 border-t">
            <div className="text-xs text-muted-foreground font-semibold">
              Total due: ₹{selectedUnlockMaterial?.price || 0}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setOpenMaterialDialog(false); setOpenPassDialog(true); }}
                className="text-xs font-bold cursor-pointer"
              >
                Get Pass (₹199)
              </Button>
              <Button
                onClick={confirmUnlockMaterial}
                disabled={isProcessing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer border-none"
              >
                {isProcessing ? "Processing..." : `Pay ₹${selectedUnlockMaterial?.price}`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
