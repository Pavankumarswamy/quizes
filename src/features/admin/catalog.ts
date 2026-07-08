import { push, ref, remove, serverTimestamp, set, update } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export type Category = {
  id: string;
  name: string;
  slug: string;
  order: number;
  imageUrl?: string;
  createdAt?: number | object;
};
export type Subcategory = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  imageUrl?: string;
  order: number;
};

export function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createCategory(name: string, imageUrl?: string) {
  const db = getFirebaseDb();
  const r = push(ref(db, "categories"));
  await set(r, {
    name: name.trim(),
    slug: slugify(name),
    order: Date.now(),
    imageUrl: imageUrl || null,
    createdAt: serverTimestamp(),
  });
  return r.key!;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const { id: _drop, ...rest } = patch;
  await update(ref(getFirebaseDb(), `categories/${id}`), rest);
}

export async function deleteCategory(id: string) {
  const db = getFirebaseDb();
  await remove(ref(db, `categories/${id}`));
  // NOTE: subcategories referencing this categoryId should be cleaned up server-side later.
}

export async function createSubcategory(categoryId: string, name: string, imageUrl?: string) {
  const db = getFirebaseDb();
  const r = push(ref(db, "subcategories"));
  await set(r, {
    categoryId,
    name: name.trim(),
    slug: slugify(name),
    order: Date.now(),
    imageUrl: imageUrl || null,
  });
  return r.key!;
}

export async function updateSubcategory(id: string, patch: Partial<Subcategory>) {
  const { id: _drop, ...rest } = patch;
  await update(ref(getFirebaseDb(), `subcategories/${id}`), rest);
}

export async function deleteSubcategory(id: string) {
  await remove(ref(getFirebaseDb(), `subcategories/${id}`));
}
