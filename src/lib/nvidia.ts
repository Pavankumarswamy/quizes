import { callNvidiaProxy } from "./rag.functions";

export async function callNvidiaApi(prompt: string, systemPrompt?: string): Promise<string> {
  // Call the server function directly. TanStack Start compiles this into a secure same-origin RPC call.
  return callNvidiaProxy({ prompt, systemPrompt });
}

/** Strip markdown code fences the model sometimes adds around JSON */
export function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export interface SyllabusNode {
  title: string;
  kind: "unit" | "topic";
  parentId: string | null;
  order: number;
  chunkIds?: string[];
}

export interface SyllabusChunk {
  text: string;
  page: number;
  nodeIds: string[];
}

export interface ParsedSyllabus {
  nodes: Record<string, SyllabusNode>;
  chunks: Record<string, SyllabusChunk>;
}

/**
 * Sends extracted PDF text to NVIDIA (via our proxy) and returns
 * a structured syllabus tree + text chunks.
 */
export async function organisePdfWithNvidia(extractedText: string): Promise<ParsedSyllabus> {
  const prompt = `You are an expert curriculum designer. Given the following raw PDF text, extract a structured syllabus with Units and Topics.

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
- Use ONLY real content from the PDF. Do NOT invent content.
- chunk IDs must be referenced in the matching topic's chunkIds array.
- Keep node and chunk IDs sequential: node_1, node_2... chunk_1, chunk_2...

PDF TEXT:
${extractedText.slice(0, 7000)}`;

  const raw = await callNvidiaApi(
    prompt,
    "You are a structured-data extraction assistant. Output only valid JSON with no markdown.",
  );

  const cleaned = stripFences(raw);

  let parsed: ParsedSyllabus;
  try {
    parsed = JSON.parse(cleaned) as ParsedSyllabus;
  } catch {
    throw new Error(`NVIDIA returned invalid JSON. Preview: ${cleaned.slice(0, 300)}`);
  }

  if (!parsed.nodes || !parsed.chunks) {
    throw new Error("NVIDIA response missing nodes or chunks fields.");
  }

  return parsed;
}
