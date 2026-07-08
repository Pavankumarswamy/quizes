import { callNvidiaProxy } from "./rag.functions";
import { ExtractedPdf } from "./pdf-extractor";

export async function callNvidiaApi(prompt: string, systemPrompt?: string): Promise<string> {
  // Pass wrapped in { data } to ensure compatibility with standard TanStack server function signatures
  return callNvidiaProxy({ data: { prompt, systemPrompt } });
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
 * Sends extracted PDF text metadata to NVIDIA (via our proxy) to generate
 * the syllabus structure (Units & Topics), then programmatically builds the RAG chunks page-by-page.
 * This is extremely fast (under 2 seconds) and avoids large text copy latency.
 */
export async function organisePdfWithNvidia(extracted: ExtractedPdf): Promise<ParsedSyllabus> {
  const prompt = `You are an expert curriculum designer. Given the following raw PDF text, extract a highly detailed and complete structured syllabus with all Units, Modules, and Topics.

Return ONLY valid JSON — no markdown, no code fences, no explanation.

The JSON must match this exact shape:
{
  "nodes": {
    "node_1": { "title": "Unit 1: ...", "kind": "unit", "parentId": null, "order": 1 },
    "node_2": { "title": "Topic 1.1: ...", "kind": "topic", "parentId": "node_1", "order": 1, "pages": [1] }
  }
}

Rules:
- Exhaustively extract ALL units, chapters, modules, and topics mentioned in the text. Do NOT summarize or omit anything.
- For each topic node, specify the 1-indexed page numbers in the "pages" array (e.g. [1] or [1, 2]) where the topic is detailed in the PDF.
- Do NOT generate any chunk text. Keep the output structure minimal for speed.
- Keep node IDs sequential: node_1, node_2...

PDF TEXT (FULL):
${extracted.fullText.slice(0, 20000)}`;

  const raw = await callNvidiaApi(
    prompt,
    "You are a structured-data extraction assistant. Output only valid JSON with no markdown.",
  );

  const cleaned = stripFences(raw);

  let parsedResult: {
    nodes: Record<
      string,
      {
        title: string;
        kind: "unit" | "topic";
        parentId: string | null;
        order: number;
        pages?: number[];
      }
    >;
  };

  try {
    parsedResult = JSON.parse(cleaned) as typeof parsedResult;
  } catch {
    throw new Error(`NVIDIA returned invalid JSON. Preview: ${cleaned.slice(0, 300)}`);
  }

  if (!parsedResult.nodes) {
    throw new Error("NVIDIA response missing 'nodes' object.");
  }

  const chunks: Record<string, SyllabusChunk> = {};

  // 1. Create chunks page-by-page programmatically using the original text
  extracted.pages.forEach((p) => {
    const chunkId = `chunk_${p.page}`;
    chunks[chunkId] = {
      text: p.text || "No text content on this page.",
      page: p.page,
      nodeIds: [],
    };
  });

  // 2. Link nodes and chunks programmatically
  const nodes: Record<string, SyllabusNode> = {};

  Object.entries(parsedResult.nodes).forEach(([nodeId, node]) => {
    const chunkIds: string[] = [];

    if (node.kind === "topic" && Array.isArray(node.pages)) {
      node.pages.forEach((pageNum) => {
        const chunkId = `chunk_${pageNum}`;
        if (chunks[chunkId]) {
          chunkIds.push(chunkId);
          if (!chunks[chunkId].nodeIds.includes(nodeId)) {
            chunks[chunkId].nodeIds.push(nodeId);
          }
        }
      });
    }

    nodes[nodeId] = {
      title: node.title,
      kind: node.kind,
      parentId: node.parentId,
      order: node.order,
      ...(node.kind === "topic" ? { chunkIds } : {}),
    };
  });

  // 3. Clean up any chunks that are not associated with any topic to save space
  Object.keys(chunks).forEach((chunkId) => {
    if (chunks[chunkId].nodeIds.length === 0) {
      delete chunks[chunkId];
    }
  });

  return {
    nodes,
    chunks,
  };
}
