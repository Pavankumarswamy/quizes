# AI Quiz Platform — Phases 1–3 Plan

Scope confirmed with you:

- **Backend:** Firebase (Auth + Realtime Database) — client SDKs; you provide the Firebase project + web config.
- **Media:** Both Supabase Storage (for AI/RAG pipeline needs like server-readable PDFs) **and** Cloudinary (for question/quiz images, thumbnails). You provide Cloudinary cloud name + unsigned upload preset.
- **AI/RAG:** Lovable AI Gateway (Gemini) via TanStack server functions. PDF parsing + embeddings server-side; vectors stored back in Firebase RTDB as chunk records.
- **Coding runner:** UI + `CodeExecutor` adapter interface with mock only. No real execution backend.
- **Deferred to later phases:** anti-proctoring, ML-Kit face detection, coding runner backend, payments/Cashfree, bundles purchase flow (schema in, UI stubbed), analytics dashboards.

---

## Scope in this plan

### Phase 1 — Foundation

Auth, roles, dashboard shells, categories/subcategories, basic quiz CRUD, MCQ attempt engine with real-time question palette.

### Phase 2 — Question bank + quiz builder

Full manual question authoring for all objective types (MCQ, multi-select, fill-blanks, match, true/false, image, coding-stub), quiz builder that picks from the bank, publish/draft states, Cloudinary uploads.

### Phase 3 — PDF ingest + RAG + AI generation

PDF upload, syllabus extraction into a nested tree, tree editor, AI question generation scoped to selected tree nodes, duplicate detection via embedding similarity, review/approve queue into the question bank.

---

## Section 1 — Architecture

```text
Browser (React + TanStack Start)
  │
  ├── Firebase Web SDK  ── Auth (email/pw), RTDB (realtime reads/writes, palette sync)
  ├── Cloudinary widget ── unsigned uploads for images
  │
  └── TanStack server functions (Cloudflare Worker)
        ├── PDF parse + chunk         (pdfjs-dist)
        ├── Embeddings (gemini-embedding-001)
        ├── Question generation (google/gemini-3-flash-preview)
        ├── Duplicate check (cosine sim vs stored embeddings)
        └── Firebase Admin writes (approved questions, syllabus trees)
              via firebase-admin with service account (server secret)
```

Two Firebase surfaces:

- **Client SDK** for auth, realtime reads/writes users perform (attempts, answers, palette).
- **Admin SDK on the server** for AI-generated bulk writes, so RTDB rules can restrict admin-only paths to service-account writes.

---

## Section 2 — Firebase Realtime Database schema

Top-level nodes (only Phase 1–3 shown; deferred nodes noted):

```json
{
  "users": {
    "$uid": { "email": "", "displayName": "", "role": "user|admin", "createdAt": 0 }
  },
  "categories": {
    "$catId": { "name": "", "slug": "", "iconUrl": "", "order": 0, "createdAt": 0 }
  },
  "subcategories": {
    "$subId": { "categoryId": "", "name": "", "slug": "", "order": 0 }
  },
  "documents": {
    "$docId": {
      "title": "", "cloudinaryUrl": "" | "supabaseStoragePath": "",
      "pages": 0, "status": "uploaded|parsing|parsed|failed",
      "uploadedBy": "$uid", "createdAt": 0
    }
  },
  "syllabusTrees": {
    "$docId": {
      "nodes": {
        "$nodeId": { "parentId": null|"", "title": "", "order": 0, "kind": "unit|topic|subtopic", "chunkIds": [""] }
      }
    }
  },
  "docChunks": {
    "$docId": {
      "$chunkId": { "text": "", "page": 0, "embedding": [/* float[] */], "nodeIds": [""] }
    }
  },
  "questionBank": {
    "$qId": {
      "type": "mcq|multi|fill|match|tf|image|coding",
      "text": "", "imageUrl": "",
      "options": [{ "id":"a","text":"","imageUrl":"","correct":false }],
      "answer": null,                     // shape varies by type
      "explanation": "", "explanationImageUrl": "",
      "categoryId": "", "subcategoryId": "",
      "syllabusRefs": [{ "docId":"", "nodeId":"", "chunkIds":[""] }],
      "difficulty": "easy|medium|hard",
      "marks": 1, "negativeMarks": 0,
      "source": "manual|ai",
      "status": "draft|approved|rejected|published",
      "embedding": [/* for dup detection */],
      "createdBy": "$uid", "createdAt": 0
    }
  },
  "quizzes": {
    "$quizId": {
      "title": "", "description": "", "coverUrl": "",
      "categoryId": "", "subcategoryId": "",
      "durationSec": 0, "totalMarks": 0, "passingMarks": 0,
      "negativeMarking": false, "shuffleQuestions": true, "shuffleOptions": true,
      "questionIds": [""],
      "isFree": true, "price": 0,                // schema-ready, purchase UI later
      "status": "draft|published|archived",
      "createdBy": "$uid", "createdAt": 0
    }
  },
  "attempts": {
    "$attemptId": {
      "quizId": "", "userId": "",
      "startedAt": 0, "submittedAt": 0, "durationSec": 0,
      "status": "in_progress|submitted|auto_submitted",
      "score": 0, "maxScore": 0
    }
  },
  "attemptAnswers": {
    "$attemptId": {
      "$questionId": {
        "answer": null,                            // shape per type
        "status": "not_visited|visited|answered|marked|answered_marked",
        "updatedAt": 0
      }
    }
  },
  "generationJobs": {
    "$jobId": {
      "docId": "", "nodeIds": [""], "counts": { "mcq":10 }, "difficulty": "mixed",
      "status": "queued|running|done|failed", "producedQuestionIds": [""],
      "createdBy": "$uid", "createdAt": 0
    }
  }
}
```

