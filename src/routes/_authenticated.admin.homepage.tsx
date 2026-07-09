import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, set } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Plus,
  Trash2,
  Star,
  Grid,
  MessageSquare,
  Upload,
  Loader2,
  FileImage,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/homepage")({
  component: AdminHomepageManager,
});

type Category = { name: string };
type Testimonial = {
  name: string;
  achievement: string;
  avatar: string;
  quote: string;
};

function AdminHomepageManager() {
  const [activeTab, setActiveTab] = useState<"hero" | "categories" | "testimonials">("hero");

  // Database states
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [topSections, setTopSections] = useState<Record<string, boolean>>({});
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  // Form input states
  const [newHeroUrl, setNewHeroUrl] = useState("");
  const [uploadingHero, setUploadingHero] = useState(false);
  
  const [testiName, setTestiName] = useState("");
  const [testiAchievement, setTestiAchievement] = useState("");
  const [testiAvatar, setTestiAvatar] = useState("");
  const [testiQuote, setTestiQuote] = useState("");
  const [uploadingTestiAvatar, setUploadingTestiAvatar] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    
    // Fetch quiz categories
    const unsubCats = onValue(ref(db, "categories"), (snap) => {
      setCategories((snap.val() as Record<string, Category>) ?? {});
    });

    // Fetch Admin Homepage config
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
      unsubHero();
      unsubTop();
      unsubTestimonials();
    };
  }, []);

  // Hero image actions: Manual URL
  const handleAddHeroImage = async () => {
    if (!newHeroUrl.trim()) return;
    try {
      const db = getFirebaseDb();
      const updatedList = [...heroImages, newHeroUrl.trim()];
      await set(ref(db, "homepage/heroImages"), updatedList);
      setNewHeroUrl("");
      toast.success("Hero image added successfully!");
    } catch (e) {
      toast.error("Failed to add hero image.");
    }
  };

  // Hero image actions: Cloudinary Upload
  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHero(true);
    try {
      toast.info("Uploading image to Cloudinary...");
      const url = await uploadToCloudinary(file);
      
      const db = getFirebaseDb();
      const updatedList = [...heroImages, url];
      await set(ref(db, "homepage/heroImages"), updatedList);
      toast.success("Hero image uploaded and saved successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      toast.error(msg);
    } finally {
      setUploadingHero(false);
      // Reset input element
      e.target.value = "";
    }
  };

  const handleDeleteHeroImage = async (indexToDelete: number) => {
    try {
      const db = getFirebaseDb();
      const updatedList = heroImages.filter((_, index) => index !== indexToDelete);
      await set(ref(db, "homepage/heroImages"), updatedList);
      toast.success("Hero image removed.");
    } catch (e) {
      toast.error("Failed to remove image.");
    }
  };

  // Featured categories toggle
  const handleToggleTopSection = async (categoryId: string) => {
    try {
      const db = getFirebaseDb();
      const currentVal = topSections[categoryId] || false;
      await set(ref(db, `homepage/topSections/${categoryId}`), !currentVal);
      toast.success("Top section configuration updated!");
    } catch (e) {
      toast.error("Failed to update featured category.");
    }
  };

  // Testimonial Avatar Cloudinary Upload
  const handleTestiAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingTestiAvatar(true);
    try {
      toast.info("Uploading avatar to Cloudinary...");
      const url = await uploadToCloudinary(file);
      setTestiAvatar(url);
      toast.success("Avatar uploaded! Remember to submit the testimonial form.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      toast.error(msg);
    } finally {
      setUploadingTestiAvatar(false);
      // Reset input element
      e.target.value = "";
    }
  };

  // Testimonials actions
  const handleAddTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testiName || !testiAchievement || !testiQuote) {
      toast.error("Please fill in name, achievement, and quotes!");
      return;
    }

    const avatarUrl = testiAvatar.trim() || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80";

    const newTestimonial: Testimonial = {
      name: testiName.trim(),
      achievement: testiAchievement.trim(),
      avatar: avatarUrl,
      quote: testiQuote.trim(),
    };

    try {
      const db = getFirebaseDb();
      const updatedList = [...testimonials, newTestimonial];
      await set(ref(db, "homepage/testimonials"), updatedList);
      
      // Reset inputs
      setTestiName("");
      setTestiAchievement("");
      setTestiAvatar("");
      setTestiQuote("");
      
      toast.success("Testimonial added!");
    } catch (e) {
      toast.error("Failed to save testimonial.");
    }
  };

  const handleDeleteTestimonial = async (indexToDelete: number) => {
    try {
      const db = getFirebaseDb();
      const updatedList = testimonials.filter((_, index) => index !== indexToDelete);
      await set(ref(db, "homepage/testimonials"), updatedList);
      toast.success("Testimonial removed.");
    } catch (e) {
      toast.error("Failed to remove testimonial.");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Homepage Content Manager</h1>
        <p className="text-sm text-muted-foreground">
          Manage Hero slideshow banners, featured Top Sections, and student Testimonials.
        </p>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("hero")}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "hero"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <ImageIcon className="h-4 w-4" />
          Hero Slides
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "categories"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Grid className="h-4 w-4" />
          Top Sections
        </button>
        <button
          onClick={() => setActiveTab("testimonials")}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-extrabold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "testimonials"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          Testimonials
        </button>
      </div>

      {/* Tab Contents */}
      <div className="mt-4">
        {/* Tab 1: Hero Slides */}
        {activeTab === "hero" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Input & Upload card */}
            <Card className="md:col-span-1 border-slate-200/80 shadow-sm self-start">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Add Hero Slide Image</CardTitle>
                <CardDescription className="text-xs">
                  Upload an image from your device or paste a URL to add a slideshow background.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload Option */}
                <div className="space-y-1.5 pb-2 border-b border-slate-100">
                  <Label>Upload Image File</Label>
                  <label
                    htmlFor="hero-uploader"
                    className="flex flex-col items-center justify-center border border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    {uploadingHero ? (
                      <div className="flex flex-col items-center gap-2 text-xs text-blue-600 font-semibold">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Uploading to Cloudinary...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <Upload className="h-6 w-6 text-slate-400" />
                        <span>Click to choose & upload</span>
                      </div>
                    )}
                  </label>
                  <input
                    id="hero-uploader"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleHeroImageUpload}
                    disabled={uploadingHero}
                  />
                </div>

                {/* Manual URL Input Option */}
                <div className="space-y-1.5">
                  <Label htmlFor="hero-url">Or Paste Image URL</Label>
                  <Input
                    id="hero-url"
                    type="url"
                    placeholder="https://images.unsplash.com/.../width=1600"
                    value={newHeroUrl}
                    onChange={(e) => setNewHeroUrl(e.target.value)}
                    className="text-xs"
                    disabled={uploadingHero}
                  />
                </div>

                {newHeroUrl && (
                  <div className="space-y-1.5 border rounded-lg p-2.5 bg-slate-50/50">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                      Preview Image
                    </span>
                    <img
                      src={newHeroUrl}
                      alt="Hero slide preview"
                      className="w-full h-32 object-cover rounded border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?auto=format&fit=crop&w=150&q=80";
                      }}
                    />
                  </div>
                )}

                <Button
                  onClick={handleAddHeroImage}
                  disabled={!newHeroUrl.trim() || uploadingHero}
                  className="w-full text-xs font-semibold py-1.5 cursor-pointer"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Save Slide URL
                </Button>
              </CardContent>
            </Card>

            {/* List slides */}
            <Card className="md:col-span-2 border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Slideshow list ({heroImages.length})</CardTitle>
                <CardDescription className="text-xs">
                  Active slides rotating in the homepage hero banner.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {heroImages.map((url, index) => (
                    <div
                      key={index}
                      className="group relative overflow-hidden rounded-xl border border-slate-100 shadow-xs h-32"
                    >
                      <img
                        src={url}
                        alt={`Slide preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-between p-3.5 transition-opacity opacity-100 sm:opacity-0 group-hover:opacity-100">
                        <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0">
                          Slide #{index + 1}
                        </Badge>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-8 w-8 rounded-lg shadow-md cursor-pointer shrink-0 border-none"
                          onClick={() => handleDeleteHeroImage(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {heroImages.length === 0 && (
                    <div className="col-span-full py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-slate-50/50">
                      No custom hero slides uploaded. The system is showing default placeholder images.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab 2: Featured Categories / Top Sections */}
        {activeTab === "categories" && (
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Top Section Selector</CardTitle>
              <CardDescription className="text-xs">
                Select which main quiz categories appear in the "Featured / Top Sections" row on the public home page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                {Object.entries(categories).map(([id, cat]) => {
                  const isTop = topSections[id] === true;
                  return (
                    <div
                      key={id}
                      onClick={() => handleToggleTopSection(id)}
                      className={`flex items-center justify-between border rounded-2xl p-4 transition-all cursor-pointer select-none ${
                        isTop
                          ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                          : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isTop ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                        }`}>
                          <Star className={`h-4.5 w-4.5 ${isTop ? "fill-current" : ""}`} />
                        </div>
                        <span className="text-xs font-bold truncate">{cat.name}</span>
                      </div>

                      <Badge variant={isTop ? "default" : "outline"} className="text-[9px] shrink-0">
                        {isTop ? "Featured" : "Hidden"}
                      </Badge>
                    </div>
                  );
                })}

                {Object.keys(categories).length === 0 && (
                  <div className="col-span-full py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    No categories found to configure. Please create some in the Categories tab.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Testimonials Management */}
        {activeTab === "testimonials" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Input Form */}
            <Card className="md:col-span-1 border-slate-200/80 shadow-sm self-start">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Add Testimonial</CardTitle>
                <CardDescription className="text-xs">
                  Feature student reviews or exam toppers on the wall of fame.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddTestimonial} className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="t-name">Student Name</Label>
                    <Input
                      id="t-name"
                      placeholder="e.g. Samridhi Talwar"
                      value={testiName}
                      onChange={(e) => setTestiName(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="t-achieve">Achievement / Rank</Label>
                    <Input
                      id="t-achieve"
                      placeholder="e.g. AIR 1 | Delhi Judicial 2024"
                      value={testiAchievement}
                      onChange={(e) => setTestiAchievement(e.target.value)}
                      className="text-xs"
                      required
                    />
                  </div>

                  {/* Avatar Upload / Input Option */}
                  <div className="space-y-2 pb-2 border-b border-slate-100">
                    <Label>Avatar Photo</Label>
                    <div className="flex gap-3 items-center">
                      {testiAvatar ? (
                        <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 border">
                          <img src={testiAvatar} alt="Testimonial avatar preview" className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full border border-dashed flex items-center justify-center text-slate-300 shrink-0 text-xs font-semibold uppercase">
                          No Pic
                        </div>
                      )}
                      
                      <div className="flex-1">
                        <label
                          htmlFor="avatar-uploader"
                          className="inline-flex items-center justify-center gap-1 bg-white border hover:bg-slate-50 text-slate-700 text-[11px] font-semibold py-1.5 px-3 rounded-lg cursor-pointer transition-colors shadow-sm"
                        >
                          {uploadingTestiAvatar ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="h-3 w-3 text-slate-500" />
                              <span>Upload photo file</span>
                            </>
                          )}
                        </label>
                        <input
                          id="avatar-uploader"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleTestiAvatarUpload}
                          disabled={uploadingTestiAvatar}
                        />
                      </div>
                    </div>

                    <div className="space-y-1 pt-1.5">
                      <Label htmlFor="t-avatar" className="text-[10px] text-slate-400">Or Paste Image URL</Label>
                      <Input
                        id="t-avatar"
                        type="url"
                        placeholder="https://images.unsplash.com/..."
                        value={testiAvatar}
                        onChange={(e) => setTestiAvatar(e.target.value)}
                        className="text-xs h-7"
                        disabled={uploadingTestiAvatar}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="t-quote">Quote text</Label>
                    <textarea
                      id="t-quote"
                      placeholder="The practice tests on electricwisers were identical..."
                      value={testiQuote}
                      onChange={(e) => setTestiQuote(e.target.value)}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full text-xs font-semibold py-1.5 cursor-pointer">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Save Testimonial
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* List testimonials */}
            <Card className="md:col-span-2 border-slate-200/80 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold">Active Testimonials ({testimonials.length})</CardTitle>
                <CardDescription className="text-xs">
                  Reviews currently visible to users on the home page wall of fame.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {testimonials.map((t, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between border border-slate-100 rounded-xl p-4 bg-slate-50/50 hover:bg-slate-50 transition-all gap-4"
                    >
                      <div className="flex gap-3">
                        <div className="h-10 w-10 rounded-full overflow-hidden shrink-0 border bg-white">
                          <img src={t.avatar} alt={t.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <h4 className="font-bold text-xs text-slate-800">{t.name}</h4>
                            <Badge variant="outline" className="text-[8px] py-0 px-1 font-bold text-blue-600 bg-blue-50/50 border-blue-100">
                              {t.achievement}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-normal italic font-medium">
                            "{t.quote}"
                          </p>
                        </div>
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg shrink-0 text-destructive hover:bg-red-50"
                        onClick={() => handleDeleteTestimonial(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {testimonials.length === 0 && (
                    <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl bg-slate-50/50">
                      No custom reviews uploaded. The system is showing default fallback testimonials.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
