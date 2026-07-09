import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { onValue, ref, update } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NavBar } from "@/components/NavBar";
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
  FileText,
  Clock,
  Download,
  Search,
  FolderMinus,
  Zap,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/materials")({
  component: MaterialsPage,
});

type Category = { name: string };
type Subcategory = { name: string; categoryId: string };
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

function MaterialsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // DB States
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [subcategories, setSubcategories] = useState<Record<string, Subcategory>>({});
  const [materials, setMaterials] = useState<Record<string, StudyMaterial>>({});
  
  // User profile for purchased materials
  const [userProfile, setUserProfile] = useState<{
    isPremium?: boolean;
    hasPass?: boolean;
    purchasedMaterials?: Record<string, boolean>;
  } | null>(null);

  // Local UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  
  // Checkout states
  const [openPassDialog, setOpenPassDialog] = useState(false);
  const [openMaterialDialog, setOpenMaterialDialog] = useState(false);
  const [selectedUnlockMaterial, setSelectedUnlockMaterial] = useState<StudyMaterial | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    
    const unsubCats = onValue(ref(db, "categories"), (snap) => {
      setCategories((snap.val() as Record<string, Category>) ?? {});
    });
    const unsubSubs = onValue(ref(db, "subcategories"), (snap) => {
      setSubcategories((snap.val() as Record<string, Subcategory>) ?? {});
    });
    const unsubDocs = onValue(ref(db, "studyMaterials"), (snap) => {
      setMaterials((snap.val() as Record<string, StudyMaterial>) ?? {});
    });

    return () => {
      unsubCats();
      unsubSubs();
      unsubDocs();
    };
  }, []);

  // Fetch user profile
  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, `users/${user.uid}`), (snap) => {
      setUserProfile(snap.val() || null);
    });
    return () => unsub();
  }, [user]);

  const isMaterialUnlocked = (item: StudyMaterial) => {
    return item.price === 0 || 
           userProfile?.isPremium === true || 
           userProfile?.hasPass === true || 
           userProfile?.purchasedMaterials?.[item.id] === true;
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
      toast.success("Premium Pass activated successfully! All materials unlocked.");
      setOpenPassDialog(false);
    } catch (e) {
      toast.error("Failed to purchase Pass.");
    } finally {
      setIsProcessing(false);
    }
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

  const parsedMaterials = useMemo(() => {
    return Object.entries(materials)
      .map(([id, item]) => ({ id, ...item }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    let result = parsedMaterials;

    if (selectedCategoryId !== "all") {
      result = result.filter((doc) => doc.categoryId === selectedCategoryId);
    }

    if (searchQuery.trim()) {
      result = result.filter((doc) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return result;
  }, [parsedMaterials, selectedCategoryId, searchQuery]);

  return (
    <div className="min-h-screen bg-[#fafbfc] text-slate-800 font-sans flex flex-col justify-between">
      <div>
        <NavBar />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                Study Materials & Handouts
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Download structured PDFs, law guides, and reference syllabi compiled by our instructors
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm w-full sm:w-64 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                <Search className="h-4 w-4 text-slate-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Search materials..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-0 focus:outline-none focus:ring-0 text-xs w-full text-slate-700 bg-transparent placeholder:text-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Categories Quick Filter Row */}
          {Object.keys(categories).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-4">
              <button
                onClick={() => setSelectedCategoryId("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                  selectedCategoryId === "all"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                All Categories
              </button>
              {Object.entries(categories).map(([id, cat]) => (
                <button
                  key={id}
                  onClick={() => setSelectedCategoryId(id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                    selectedCategoryId === id
                      ? "bg-blue-50 border-blue-200 text-blue-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Materials Grid list */}
          {filteredMaterials.length === 0 ? (
            <Card className="p-16 text-center border-slate-200 border-dashed bg-white shadow-xs rounded-2xl flex flex-col items-center justify-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                <FolderMinus className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-slate-800">No Study Materials Found</h3>
                <p className="text-xs text-slate-500 max-w-sm font-medium">
                  There are no study materials matching your active filters.
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMaterials.map((item) => {
                const catName = item.categoryId ? categories[item.categoryId]?.name : null;
                const subName = item.subcategoryId ? subcategories[item.subcategoryId]?.name : null;
                const unlocked = user ? isMaterialUnlocked(item) : false;

                return (
                  <Card
                    key={item.id}
                    className="overflow-hidden flex flex-col group border-slate-200/80 hover:border-blue-500/50 hover:shadow-lg transition-all duration-300 bg-white"
                  >
                    <div className="relative aspect-video w-full overflow-hidden bg-slate-100 border-b border-slate-100">
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?auto=format&fit=crop&w=350&q=80";
                        }}
                      />
                      <div className="absolute top-3 right-3 flex items-center gap-1">
                        <Badge className={`font-extrabold text-[9px] px-2 py-0.5 border-none shadow-sm ${
                          unlocked || item.price === 0 ? "bg-emerald-500 text-white" : "bg-blue-600 text-white"
                        }`}>
                          {item.price === 0 ? "Free" : unlocked ? "Unlocked" : `₹${item.price}`}
                        </Badge>
                      </div>
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {catName && (
                            <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200/60 font-semibold text-[8px] py-0 px-1.5">
                              {catName}
                            </Badge>
                          )}
                          {subName && (
                            <Badge variant="outline" className="bg-blue-50/50 text-blue-600 border-blue-100 font-semibold text-[8px] py-0 px-1.5">
                              {subName}
                            </Badge>
                          )}
                        </div>

                        <h3 className="font-extrabold text-sm text-slate-800 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2">
                          {item.title}
                        </h3>

                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold">
                          <Clock className="h-3 w-3" />
                          <span>Uploaded: {new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="pt-1">
                        {!user ? (
                          <Button asChild className="w-full text-xs font-bold rounded-xl h-9 cursor-pointer">
                            <Link to="/auth">
                              Login to Download
                            </Link>
                          </Button>
                        ) : unlocked ? (
                          <Button asChild className="w-full text-xs font-bold rounded-xl h-9 group-hover:bg-blue-600 cursor-pointer">
                            <a href={item.fileUrl} download target="_blank" rel="noopener noreferrer">
                              <Download className="mr-1.5 h-3.5 w-3.5" /> Download File
                            </a>
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleUnlockMaterial(item)}
                            className="w-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-9 cursor-pointer border-none flex items-center justify-center gap-1"
                          >
                            <Lock className="h-3.5 w-3.5" /> Buy Handout (₹{item.price})
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
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