RTDB rules (sketch): `users/$uid` self read/write; `categories`/`quizzes` public read, admin-only write; `attempts` + `attemptAnswers` scoped by `auth.uid == userId`; `questionBank` admin-only write, admin-only read for `draft`, published-scoped read for users only via denormalized quiz question fetch.

Deferred nodes (stubbed, not built now): `bundles`, `purchases`, `paymentOrders`, `proctoringLogs`, `codingSubmissions`, `analytics`.

---

## Section 3 — Admin dashboard (Phase 1–3 pages)

Layout: sidebar + topbar shell (`_authenticated/admin/*` — role check via `users/$uid/role == "admin"` gate).

Pages built:

1. **Overview** — counts of categories, quizzes, questions, users, docs; recent generation jobs.
2. **Categories** — CRUD table + reorder, icon upload (Cloudinary).
3. **Subcategories** — CRUD nested under category.
4. **Documents** — upload PDF (Cloudinary for delivery + duplicate to Supabase Storage for server parse), list, status pill.
5. **Syllabus Explorer** — tree/accordion view per document, checkboxes per node, inline rename/add/delete/reorder nodes, "Generate questions from selection" CTA.
6. **AI Quiz Generator** — form: select doc → tree nodes preselected → counts per question type → difficulty → generate. Streams progress, deposits into review queue.
7. **Question Bank** — filterable table (type, category, syllabus tag, status, source). Row actions: preview, edit, approve, reject, regenerate, delete. Bulk approve/reject.
8. **Manual Question Editor** — one form per type, image upload, explanation, tags, live preview.
9. **Quiz Builder** — metadata form + question picker from bank + drag-reorder + shuffle/negative/duration/marks + preview + publish.
10. **Quiz List** — table with status, publish/unpublish, duplicate, archive.
11. **Users** — list, promote/demote admin (Admin SDK server fn).

Deferred admin pages (nav item hidden or "coming soon"): Bundles/Pricing, Attempt Analytics, Anti-Proctoring Logs, Settings.

---

## Section 4 — User dashboard (Phase 1)

Layout: sidebar + topbar shell (`_authenticated/*`).

Pages built:

1. **Dashboard** — categories grid, recent attempts.
2. **Categories** → **Subcategory quiz list** — cards, filters (difficulty, free/paid label, attempted).
3. **Quiz details** — description, rules, "Start quiz".
4. **Quiz attempt** — real-time engine (see Section 6).
5. **Result** — score, per-question review, explanations.
6. **Attempt history** — list.
7. **Profile** — display name, email, password change.

Purchase UI: paid quizzes show a disabled "Locked (purchase later)" state — schema in, checkout deferred.

---

## Section 5 — RAG pipeline

