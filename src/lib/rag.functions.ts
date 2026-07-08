import { createServerFn } from "@tanstack/react-start";
import { getFirebaseDb } from "@/lib/firebase";
import { ref, update, set, get, push, serverTimestamp } from "firebase/database";

// ---------------------------------------------------------------------------
// NVIDIA API helper (OpenAI-compatible endpoint)
// ---------------------------------------------------------------------------
const NVIDIA_API_KEY =
  "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";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const NVIDIA_MODEL = "openai/gpt-oss-120b";

async function callNvidiaApi(prompt: string, systemPrompt?: string): Promise<string> {
  const messages: { role: string; content: string }[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
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
    throw new Error(`NVIDIA API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as {
    choices: { message: { content: string } }[];
  };

  return data.choices[0]?.message?.content ?? "";
}

// ---------------------------------------------------------------------------
// Parse PDF & Chunk  — now accepts extractedText from browser PDF.js
// ---------------------------------------------------------------------------
type ParseParams = {
  docId: string;
  extractedText: string; // full text from browser-side PDF.js extraction
  totalPages: number;
};

export const parsePdfAndChunk = createServerFn({ method: "POST" })
  .validator((d: ParseParams) => d)
  .handler(async ({ data }) => {
    const { docId, extractedText, totalPages } = data;
    const db = getFirebaseDb();

    try {
      await update(ref(db, `documents/${docId}`), { status: "running" });

      // -----------------------------------------------------------------------
      // 1. Ask NVIDIA to organise the text into a structured syllabus tree
      // -----------------------------------------------------------------------
      const organisationPrompt = `
You are an expert curriculum designer. Given the following raw PDF text, extract a structured syllabus with Units and Topics.

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
- Create 2–6 units and 3–15 topics depending on the content richness.
- Each topic must have 1–3 related text chunks (200–400 words each) drawn from the PDF text.
- Use real content from the PDF — do NOT make up content.
- chunk IDs must be referenced in the matching topic's chunkIds array.
- Keep node and chunk IDs sequential (node_1, node_2 … and chunk_1, chunk_2 …).

PDF TEXT (first 8000 chars):
${extractedText.slice(0, 8000)}
`;

      const rawJson = await callNvidiaApi(organisationPrompt, "You are a structured-data extraction assistant. Output only valid JSON.");

      // Parse the JSON — strip any stray markdown fences if the model adds them
      const cleaned = rawJson
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

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
        throw new Error(`NVIDIA returned invalid JSON. Raw: ${cleaned.slice(0, 300)}`);
      }

      // -----------------------------------------------------------------------
      // 2. Persist syllabus tree + chunks to Firebase
      // -----------------------------------------------------------------------
      await set(ref(db, `syllabusTrees/${docId}/nodes`), parsed.nodes);
      await set(ref(db, `docChunks/${docId}`), parsed.chunks);

      await update(ref(db, `documents/${docId}`), {
        status: "parsed",
        pages: totalPages,
      });

      return { success: true };
    } catch (err: unknown) {
      console.error("parsePdfAndChunk error:", err);
      await update(ref(db, `documents/${docId}`), { status: "failed" });
      return {
        success: false,
        error: err instanceof Error ? err.message : "Parsing failed",
      };
    }
  });

// ---------------------------------------------------------------------------
// Generate AI Questions  — uses NVIDIA API with real chunk content
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
    const db = getFirebaseDb();

    try {
      await update(ref(db, `generationJobs/${jobId}`), { status: "running" });

      // Fetch job parameters
      const jobSnap = await get(ref(db, `generationJobs/${jobId}`));
      if (!jobSnap.exists()) throw new Error("Job parameters not found");
      const job = jobSnap.val() as JobData;

      // Fetch categories for tagging
      const catSnap = await get(ref(db, "categories"));
      let defaultCatId = "";
      if (catSnap.exists()) {
        defaultCatId = Object.keys(catSnap.val() as object)[0] || "";
      }

      const difficulty = job.difficulty === "mixed" ? "medium" : job.difficulty;

      // ------------------------------------------------------------------
      // Gather chunk text for the selected nodes
      // ------------------------------------------------------------------
      const chunksSnap = await get(ref(db, `docChunks/${job.docId}`));
      const allChunks = chunksSnap.exists()
        ? (chunksSnap.val() as Record<string, { text: string; page: number; nodeIds: string[] }>)
        : {};

      const nodesSnap = await get(ref(db, `syllabusTrees/${job.docId}/nodes`));
      const allNodes = nodesSnap.exists()
        ? (nodesSnap.val() as Record<
            string,
            { title: string; kind: string; chunkIds?: string[] }
          >)
        : {};

      // Collect all chunkIds belonging to the selected nodeIds
      const relevantChunkIds = new Set<string>();
      for (const nodeId of job.nodeIds) {
        const node = allNodes[nodeId];
        if (node?.chunkIds) {
          node.chunkIds.forEach((cid) => relevantChunkIds.add(cid));
        }
      }

      // Assemble context text from those chunks (cap at ~6000 chars)
      let contextText = "";
      for (const cid of relevantChunkIds) {
        const chunk = allChunks[cid];
        if (chunk) {
          contextText += `\n\n${chunk.text}`;
          if (contextText.length > 6000) break;
        }
      }

      if (!contextText.trim()) {
        contextText = "General knowledge on the subject.";
      }

      // ------------------------------------------------------------------
      // Build the question-generation prompt
      // ------------------------------------------------------------------
      const buildPrompt = (
        type: string,
        count: number,
        extraInstructions: string,
      ) => `
You are an expert exam question setter. Based on the following content, generate exactly ${count} ${type} question(s).

CONTENT:
${contextText.slice(0, 4000)}

DIFFICULTY: ${difficulty}

${extraInstructions}

Return ONLY a valid JSON array — no markdown, no code fences. Each item must follow the schema for "${type}".
`;

      let producedCount = 0;

      // ------------------------------------------------------------------
      // MCQ
      // ------------------------------------------------------------------
      if ((job.counts.mcq || 0) > 0) {
        const prompt = buildPrompt(
          "MCQ",
          job.counts.mcq,
          `Each MCQ item must be:
{
  "text": "Question text here?",
  "options": [
    {"id":"a","text":"Option A","correct":true},
    {"id":"b","text":"Option B","correct":false},
    {"id":"c","text":"Option C","correct":false},
    {"id":"d","text":"Option D","correct":false}
  ],
  "answer": "a",
  "explanation": "Why A is correct."
}`,
        );

        const raw = await callNvidiaApi(prompt);
        const items = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
          text: string;
          options: { id: string; text: string; correct: boolean }[];
          answer: string;
          explanation: string;
        }[];

        for (const item of items.slice(0, job.counts.mcq)) {
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
          producedCount++;
        }
      }

      // ------------------------------------------------------------------
      // Multi-Select
      // ------------------------------------------------------------------
      if ((job.counts.multi || 0) > 0) {
        const prompt = buildPrompt(
          "multi-select",
          job.counts.multi,
          `Each item must be:
{
  "text": "Question with multiple correct answers?",
  "options": [
    {"id":"a","text":"...","correct":true},
    {"id":"b","text":"...","correct":true},
    {"id":"c","text":"...","correct":false},
    {"id":"d","text":"...","correct":false}
  ],
  "answer": ["a","b"],
  "explanation": "Why a and b are correct."
}`,
        );

        const raw = await callNvidiaApi(prompt);
        const items = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
          text: string;
          options: { id: string; text: string; correct: boolean }[];
          answer: string[];
          explanation: string;
        }[];

        for (const item of items.slice(0, job.counts.multi)) {
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
          producedCount++;
        }
      }

      // ------------------------------------------------------------------
      // Fill in the Blank
      // ------------------------------------------------------------------
      if ((job.counts.fill || 0) > 0) {
        const prompt = buildPrompt(
          "fill-in-the-blank",
          job.counts.fill,
          `Each item must be:
{
  "text": "The ___ is responsible for ...",
  "answer": "single word or phrase",
  "explanation": "Why this answer."
}`,
        );

        const raw = await callNvidiaApi(prompt);
        const items = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
          text: string;
          answer: string;
          explanation: string;
        }[];

        for (const item of items.slice(0, job.counts.fill)) {
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
          producedCount++;
        }
      }

      // ------------------------------------------------------------------
      // True / False
      // ------------------------------------------------------------------
      if ((job.counts.tf || 0) > 0) {
        const prompt = buildPrompt(
          "true/false",
          job.counts.tf,
          `Each item must be:
{
  "text": "Statement to evaluate.",
  "answer": "true" or "false",
  "explanation": "Why true or false."
}`,
        );

        const raw = await callNvidiaApi(prompt);
        const items = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
          text: string;
          answer: "true" | "false";
          explanation: string;
        }[];

        for (const item of items.slice(0, job.counts.tf)) {
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
          producedCount++;
        }
      }

      // ------------------------------------------------------------------
      // Match the Following
      // ------------------------------------------------------------------
      if ((job.counts.match || 0) > 0) {
        const prompt = buildPrompt(
          "match-the-following",
          job.counts.match,
          `Each item must be:
{
  "text": "Match the following:",
  "matchLeft": [{"id":"1","text":"Left A"},{"id":"2","text":"Left B"}],
  "matchRight": [{"id":"a","text":"Right X"},{"id":"b","text":"Right Y"}],
  "answer": {"1":"a","2":"b"},
  "explanation": "1 matches a because..."
}`,
        );

        const raw = await callNvidiaApi(prompt);
        const items = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
          text: string;
          matchLeft: { id: string; text: string }[];
          matchRight: { id: string; text: string }[];
          answer: Record<string, string>;
          explanation: string;
        }[];

        for (const item of items.slice(0, job.counts.match)) {
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
          producedCount++;
        }
      }

      // ------------------------------------------------------------------
      // Coding Stubs
      // ------------------------------------------------------------------
      if ((job.counts.coding || 0) > 0) {
        const prompt = buildPrompt(
          "coding",
          job.counts.coding,
          `Each item must be:
{
  "text": "Write a function that ...",
  "codingLanguage": "javascript",
  "codingTemplate": "function solve(input) {\\n  // your code here\\n}",
  "codingTests": "assert(solve(...) === ...);",
  "explanation": "Explain the approach."
}`,
        );

        const raw = await callNvidiaApi(prompt);
        const items = JSON.parse(raw.replace(/```json|```/g, "").trim()) as {
          text: string;
          codingLanguage: string;
          codingTemplate: string;
          codingTests: string;
          explanation: string;
        }[];

        for (const item of items.slice(0, job.counts.coding)) {
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
          producedCount++;
        }
      }

      // Mark job complete
      await update(ref(db, `generationJobs/${jobId}`), {
        status: "done",
        producedCount,
      });

      return { success: true, count: producedCount };
    } catch (err: unknown) {
      console.error("generateAiQuestions error:", err);
      await update(ref(db, `generationJobs/${jobId}`), {
        status: "failed",
        error: err instanceof Error ? err.message : "AI Generation failed",
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : "AI Generation failed",
      };
    }
  });
