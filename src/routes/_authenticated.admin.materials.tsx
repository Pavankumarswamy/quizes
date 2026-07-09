import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, push, set, remove } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Plus,
  Trash2,
  Upload,
  Loader2,
  FileText,
  DollarSign,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/materials")({
  component: AdminMaterialsManager,
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

function AdminMaterialsManager() {
  // DB states
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [subcategories, setSubcategories] = useState<Record<string, Subcategory>>({});
  const [materials, setMaterials] = useState<Record<string, StudyMaterial>>({});

  // Form states
  const [title, setTitle] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [price, setPrice] = useState("0");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");

  // Uploading states
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    
    // Fetch categories
    const unsubCats = onValue(ref(db, "categories"), (snap) => {
      setCategories((snap.val() as Record<string, Category>) ?? {});
    });

    // Fetch subcategories
    const unsubSubs = onValue(ref(db, "subcategories"), (snap) => {
      setSubcategories((snap.val() as Record<string, Subcategory>) ?? {});
    });

    // Fetch study materials
    const unsubMaterials = onValue(ref(db, "studyMaterials"), (snap) => {
      setMaterials((snap.val() as Record<string, StudyMaterial>) ?? {});
    });

    return () => {
      unsubCats();
      unsubSubs();
      unsubMaterials();
    };
  }, []);

  // Upload thumbnail
  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingThumb(true);
    try {
      toast.info("Uploading thumbnail to Cloudinary...");
      const url = await uploadToCloudinary(file);
      setThumbnailUrl(url);
      toast.success("Thumbnail uploaded successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Thumbnail upload failed.";
      toast.error(msg);
    } finally {
      setUploadingThumb(false);
      e.target.value = "";
    }
  };

  // Upload material file (PDF / DOCX)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      toast.info("Uploading material file to Cloudinary...");
      const url = await uploadToCloudinary(file);
      setFileUrl(url);
      toast.success("Material file uploaded successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "File upload failed.";
      toast.error(msg);
    } finally {
      setUploadingFile(false);
      e.target.value = "";
    }
  };

  // Submit form
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !thumbnailUrl.trim() || !fileUrl.trim() || !selectedCategoryId) {
      toast.error("Please fill in title, upload thumbnail and file, and select a category!");
      return;
    }

    setIsSubmitting(true);
    try {
      const db = getFirebaseDb();
      const materialsRef = ref(db, "studyMaterials");
      const newMaterialRef = push(materialsRef);
      const materialId = newMaterialRef.key;

      if (!materialId) throw new Error("Failed to generate key.");

      const materialData: StudyMaterial = {
        id: materialId,
        title: title.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        fileUrl: fileUrl.trim(),
        price: Number(price) || 0,
        categoryId: selectedCategoryId,
        subcategoryId: selectedSubcategoryId || undefined,
        createdAt: Date.now(),
        uploadedBy: "admin",
      };

      await set(newMaterialRef, materialData);
      toast.success("Study material created successfully!");

      // Reset form
      setTitle("");
      setThumbnailUrl("");
      setFileUrl("");
      setPrice("0");
      setSelectedCategoryId("");
      setSelectedSubcategoryId("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create material.";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete material
  const handleDeleteMaterial = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const db = getFirebaseDb();
      await remove(ref(db, `studyMaterials/${id}`));
      toast.success("Study material removed.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      toast.error(msg);
    }
  };

  const materialsList = Object.entries(materials)
    .filter(([_, item]) => !!item)
    .sort((a, b) => b[1].createdAt - a[1].createdAt);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Study Materials Manager</h1>
        <p className="text-sm text-muted-foreground">
          Create, upload, price, and organize downloadable study books, PDFs, and revision sheets.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Creation Form */}
        <Card className="md:col-span-1 border-slate-200/80 shadow-sm self-start">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Create Material</CardTitle>
            <CardDescription className="text-xs">
              Fill in credentials and upload files to create a downloadable study guide.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddMaterial} className="space-y-4">
              {/* Title */}
              <div className="space-y-1">
                <Label htmlFor="title">Material Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Constitutional Law Revision Handout"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              {/* Price */}
              <div className="space-y-1">
                <Label htmlFor="price">Price (₹) - Use 0 for Free</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="text-xs"
                  required
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={selectedCategoryId}
                  onValueChange={(val) => {
                    setSelectedCategoryId(val);
                    setSelectedSubcategoryId("");
                  }}
                >
                  <SelectTrigger id="category" className="text-xs">
                    <SelectValue placeholder="Select Category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categories).map(([id, cat]) => (
                      <SelectItem key={id} value={id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subcategory */}
              <div className="space-y-1">
                <Label htmlFor="subcategory">Subcategory (Optional)</Label>
                <Select
                  value={selectedSubcategoryId}
                  onValueChange={setSelectedSubcategoryId}
                  disabled={!selectedCategoryId}
                >
                  <SelectTrigger id="subcategory" className="text-xs">
                    <SelectValue placeholder="Select Subcategory..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(subcategories)
                      .filter(([_, sub]) => sub.categoryId === selectedCategoryId)
                      .map(([id, sub]) => (
                        <SelectItem key={id} value={id}>
                          {sub.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Thumbnail Upload */}
              <div className="space-y-2 border-t pt-3">
                <Label>Thumbnail Image</Label>
                <div className="flex items-center gap-3">
                  {thumbnailUrl ? (
                    <img
                      src={thumbnailUrl}
                      alt="Thumbnail preview"
                      className="h-10 w-10 object-cover border rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg border border-dashed flex items-center justify-center text-slate-300 text-[10px] uppercase font-bold shrink-0">
                      No Pic
                    </div>
                  )}

                  <div className="flex-1">
                    <label
                      htmlFor="thumb-uploader"
                      className="inline-flex items-center justify-center gap-1 bg-white border hover:bg-slate-50 text-slate-700 text-[11px] font-semibold py-1.5 px-3 rounded-lg cursor-pointer transition-colors shadow-sm"
                    >
                      {uploadingThumb ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3 text-slate-500" />
                          <span>Upload File</span>
                        </>
                      )}
                    </label>
                    <input
                      id="thumb-uploader"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleThumbUpload}
                      disabled={uploadingThumb}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="thumb-url" className="text-[10px] text-slate-400">Or Paste Image URL</Label>
                  <Input
                    id="thumb-url"
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    className="text-xs h-7"
                    disabled={uploadingThumb}
                  />
                </div>
              </div>

              {/* PDF/DOCX File Upload */}
              <div className="space-y-2 border-t pt-3 pb-2">
                <Label>Material Document (PDF or DOCX)</Label>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 text-slate-400">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div className="flex-1">
                    <label
                      htmlFor="file-uploader"
                      className="inline-flex items-center justify-center gap-1 bg-white border hover:bg-slate-50 text-slate-700 text-[11px] font-semibold py-1.5 px-3 rounded-lg cursor-pointer transition-colors shadow-sm"
                    >
                      {uploadingFile ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3 text-slate-500" />
                          <span>Upload Doc File</span>
                        </>
                      )}
                    </label>
                    <input
                      id="file-uploader"
                      type="file"
                      accept=".pdf,.docx"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="file-url" className="text-[10px] text-slate-400">Or Paste Document URL</Label>
                  <Input
                    id="file-url"
                    type="url"
                    placeholder="https://example.com/syllabus.pdf"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    className="text-xs h-7"
                    disabled={uploadingFile}
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || uploadingThumb || uploadingFile}
                className="w-full text-xs font-semibold py-1.5 cursor-pointer"
              >
                {isSubmitting ? "Creating..." : "Create Material"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Materials Table List */}
        <Card className="md:col-span-2 border-slate-200/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold">Ingested Study Materials ({materialsList.length})</CardTitle>
            <CardDescription className="text-xs">
              Full registry of materials published to the catalog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {materialsList.map(([id, item]) => {
                const catName = categories[item.categoryId]?.name ?? "General";
                const subName = item.subcategoryId ? subcategories[item.subcategoryId]?.name : null;

                return (
                  <div
                    key={id}
                    className="flex items-start justify-between border rounded-xl p-4 bg-card shadow-xs gap-4"
                  >
                    <div className="flex gap-3">
                      <div className="h-12 w-12 rounded-lg overflow-hidden border shrink-0 bg-slate-50">
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://images.unsplash.com/photo-1594322436404-5a0526db4d13?auto=format&fit=crop&w=150&q=80";
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-bold text-xs text-foreground line-clamp-1 leading-tight">
                          {item.title}
                        </h4>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground font-semibold">
                          <span className="flex items-center gap-1 text-slate-400">
                            <Clock className="h-3 w-3" />
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          <span>·</span>
                          <Badge variant="secondary" className="text-[8px] font-bold px-1.5 py-0">
                            {catName}
                          </Badge>
                          {subName && (
                            <>
                              <span>·</span>
                              <Badge variant="outline" className="text-[8px] font-bold px-1.5 py-0">
                                {subName}
                              </Badge>
                            </>
                          )}
                          <span>·</span>
                          <span className="font-extrabold text-blue-600">
                            {item.price === 0 ? "Free" : `₹${item.price}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0 items-center">
                      <Button asChild size="sm" variant="outline" className="h-8 text-xs font-semibold rounded-lg">
                        <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                          View File
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-red-50"
                        onClick={() => handleDeleteMaterial(id, item.title)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              {materialsList.length === 0 && (
                <div className="text-center py-12 text-xs text-muted-foreground border border-dashed rounded-xl bg-slate-50/50">
                  No study materials created yet. Use the form on the left to add your first book or guide!
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