Server functions (in `src/lib/rag.functions.ts`, admin-only via role check + Firebase ID token verification):

1. **`parsePdf(docId)`**
   - Load PDF from Supabase Storage (server-readable).
   - Use `pdfjs-dist` to extract text per page.
   - Chunk: sliding window ~800 tokens with 100-token overlap; also keep heading-based splits (regex on font-size hints from pdfjs text items) to feed the syllabus stage.
2. **`extractSyllabus(docId)`**
   - Send heading candidates + first N chars per chunk to `google/gemini-3-flash-preview` with a JSON-schema output asking for `{nodes:[{title, kind, parentTitle, chunkIndexes}]}`.
   - Materialize into `syllabusTrees/$docId/nodes` with generated IDs; map chunks → nodes.
3. **`embedChunks(docId)`**
   - Batch call `google/gemini-embedding-001` on chunks.
   - Store vectors under `docChunks/$docId/$chunkId/embedding`.
4. **`generateQuestions({docId, nodeIds, counts, difficulty})`**
   - Retrieve chunk texts for selected nodes.
   - Prompt Gemini with the chunks + strict JSON schema for the requested type mix.
   - For each candidate: embed it, cosine-compare vs `questionBank/*/embedding` filtered by `docId`; drop if `sim > 0.9`.
   - Insert survivors as `status:"draft", source:"ai"` with `syllabusRefs` pointing back to node + chunk IDs.
   - Return job summary; UI polls or subscribes to `generationJobs/$jobId`.

All server fns read `LOVABLE_API_KEY` and Firebase Admin credentials from server env only. `FIREBASE_SERVICE_ACCOUNT_JSON` will be requested via `add_secret` when we reach Phase 3.

---

## Section 6 — Quiz engine

Client state comes from RTDB refs so palette + autosave sync in realtime:

- On **start quiz**: create `attempts/$attemptId` with `startedAt`, snapshot question order into local state (shuffled per quiz config).
- **Per-question interaction**: writes to `attemptAnswers/$attemptId/$questionId` — palette left panel subscribes to that path with `onValue`, so status colors flip instantly without reloads.
- **Timer**: derived from `startedAt + durationSec`; local `setInterval` for display, server-fn (`submitAttempt`) authoritatively enforces on submit/auto-submit.
- **Buttons**: Save & Next, Clear, Mark for Review, Previous, Submit (with confirm modal showing counts).
- **Auto-submit**: when timer hits 0, client fires `submitAttempt`; a safety server-fn also refuses answer writes past deadline.
- **Scoring** (server fn): reads `attemptAnswers`, grades per type (MCQ exact, multi-select partial-optional, fill normalized, match pair-set equality, tf exact), applies negative marks, writes `attempts.score` + `submittedAt` + `status`.
- **Resume**: if `status == in_progress` and `now < startedAt + durationSec`, user can re-enter and state rehydrates from RTDB.

Question-type renderers: `MCQRenderer`, `MultiRenderer`, `FillRenderer`, `MatchRenderer` (dropdown pairing, drag-drop is a later enhancement), `TrueFalseRenderer`, `ImageRenderer` (zoom modal), `CodingRenderer` (Monaco editor + language select + mock run/submit via `CodeExecutor` interface).

---

## Section 7 — Anti-proctoring

Deferred. Placeholder module `src/features/proctoring/` with a `ProctoringProvider` no-op and event bus so Phase 4 can wire ML Kit + tab/focus listeners without touching the attempt engine.

## Section 8 — Coding quiz

UI + `interface CodeExecutor { run(code, lang, tests): Promise<Result> }` with a `MockExecutor` returning fixed pass/fail. Real Judge0/Piston adapter deferred.

---

## Section 9 — Reusable UI components

`DataTable`, `Drawer`, `ConfirmDialog`, `EmptyState`, `SkeletonCard`, `StatusBadge`, `FileDropzone` (Cloudinary), `TreeView` (syllabus), `QuestionPreview`, `QuestionPalette`, `Timer`, `RichPreview`, `Stat`, `AdminShell`, `UserShell`.

---

## Section 10 — Folder structure

