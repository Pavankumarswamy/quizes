import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { onValue, ref } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavBar } from "@/components/NavBar";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Folder,
  FileText,
  Clock,
  Award,
  Sparkles,
  Download,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/materials/$docId")({
  component: MaterialSyllabusViewer,
});

type SyllabusNode = {
  title: string;
  kind: "unit" | "topic" | "subtopic";
  parentId: string | null;
  order: number;
  chunkIds?: string[];
};

type SyllabusChunk = {
  text: string;
  page: number;
  nodeIds?: string[];
};

type DocumentItem = {
  title: string;
  cloudinaryUrl?: string;
  supabaseStoragePath?: string;
  pages: number;
  categoryId?: string;
  subcategoryId?: string;
};

type Quiz = {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  subcategoryId?: string;
  durationSec?: number;
  status?: "draft" | "published" | "archived";
  isFree?: boolean;
  questionIds?: string[];
};

function MaterialSyllabusViewer() {
  const { docId } = Route.useParams();
  const { user } = useAuth();

  const [document, setDocument] = useState<DocumentItem | null>(null);
  const [nodes, setNodes] = useState<Record<string, SyllabusNode>>({});
  const [chunks, setChunks] = useState<Record<string, SyllabusChunk>>({});
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [categories, setCategories] = useState<Record<string, { name: string }>>({});
  const [subcategories, setSubcategories] = useState<Record<string, { name: string }>>({});
  const [userProfile, setUserProfile] = useState<{
    isPremium?: boolean;
    hasPass?: boolean;
    purchasedQuizzes?: Record<string, boolean>;
  } | null>(null);

  const [loading, setLoading] = useState(true);

  // Tree and notes interactive states
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const db = getFirebaseDb();

    // Fetch document metadata
    const docRef = ref(db, `documents/${docId}`);
    const unsubDoc = onValue(docRef, (snap) => {
      setDocument(snap.val());
    });

    // Fetch syllabus tree nodes
    const nodesRef = ref(db, `syllabusTrees/${docId}/nodes`);
    const unsubNodes = onValue(
      nodesRef,
      (snap) => {
        setNodes(snap.val() ?? {});
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    // Fetch syllabus chunks
    const chunksRef = ref(db, `docChunks/${docId}`);
    const unsubChunks = onValue(chunksRef, (snap) => {
      setChunks(snap.val() ?? {});
    });

    // Fetch categories and subcategories for names
    const unsubCats = onValue(ref(db, "categories"), (snap) => {
      setCategories(snap.val() ?? {});
    });
    const unsubSubs = onValue(ref(db, "subcategories"), (snap) => {
      setSubcategories(snap.val() ?? {});
    });

    // Fetch quizzes for practice recommendations
    const unsubQuizzes = onValue(ref(db, "quizzes"), (snap) => {
      setQuizzes(snap.val() ?? {});
    });

    return () => {
      unsubDoc();
      unsubNodes();
      unsubChunks();
      unsubCats();
      unsubSubs();
      unsubQuizzes();
    };
  }, [docId]);

  // Fetch user profile if logged in
  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
      setUserProfile(snap.val() || null);
    });
    return () => unsub();
  }, [user]);

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Find linked study notes text for selected node
  const activeSyllabusNotes = useMemo(() => {
    if (!selectedNodeId || !nodes[selectedNodeId]) return null;
    const node = nodes[selectedNodeId];
    const chunkIds = node.chunkIds || [];

    if (chunkIds.length === 0) return null;

    // Collect texts from linked chunks, sorted by page
    return chunkIds
      .map((id) => chunks[id])
      .filter(Boolean)
      .sort((a, b) => a.page - b.page);
  }, [selectedNodeId, nodes, chunks]);

  // Get matching practice quizzes based on category and subcategory
  const matchingQuizzes = useMemo(() => {
    if (!document) return [];
    return Object.entries(quizzes)
      .map(([id, q]) => ({ id, ...q }))
      .filter(
        (q) =>
          q.status === "published" &&
          q.categoryId === document.categoryId &&
          (q.subcategoryId === document.subcategoryId || !document.subcategoryId)
      )
      .slice(0, 3);
  }, [quizzes, document]);

  const isQuizUnlocked = (quiz: Quiz) => {
    return quiz.isFree !== false || 
           userProfile?.isPremium === true || 
           userProfile?.hasPass === true || 
           userProfile?.purchasedQuizzes?.[quiz.id] === true;
  };

  const renderTreeNode = (nodeId: string, depth: number = 0) => {
    const node = nodes[nodeId];
    if (!node) return null;

    const children = Object.entries(nodes)
      .filter(([_, n]) => n.parentId === nodeId)
      .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));

    const isCollapsed = collapsedNodes[nodeId];
    const hasChildren = children.length > 0;
    const isSelected = selectedNodeId === nodeId;

    return (
      <div key={nodeId} className="space-y-1">
        <div
          onClick={() => setSelectedNodeId(nodeId)}
          className={`flex items-center justify-between rounded-xl border p-3 transition-all cursor-pointer ${
            isSelected
              ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
              : "bg-white border-transparent hover:bg-slate-50 text-slate-700 hover:border-slate-200"
          }`}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse(nodeId);
                }}
                className="text-slate-400 hover:text-slate-600 shrink-0 cursor-pointer p-0.5"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-5 shrink-0" />
            )}

            <Folder
              className={`h-4 w-4 shrink-0 ${
                isSelected ? "text-blue-500" : node.kind === "unit" ? "text-amber-500" : "text-sky-500"
              }`}
            />

            <span className="text-xs truncate">{node.title}</span>
          </div>

          <Badge variant="outline" className={`text-[8px] uppercase tracking-wider font-bold shrink-0 ${
            isSelected ? "border-blue-300 text-blue-700 bg-blue-100/55" : "border-slate-200 text-slate-500"
          }`}>
            {node.kind}
          </Badge>
        </div>

        {hasChildren && !isCollapsed && (
          <div className="space-y-1">
            {children.map(([childId]) => renderTreeNode(childId, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootNodes = Object.entries(nodes)
    .filter(([_, n]) => !n.parentId)
    .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500 bg-slate-50">
        Loading syllabus tree structure…
      </div>
    );
  }

  const catName = document?.categoryId ? categories[document.categoryId]?.name : "";
  const subcatName = document?.subcategoryId ? subcategories[document.subcategoryId]?.name : "";

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-800 font-sans flex flex-col justify-between">
      <div>
        <NavBar />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Header section */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="space-y-1">
              <Button asChild variant="ghost" size="sm" className="-ml-2 text-slate-500 hover:text-slate-700 cursor-pointer">
                <Link to="/materials">
                  <ChevronLeft className="mr-1.5 h-4 w-4" /> Back to Materials
                </Link>
              </Button>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {document?.title ?? "Syllabus details"}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                {catName && <span>Category: {catName}</span>}
                {catName && subcatName && <span>•</span>}
                {subcatName && <span>Subcategory: {subcatName}</span>}
                {document?.pages && <span>•</span>}
                {document?.pages && <span>{document.pages} Pages</span>}
              </div>
            </div>

            {(document?.cloudinaryUrl || document?.supabaseStoragePath) && (
              <Button asChild variant="outline" className="shadow-sm font-semibold rounded-xl text-xs gap-1.5 cursor-pointer self-start md:self-center">
                <a
                  href={document.supabaseStoragePath || document.cloudinaryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-3.5 w-3.5" /> Download Full PDF
                </a>
              </Button>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Syllabus Tree Index */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="border-slate-100 shadow-sm p-4 bg-white">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-3">
                  Syllabus Units & Topics
                </div>
                <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                  {rootNodes.map(([id]) => renderTreeNode(id))}
                  {rootNodes.length === 0 && (
                    <div className="text-center py-12 text-xs text-slate-400 border border-dashed rounded-xl">
                      No syllabus tree mapping available.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right: Notes Details and Practice recommendations */}
            <div className="lg:col-span-2 space-y-6">
              {/* Study Notes Card */}
              <Card className="border-slate-100 shadow-sm bg-white min-h-[300px]">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold flex items-center gap-1.5 text-slate-800">
                      <BookOpen className="h-4.5 w-4.5 text-blue-600" />
                      Syllabus Chapter Notes
                    </CardTitle>
                    <CardDescription className="text-[10px] text-slate-400 font-medium">
                      Select a syllabus item from the left index to view study summaries
                    </CardDescription>
                  </div>
                  {selectedNodeId && nodes[selectedNodeId] && (
                    <Badge variant="secondary" className="text-[10px] font-bold text-blue-700 bg-blue-50/80 px-2.5 py-0.5 border-none">
                      {nodes[selectedNodeId].title.slice(0, 30)}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-5">
                  {activeSyllabusNotes ? (
                    <div className="space-y-6 max-h-[450px] overflow-y-auto pr-2">
                      {activeSyllabusNotes.map((chunk) => (
                        <div key={chunk.page} className="space-y-2 border-b border-slate-100/60 last:border-0 pb-4 last:pb-0">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                            <span>Syllabus summary</span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-500">Page {chunk.page}</span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                            {chunk.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : selectedNodeId ? (
                    <div className="text-center py-16 text-slate-400 text-xs font-medium">
                      No study notes details ingested for this specific node.
                    </div>
                  ) : (
                    <div className="text-center py-16 text-slate-400 text-xs font-medium flex flex-col items-center justify-center space-y-2">
                      <Sparkles className="h-8 w-8 text-blue-200" />
                      <span>Select a unit or topic from the index on the left to read notes.</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recommended Practice Quizzes */}
              {matchingQuizzes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Sparkles className="h-4.5 w-4.5 text-amber-500 fill-amber-500" />
                    <h3 className="font-extrabold text-sm text-slate-800">
                      Linked Practice Series
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    {matchingQuizzes.map((quiz) => {
                      const unlocked = user ? isQuizUnlocked(quiz) : false;
                      const hasAttempt = false;

                      return (
                        <Card key={quiz.id} className="border-slate-100 p-4 shadow-sm hover:shadow-md hover:border-blue-500/20 bg-white flex flex-col justify-between min-h-[140px] transition-all">
                          <div className="space-y-2">
                            <h4 className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight">
                              {quiz.title}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-400">
                              <Clock className="h-2.5 w-2.5" />
                              <span>{Math.round((quiz.durationSec ?? 0) / 60)} mins</span>
                              <span>•</span>
                              <span>{quiz.questionIds?.length ?? 0} Qs</span>
                            </div>
                          </div>

                          <div className="pt-3">
                            <Button asChild size="xs" className="w-full text-[10px] font-bold rounded-lg h-7 cursor-pointer">
                              <Link
                                to={!user ? "/auth" : unlocked ? "/quizzes/$quizId" : "/exams"}
                                params={user && unlocked ? { quizId: quiz.id } : undefined}
                                search={!unlocked ? { category: quiz.categoryId } : undefined}
                              >
                                {!user ? "Login to test" : unlocked ? "Practice Mock" : "🔒 Unlock Exam"}
                              </Link>
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}
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
    </div>
  );
}
