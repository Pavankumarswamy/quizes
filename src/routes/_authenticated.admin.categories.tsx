import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, ChevronRight, Image as ImageIcon, X } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  updateCategory,
  updateSubcategory,
  slugify,
  type Category,
  type Subcategory,
} from "@/features/admin/catalog";

export const Route = createFileRoute("/_authenticated/admin/categories")({
  component: CategoriesAdmin,
});

function CategoriesAdmin() {
  const [cats, setCats] = useState<Record<string, Omit<Category, "id">>>({});
  const [subs, setSubs] = useState<Record<string, Omit<Subcategory, "id">>>({});
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: "cat" | "sub";
    mode: "create" | "edit";
    id?: string;
    name: string;
    imageUrl: string;
  }>({ isOpen: false, type: "cat", mode: "create", name: "", imageUrl: "" });

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    const u1 = onValue(ref(db, "categories"), (s) => setCats(s.val() ?? {}));
    const u2 = onValue(ref(db, "subcategories"), (s) => setSubs(s.val() ?? {}));
    return () => {
      u1();
      u2();
    };
  }, []);

  const catList = Object.entries(cats)
    .filter(([_, c]) => !!c)
    .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
  const subList = selectedCatId
    ? Object.entries(subs)
        .filter(([, s]) => s && s.categoryId === selectedCatId)
        .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
    : [];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setModal({ ...modal, imageUrl: url });
      toast.success("Image uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  async function handleSaveModal(e: React.FormEvent) {
    e.preventDefault();
    if (!modal.name.trim()) return;

    try {
      if (modal.type === "cat") {
        if (modal.mode === "create") {
          await createCategory(modal.name, modal.imageUrl);
          toast.success("Category created");
        } else if (modal.mode === "edit" && modal.id) {
          await updateCategory(modal.id, {
            name: modal.name.trim(),
            slug: slugify(modal.name),
            imageUrl: modal.imageUrl,
          });
          toast.success("Category updated");
        }
      } else {
        if (!selectedCatId) return;
        if (modal.mode === "create") {
          await createSubcategory(selectedCatId, modal.name, modal.imageUrl);
          toast.success("Subcategory created");
        } else if (modal.mode === "edit" && modal.id) {
          await updateSubcategory(modal.id, {
            name: modal.name.trim(),
            slug: slugify(modal.name),
            imageUrl: modal.imageUrl,
          });
          toast.success("Subcategory updated");
        }
      }
      setModal({ ...modal, isOpen: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Organize quizzes into categories and subcategories, and upload cover images.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Categories Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Categories</CardTitle>
            <Button
              size="sm"
              onClick={() =>
                setModal({ isOpen: true, type: "cat", mode: "create", name: "", imageUrl: "" })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Add Category
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {catList.map(([id, c]) => {
                const isSelected = selectedCatId === id;
                return (
                  <li
                    key={id}
                    className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                      isSelected ? "bg-accent/50 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="h-8 w-8 rounded overflow-hidden bg-muted flex items-center justify-center shrink-0 border">
                      {c.imageUrl ? (
                        <img src={c.imageUrl} alt={c.name} className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <button
                      className="flex flex-1 items-center justify-between text-left text-sm"
                      onClick={() => setSelectedCatId(id)}
                    >
                      <div className="flex flex-col">
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">/{c.slug}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        setModal({
                          isOpen: true,
                          type: "cat",
                          mode: "edit",
                          id,
                          name: c.name,
                          imageUrl: c.imageUrl || "",
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      onClick={async () => {
                        if (!confirm(`Delete "${c.name}"?`)) return;
                        await deleteCategory(id);
                        if (selectedCatId === id) setSelectedCatId(null);
                        toast.success("Deleted");
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
              {catList.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No categories yet.
                </li>
              )}
            </ul>
          </CardContent>
        </Card>

        {/* Subcategories Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              Subcategories
              {selectedCatId && cats[selectedCatId] && (
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {cats[selectedCatId].name}
                </span>
              )}
            </CardTitle>
            {selectedCatId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setModal({ isOpen: true, type: "sub", mode: "create", name: "", imageUrl: "" })
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add Subcategory
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selectedCatId ? (
              <div className="rounded-md border border-dashed p-8 flex flex-col items-center justify-center text-center text-sm text-muted-foreground bg-muted/10">
                <ChevronRight className="h-8 w-8 text-muted-foreground/30 mb-2" />
                Select a category from the left to manage its subcategories.
              </div>
            ) : (
              <ul className="divide-y rounded-md border">
                {subList.map(([id, s]) => {
                  return (
                    <li key={id} className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors">
                      <div className="h-8 w-8 rounded overflow-hidden bg-muted flex items-center justify-center shrink-0 border">
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt={s.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                        )}
                      </div>
                      <div className="flex-1 flex flex-col text-sm">
                        <span className="font-semibold">{s.name}</span>
                        <span className="text-[10px] text-muted-foreground">/{s.slug}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() =>
                          setModal({
                            isOpen: true,
                            type: "sub",
                            mode: "edit",
                            id,
                            name: s.name,
                            imageUrl: s.imageUrl || "",
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                        onClick={async () => {
                          if (!confirm(`Delete "${s.name}"?`)) return;
                          await deleteSubcategory(id);
                          toast.success("Deleted");
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
                {subList.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No subcategories.
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Shared Dialog for Create/Edit Category/Subcategory */}
      <Dialog open={modal.isOpen} onOpenChange={(open) => setModal({ ...modal, isOpen: open })}>
        <DialogContent>
          <form onSubmit={handleSaveModal}>
            <DialogHeader>
              <DialogTitle>
                {modal.mode === "create" ? "Create" : "Edit"} {modal.type === "cat" ? "Category" : "Subcategory"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={modal.name}
                  onChange={(e) => setModal({ ...modal, name: e.target.value })}
                  placeholder={modal.type === "cat" ? "e.g. Mathematics" : "e.g. Algebra"}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label>Cover Image URL (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    value={modal.imageUrl}
                    onChange={(e) => setModal({ ...modal, imageUrl: e.target.value })}
                    placeholder="Paste image url..."
                  />
                  <Label
                    htmlFor="cat-image-file"
                    className="flex shrink-0 items-center justify-center h-10 px-4 border border-dashed rounded-md bg-muted/40 cursor-pointer text-xs hover:bg-muted/80 transition"
                  >
                    {isUploading ? "Uploading..." : "Upload File"}
                    <input
                      id="cat-image-file"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                  </Label>
                </div>
                {modal.imageUrl && (
                  <div className="mt-2 relative h-32 w-full sm:w-48 border rounded-md overflow-hidden bg-muted">
                    <img src={modal.imageUrl} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setModal({ ...modal, imageUrl: "" })}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal({ ...modal, isOpen: false })}>
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