```text
src/
  routes/
    __root.tsx
    index.tsx
    auth.tsx
    _authenticated/
      route.tsx                 // role-agnostic auth gate (custom, non-managed since Firebase)
      dashboard.tsx
      categories/index.tsx
      categories/$slug.tsx
      quizzes/$quizId.tsx
      attempt/$attemptId.tsx
      result/$attemptId.tsx
      history.tsx
      profile.tsx
      admin/
        route.tsx               // admin role gate
        overview.tsx
        categories.tsx
        subcategories.tsx
        documents.tsx
        syllabus/$docId.tsx
        generate.tsx
        questions/index.tsx
        questions/new.tsx
        questions/$qId.tsx
        quizzes/index.tsx
        quizzes/new.tsx
        quizzes/$quizId.tsx
        users.tsx
    api/
      // server routes only if a webhook is needed later
  lib/
    firebase.client.ts          // client SDK init from VITE_FIREBASE_*
    firebase-admin.server.ts    // admin SDK (server only)
    cloudinary.ts               // upload widget config
    rag.functions.ts            // parsePdf, extractSyllabus, embedChunks, generateQuestions
    quiz.functions.ts           // submitAttempt, gradeAttempt
    users.functions.ts          // setRole (admin only)
    ai-gateway.server.ts        // Lovable AI provider helper
  features/
    auth/         (hooks, useAuthUser, useRole)
    admin/        (tables, forms per module)
    quiz/         (engine, renderers, palette, timer)
    rag/          (tree editor, generator form)
    proctoring/   (stub)
    coding/       (editor + MockExecutor)
  components/ui/  (shadcn primitives already present)
```

---

## Section 11 — Build order (this plan delivers 1–3)

- **Build cycle 1 — Phase 1a:** Firebase init + auth (email/pw, signup, logout), `_authenticated` gate, `admin` role gate, admin shell, user shell, Categories + Subcategories CRUD, empty quiz list pages.
- **Build cycle 2 — Phase 1b:** Manual MCQ authoring (minimal), Quiz Builder (MCQ-only), user quiz attempt engine with real-time palette + timer + autosave + scoring, result page.
- **Build cycle 3 — Phase 2:** Remaining question types (multi/fill/match/tf/image/coding-stub) end-to-end (author + render + grade), Cloudinary image uploads, publish/draft workflow, bank filters + bulk actions.
- **Build cycle 4 — Phase 3a:** Documents upload (Cloudinary + Supabase Storage mirror), PDF parse + chunk server fn, syllabus extraction, tree editor UI.
- **Build cycle 5 — Phase 3b:** Embeddings, AI generation job, duplicate detection, review queue → approve into bank, wire generated questions into Quiz Builder.

Each cycle ends with a runnable milestone.

---

## Section 12 — Smart additions worth including now

- Server-side ID token verification on every admin server fn (`firebase-admin.auth().verifyIdToken`) so RTDB rules aren't the only defense.
- Question `embedding` stored at creation time (manual too) so dedupe works across manual + AI questions.
- Attempt `answersHash` written on submit for tamper detection.

## Section 13 — Risks & constraints (be aware)

- **Firebase on this stack is not natively supported.** No integration tooling; you own the Firebase project, web config, service account, and RTDB rules. Config goes in via `VITE_FIREBASE_*` (client) and `FIREBASE_SERVICE_ACCOUNT_JSON` (server secret).
- **Realtime Database at scale**: fan-out reads on `questionBank` will get heavy; we'll denormalize per-quiz question snapshots to keep attempt reads O(quiz size). Firestore would fit better if you're open to switching.
- **PDF parsing in a Cloudflare Worker**: `pdfjs-dist` works but is memory-heavy on 50+ page PDFs; we'll cap at 50 pages initially and stream chunking.
- **Cloudinary unsigned uploads** expose the preset; that's standard but rate/format-restrict the preset in your Cloudinary console.
- **Anti-copy / F12 / right-click blocks** are deterrents, not security — will be labeled as such in Phase 4.
- **RAG quality** depends heavily on PDF structure; expect to hand-edit the syllabus tree for messy scans. OCR for scanned PDFs is out of scope for Phase 3.

---

Approve to start with **Build cycle 1 (Phase 1a: Firebase auth + role gates + admin/user shells + Categories/Subcategories CRUD)**. When you approve I'll also ask you for your Firebase web config and Cloudinary cloud name/upload preset.
