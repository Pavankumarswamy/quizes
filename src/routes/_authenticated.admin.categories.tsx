import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, ChevronRight } from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [newCat, setNewCat] = useState("");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [newSub, setNewSub] = useState("");
  const [editing, setEditing] = useState<{ type: "cat" | "sub"; id: string; value: string } | null>(
    null,
  );

  useEffect(() => {
    const db = getFirebaseDb();
    const u1 = onValue(ref(db, "categories"), (s) => setCats(s.val() ?? {}));
    const u2 = onValue(ref(db, "subcategories"), (s) => setSubs(s.val() ?? {}));
    return () => {
      u1();
      u2();
    };
  }, []);

  const catList = Object.entries(cats).sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0));
  const subList = selectedCatId
    ? Object.entries(subs)
        .filter(([, s]) => s.categoryId === selectedCatId)
        .sort((a, b) => (a[1].order ?? 0) - (b[1].order ?? 0))
    : [];

  async function onAddCat() {
    if (!newCat.trim()) return;
    try {
      await createCategory(newCat);
      setNewCat("");
      toast.success("Category created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function onAddSub() {
    if (!newSub.trim() || !selectedCatId) return;
    try {
      await createSubcategory(selectedCatId, newSub);
      setNewSub("");
      toast.success("Subcategory created");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const { type, id, value } = editing;
    if (!value.trim()) return;
    try {
      if (type === "cat") {
        await updateCategory(id, { name: value.trim(), slug: slugify(value) });
      } else {
        await updateSubcategory(id, { name: value.trim(), slug: slugify(value) });
      }
      setEditing(null);
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Organize quizzes into categories and subcategories.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Mathematics"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onAddCat()}
              />
              <Button onClick={onAddCat}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ul className="divide-y rounded-md border">
              {catList.map(([id, c]) => {
                const isEditing = editing?.type === "cat" && editing.id === id;
                const isSelected = selectedCatId === id;
                return (
                  <li
                    key={id}
                    className={`flex items-center gap-2 px-3 py-2 ${
                      isSelected ? "bg-accent/50" : ""
                    }`}
                  >
                    {isEditing ? (
                      <>
                        <Input
                          className="h-8"
                          value={editing.value}
                          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                          onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                          autoFocus
                        />
                        <Button size="sm" variant="ghost" onClick={saveEdit}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <button
                          className="flex flex-1 items-center justify-between text-left text-sm"
                          onClick={() => setSelectedCatId(id)}
                        >
                          <span>
                            <span className="font-medium">{c.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">/{c.slug}</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing({ type: "cat", id, value: c.name })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            if (!confirm(`Delete "${c.name}"?`)) return;
                            await deleteCategory(id);
                            if (selectedCatId === id) setSelectedCatId(null);
                            toast.success("Deleted");
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Subcategories{" "}
              {selectedCatId && cats[selectedCatId] && (
                <span className="text-sm font-normal text-muted-foreground">
                  · in {cats[selectedCatId].name}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedCatId ? (
              <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Select a category to manage its subcategories.
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Algebra"
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onAddSub()}
                  />
                  <Button onClick={onAddSub}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <ul className="divide-y rounded-md border">
                  {subList.map(([id, s]) => {
                    const isEditing = editing?.type === "sub" && editing.id === id;
                    return (
                      <li key={id} className="flex items-center gap-2 px-3 py-2">
                        {isEditing ? (
                          <>
                            <Input
                              className="h-8"
                              value={editing.value}
                              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                              autoFocus
                            />
                            <Button size="sm" variant="ghost" onClick={saveEdit}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 text-sm">
                              <span className="font-medium">{s.name}</span>
                              <span className="ml-2 text-xs text-muted-foreground">/{s.slug}</span>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditing({ type: "sub", id, value: s.name })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={async () => {
                                if (!confirm(`Delete "${s.name}"?`)) return;
                                await deleteSubcategory(id);
                                toast.success("Deleted");
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </>
                        )}
                      </li>
                    );
                  })}
                  {subList.length === 0 && (
                    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                      No subcategories.
                    </li>
                  )}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
