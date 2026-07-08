import { createServerFn } from "@tanstack/react-start";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database, ref, update, set, get, push, serverTimestamp } from "firebase/database";
import fs from "fs";
import path from "path";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Robust server-side env variable reader (reads process.env or .env file directly)
// ---------------------------------------------------------------------------
function getEnvVar(key: string): string {
  if (typeof process !== "undefined" && process.env && process.env[key]) {
    return process.env[key]!;
  }
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match && match[1] === key) {
          let value = match[2] || "";
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          return value.trim();
        }
      }
    }
  } catch (e) {
    console.error("Failed to read env var from .env file:", e);
  }
  return "";
}

// ---------------------------------------------------------------------------
// Server-side Firebase init — uses getEnvVar to support all server runtimes
// ---------------------------------------------------------------------------
let _serverApp: FirebaseApp | null = null;
let _serverDb: Database | null = null;

function getServerDb(): Database {
  if (_serverDb) return _serverDb;
  if (!_serverApp) {
    const config = {
      apiKey: getEnvVar("VITE_FIREBASE_API_KEY"),
      authDomain: getEnvVar("VITE_FIREBASE_AUTH_DOMAIN"),
      databaseURL: getEnvVar("VITE_FIREBASE_DATABASE_URL"),
      projectId: getEnvVar("VITE_FIREBASE_PROJECT_ID"),
      storageBucket: getEnvVar("VITE_FIREBASE_STORAGE_BUCKET"),
      messagingSenderId: getEnvVar("VITE_FIREBASE_MESSAGING_SENDER_ID"),
      appId: getEnvVar("VITE_FIREBASE_APP_ID"),
    };
    if (!config.apiKey || !config.databaseURL) {
      throw new Error(
        `[rag.functions] Firebase env vars missing on server. ` +
        `VITE_FIREBASE_API_KEY=${config.apiKey ? "PRESENT" : "MISSING"} ` +
        `VITE_FIREBASE_DATABASE_URL=${config.databaseURL ? "PRESENT" : "MISSING"}`,
      );
    }
    // Reuse existing app if already initialised (hot-reload safety)
    _serverApp = getApps().find((a) => a.name === "rag-server") ?? initializeApp(config, "rag-server");
  }
  _serverDb = getDatabase(_serverApp);
  return _serverDb;
}

// ---------------------------------------------------------------------------
// NVIDIA API helper (OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";

async function callNvidiaApi(prompt: string, systemPrompt?: string): Promise<string> {
  const apiKey = getEnvVar("NVIDIA_API_KEY") || "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";
  const messages: { role: string; content: string }[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages,
      temperature: 0.7,
      top_p: 1,
      max_tokens: 4096,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`NVIDIA API error ${response.status}: ${errText.slice(0, 400)}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  const content = data.choices[0]?.message?.content ?? "";
  if (!content) throw new Error("NVIDIA API returned empty content");
  return content;
}


export const callNvidiaProxy = createServerFn({ method: "POST" })
  .validator(
    z.union([
      z.object({
        prompt: z.string(),
        systemPrompt: z.string().optional(),
      }),
      z.object({
        data: z.object({
          prompt: z.string(),
          systemPrompt: z.string().optional(),
        })
      })
    ])
  )
  .handler(async ({ data }) => {
    const payload = "data" in data ? (data.data as any) : data;
    return callNvidiaApi(payload.prompt, payload.systemPrompt);
  });

/** Strip markdown code fences the model sometimes wraps JSON in */
function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Parse PDF & Chunk
// The extractedText is stored in Firebase by the client BEFORE calling this.
// The server function reads it from Firebase to avoid large RPC payloads.
// ---------------------------------------------------------------------------
type ParseParams = {
  docId: string;
};

export const parsePdfAndChunk = createServerFn({ method: "POST" })
  .validator((d: ParseParams) => d)
  .handler(async ({ data }) => {
    const { docId } = data;
    const db = getServerDb();

    try {
      await update(ref(db, `documents/${docId}`), { status: "running" });

      // Read the extracted text that the client stored in Firebase
      const textSnap = await get(ref(db, `documents/${docId}/extractedText`));
      if (!textSnap.exists()) {
        throw new Error("Extracted text not found in Firebase. Please re-upload the PDF.");
      }
      const extractedText = textSnap.val() as string;

      const totalPagesSnap = await get(ref(db, `documents/${docId}/pages`));
      const totalPages = totalPagesSnap.exists() ? (totalPagesSnap.val() as number) : 0;

      // -----------------------------------------------------------------------
      // 1. Ask NVIDIA to organise the text into a structured syllabus tree
      // -----------------------------------------------------------------------
      const organisationPrompt = `You are an expert curriculum designer. Given the following raw PDF text, extract a structured syllabus with Units and Topics.

Return ONLY valid JSON — no markdown, no code fences, no explanation.

The JSON must match this exact shape:
{
  "nodes": {
    "node_1": { "title": "...", "kind": "unit", "parentId": null, "order": 1 },
    "node_2": { "title": "...", "kind": "topic", "parentId": "node_1", "order": 1, "chunkIds": ["chunk_1"] }
  },
  "chunks": {
    "chunk_1": { "text": "...", "page": 1, "nodeIds": ["node_2"] }
  }
}

Rules:
- Create 2-6 units and 3-15 topics depending on content richness.
- Each topic must have 1-3 related text chunks (200-400 words each) drawn from the PDF text.
- Use real content from the PDF text only. Do NOT invent content.
- chunk IDs must be referenced in the matching topic's chunkIds array.
- Keep node and chunk IDs sequential: node_1, node_2... chunk_1, chunk_2...

PDF TEXT:
${extractedText.slice(0, 6000)}`;

      const rawJson = await callNvidiaApi(
        organisationPrompt,
        "You are a structured-data extraction assistant. Output only valid JSON with no markdown.",
      );

      const cleaned = stripFences(rawJson);

      let parsed: {
        nodes: Record<
          string,
          {
            title: string;
            kind: "unit" | "topic";
            parentId: string | null;
            order: number;
            chunkIds?: string[];
          }
        >;
        chunks: Record<string, { text: string; page: number; nodeIds: string[] }>;
      };

      try {
        parsed = JSON.parse(cleaned) as typeof parsed;
      } catch {
        throw new Error(
          `NVIDIA returned invalid JSON. First 300 chars: ${cleaned.slice(0, 300)}`,
        );
      }

      // -----------------------------------------------------------------------
      // 2. Persist syllabus tree + chunks to Firebase
      // -----------------------------------------------------------------------
      await set(ref(db, `syllabusTrees/${docId}/nodes`), parsed.nodes);
      await set(ref(db, `docChunks/${docId}`), parsed.chunks);

      // Remove the raw extracted text from Firebase (no longer needed)
      await set(ref(db, `documents/${docId}/extractedText`), null);

      await update(ref(db, `documents/${docId}`), {
        status: "parsed",
        pages: totalPages,
      });

      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Parsing failed";
      console.error("[parsePdfAndChunk] error:", message);
      await update(ref(db, `documents/${docId}`), {
        status: "failed",
        lastError: message,
      });
      return { success: false, error: message };
    }
  });

// ---------------------------------------------------------------------------
// Generate AI Questions — uses NVIDIA API with real chunk content
// ---------------------------------------------------------------------------
type GenerateParams = {
  jobId: string;
};

type JobData = {
  docId: string;
  nodeIds: string[];
  counts: {
    mcq: number;
    multi: number;
    fill: number;
    tf: number;
    match: number;
    coding: number;
  };
  difficulty: "easy" | "medium" | "hard" | "mixed";
  createdBy: string;
};

export const generateAiQuestions = createServerFn({ method: "POST" })
  .validator((d: GenerateParams) => d)
  .handler(async ({ data }) => {
    const { jobId } = data;
    const db = getServerDb();

    try {
      await update(ref(db, `generationJobs/${jobId}`), { status: "running" });

      const jobSnap = await get(ref(db, `generationJobs/${jobId}`));
      if (!jobSnap.exists()) throw new Error("Job parameters not found");
      const job = jobSnap.val() as JobData;

      const catSnap = await get(ref(db, "categories"));
      let defaultCatId = "";
      if (catSnap.exists()) {
        defaultCatId = Object.keys(catSnap.val() as object)[0] || "";
      }

      const difficulty = job.difficulty === "mixed" ? "medium" : job.difficulty;

      // Gather chunk text for the selected nodes
      const chunksSnap = await get(ref(db, `docChunks/${job.docId}`));
      const allChunks = chunksSnap.exists()
        ? (chunksSnap.val() as Record<string, { text: string; page: number; nodeIds: string[] }>)
        : {};

      const nodesSnap = await get(ref(db, `syllabusTrees/${job.docId}/nodes`));
      const allNodes = nodesSnap.exists()
        ? (nodesSnap.val() as Record<string, { title: string; kind: string; chunkIds?: string[] }>)
        : {};

      const relevantChunkIds = new Set<string>();
      for (const nodeId of job.nodeIds) {
        const node = allNodes[nodeId];
        if (node?.chunkIds) node.chunkIds.forEach((cid) => relevantChunkIds.add(cid));
      }

      let contextText = "";
      for (const cid of relevantChunkIds) {
        const chunk = allChunks[cid];
        if (chunk) {
          contextText += `\n\n${chunk.text}`;
          if (contextText.length > 5000) break;
        }
      }
      if (!contextText.trim()) contextText = "General knowledge on the subject.";

      const buildPrompt = (type: string, count: number, schema: string) =>
        `Based on this content, generate exactly ${count} ${type} question(s).

CONTENT:
${contextText.slice(0, 4000)}

DIFFICULTY: ${difficulty}

Return ONLY a valid JSON array matching this schema:
${schema}

No markdown, no code fences, no explanation.`;

      let producedCount = 0;

      // Helper: call NVIDIA, parse JSON array safely
      async function generateAndSave<T>(
        prompt: string,
        count: number,
        saveFn: (item: T) => Promise<void>,
      ) {
        if (count <= 0) return;
        try {
          const raw = await callNvidiaApi(prompt);
          const items = JSON.parse(stripFences(raw)) as T[];
          for (const item of items.slice(0, count)) {
            await saveFn(item);
            producedCount++;
          }
        } catch (e) {
          console.error(`[generateAiQuestions] failed for batch:`, e);
        }
      }

      // MCQ
      await generateAndSave<{
        text: string;
        options: { id: string; text: string; correct: boolean }[];
        answer: string;
        explanation: string;
      }>(
        buildPrompt(
          "MCQ",
          job.counts.mcq || 0,
          `[{"text":"?","options":[{"id":"a","text":"...","correct":true},{"id":"b","text":"...","correct":false},{"id":"c","text":"...","correct":false},{"id":"d","text":"...","correct":false}],"answer":"a","explanation":"..."}]`,
        ),
        job.counts.mcq || 0,
        async (item) => {
          const qRef = push(ref(db, "questionBank"));
          await set(qRef, {
            type: "mcq",
            text: item.text,
            options: item.options,
            answer: item.answer,
            explanation: item.explanation,
            categoryId: defaultCatId,
            subcategoryId: "",
            difficulty,
            marks: 1,
            negativeMarks: 0.25,
            source: "ai",
            status: "draft",
            createdBy: "ai-generator",
            createdAt: serverTimestamp(),
          });
        },
      );

      // Multi-Select
      await generateAndSave<{
        text: string;
        options: { id: string; text: string; correct: boolean }[];
        answer: string[];
        explanation: string;
      }>(
        buildPrompt(
          "multi-select (multiple correct answers)",
          job.counts.multi || 0,
          `[{"text":"?","options":[{"id":"a","text":"...","correct":true},{"id":"b","text":"...","correct":true},{"id":"c","text":"...","correct":false},{"id":"d","text":"...","correct":false}],"answer":["a","b"],"explanation":"..."}]`,
        ),
        job.counts.multi || 0,
        async (item) => {
          const qRef = push(ref(db, "questionBank"));
          await set(qRef, {
            type: "multi",
            text: item.text,
            options: item.options,
            answer: item.answer,
            explanation: item.explanation,
            categoryId: defaultCatId,
            subcategoryId: "",
            difficulty,
            marks: 2,
            negativeMarks: 0,
            source: "ai",
            status: "draft",
            createdBy: "ai-generator",
            createdAt: serverTimestamp(),
          });
        },
      );

      // Fill in the Blank
      await generateAndSave<{ text: string; answer: string; explanation: string }>(
        buildPrompt(
          "fill-in-the-blank",
          job.counts.fill || 0,
          `[{"text":"The ___ is ...","answer":"word","explanation":"..."}]`,
        ),
        job.counts.fill || 0,
        async (item) => {
          const qRef = push(ref(db, "questionBank"));
          await set(qRef, {
            type: "fill",
            text: item.text,
            answer: item.answer,
            explanation: item.explanation,
            categoryId: defaultCatId,
            subcategoryId: "",
            difficulty,
            marks: 1,
            negativeMarks: 0,
            source: "ai",
            status: "draft",
            createdBy: "ai-generator",
            createdAt: serverTimestamp(),
          });
        },
      );

      // True / False
      await generateAndSave<{ text: string; answer: "true" | "false"; explanation: string }>(
        buildPrompt(
          "true/false",
          job.counts.tf || 0,
          `[{"text":"Statement.","answer":"true","explanation":"..."}]`,
        ),
        job.counts.tf || 0,
        async (item) => {
          const qRef = push(ref(db, "questionBank"));
          await set(qRef, {
            type: "tf",
            text: item.text,
            answer: item.answer,
            explanation: item.explanation,
            categoryId: defaultCatId,
            subcategoryId: "",
            difficulty,
            marks: 1,
            negativeMarks: 0.5,
            source: "ai",
            status: "draft",
            createdBy: "ai-generator",
            createdAt: serverTimestamp(),
          });
        },
      );

      // Match the Following
      await generateAndSave<{
        text: string;
        matchLeft: { id: string; text: string }[];
        matchRight: { id: string; text: string }[];
        answer: Record<string, string>;
        explanation: string;
      }>(
        buildPrompt(
          "match-the-following",
          job.counts.match || 0,
          `[{"text":"Match:","matchLeft":[{"id":"1","text":"A"}],"matchRight":[{"id":"a","text":"X"}],"answer":{"1":"a"},"explanation":"..."}]`,
        ),
        job.counts.match || 0,
        async (item) => {
          const qRef = push(ref(db, "questionBank"));
          await set(qRef, {
            type: "match",
            text: item.text,
            matchLeft: item.matchLeft,
            matchRight: item.matchRight,
            answer: item.answer,
            explanation: item.explanation,
            categoryId: defaultCatId,
            subcategoryId: "",
            difficulty,
            marks: 2,
            negativeMarks: 0,
            source: "ai",
            status: "draft",
            createdBy: "ai-generator",
            createdAt: serverTimestamp(),
          });
        },
      );

      // Coding
      await generateAndSave<{
        text: string;
        codingLanguage: string;
        codingTemplate: string;
        codingTests: string;
        explanation: string;
      }>(
        buildPrompt(
          "coding",
          job.counts.coding || 0,
          `[{"text":"Write a function...","codingLanguage":"javascript","codingTemplate":"function solve(n) {\\n  // code here\\n}","codingTests":"assert(solve(1)===1);","explanation":"..."}]`,
        ),
        job.counts.coding || 0,
        async (item) => {
          const qRef = push(ref(db, "questionBank"));
          await set(qRef, {
            type: "coding",
            text: item.text,
            codingLanguage: item.codingLanguage ?? "javascript",
            codingTemplate: item.codingTemplate,
            codingTests: item.codingTests,
            answer: "template",
            explanation: item.explanation,
            categoryId: defaultCatId,
            subcategoryId: "",
            difficulty,
            marks: 5,
            negativeMarks: 0,
            source: "ai",
            status: "draft",
            createdBy: "ai-generator",
            createdAt: serverTimestamp(),
          });
        },
      );

      await update(ref(db, `generationJobs/${jobId}`), {
        status: "done",
        producedCount,
      });

      return { success: true, count: producedCount };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "AI Generation failed";
      console.error("[generateAiQuestions] error:", message);
      await update(ref(db, `generationJobs/${jobId}`), {
        status: "failed",
        error: message,
      });
      return { success: false, error: message };
    }
  });
