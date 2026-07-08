import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, push, set, remove, update } from "firebase/database";
import { toast } from "sonner";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { uploadPdfToSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Trash2, BookOpen, Clock, FileUp, RefreshCw, Copy, Check } from "lucide-react";
import { extractTextFromPdf } from "@/lib/pdf-extractor";
import { organisePdfWithNvidia, type SyllabusNode, type SyllabusChunk } from "@/lib/nvidia";
import { cleanAndParseJson } from "@/lib/rag.functions";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  component: DocumentsAdmin,
});

type DocumentItem = {
  title: string;
  cloudinaryUrl?: string;
  supabaseStoragePath?: string;
  pages: number;
  status: "uploaded" | "parsing" | "parsed" | "failed" | "running";
  uploadedBy: string;
  createdAt: number;
  categoryId?: string;
  subcategoryId?: string;
  extractedText?: string; // temp field stored before server fn processes it
  lastError?: string;     // set by server fn on failure for debugging
};


function DocumentsAdmin() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Record<string, DocumentItem>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Ingest mode and manual copy/paste states
  const [extractedData, setExtractedData] = useState<{
    fullText: string;
    totalPages: number;
    pages: { page: number; text: string }[];
  } | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [pastedJson, setPastedJson] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");

  // Categories & Subcategories state
  const [categories, setCategories] = useState<Record<string, { name: string }>>({});
  const [subcategories, setSubcategories] = useState<Record<string, { categoryId: string; name: string }>>({});
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");

  useEffect(() => {
    const db = getFirebaseDb();
    const unsubDocs = onValue(ref(db, "documents"), (snap) => {
      setDocuments((snap.val() as Record<string, DocumentItem>) ?? {});
    });
    const unsubCats = onValue(ref(db, "categories"), (snap) => {
      setCategories((snap.val() as any) ?? {});
    });
    const unsubSubs = onValue(ref(db, "subcategories"), (snap) => {
      setSubcategories((snap.val() as any) ?? {});
    });

    return () => {
      unsubDocs();
      unsubCats();
      unsubSubs();
    };
  }, []);


  const handleUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF document.");
      return;
    }
    if (!selectedCategoryId || !selectedSubcategoryId) {
      toast.error("Please select a Category and Subcategory first!");
      return;
    }
    setIsUploading(true);
    try {
      toast.info("Reading PDF text...");
      const extracted = await extractTextFromPdf(file);
      setExtractedData(extracted);
      setSelectedFileName(file.name);
      toast.success("PDF text extracted! Copy the prompt and paste the generated JSON below.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to extract PDF text.");
    } finally {
      setIsUploading(false);
    }
  };

  const manualPromptString = `You are an expert curriculum designer. Given the following subject details, extract a structured syllabus with Units and Topics.

Subject Category: ${categories[selectedCategoryId]?.name ?? "General"}
Subject Subcategory: ${subcategories[selectedSubcategoryId]?.name ?? "General"}

Return ONLY valid JSON — no markdown, no code fences, no explanation.

The JSON must match this exact shape:
{
  "nodes": {
    "node_1": { "title": "Unit 1: ...", "kind": "unit", "parentId": null, "order": 1 },
    "node_2": { "title": "Topic 1.1: ...", "kind": "topic", "parentId": "node_1", "order": 1, "pages": [1] }
  }
}

Rules:
- Extract all key units and topics mentioned.
- Group closely related subtopics together into broader topic nodes so that the total number of nodes does not exceed 30.
- For each topic node, specify the 1-indexed page numbers in the "pages" array (e.g. [1] or [1, 2]) where the topic is detailed.
- Do NOT generate any chunk text. Keep the output structure minimal for speed.
- Keep node IDs sequential: node_1, node_2...

${
  extractedData
    ? `PDF TEXT TO GROUND TOPICS IN (Exhaustively extract topics from this text, specifying 1-indexed page numbers in the "pages" array):
${extractedData.fullText.slice(0, 30000)}`
    : "Design a comprehensive syllabus outline based on general knowledge for this subject."
}`;

  const handleManualImport = async () => {
    if (!selectedCategoryId || !selectedSubcategoryId) {
      toast.error("Please select a Category and Subcategory first!");
      return;
    }
    if (!pastedJson.trim()) {
      toast.error("Please paste the JSON generated by your AI tool!");
      return;
    }

    setIsUploading(true);
    try {
      // Clean and parse JSON
      const parsedResult = cleanAndParseJson<{
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
      }>(pastedJson);

      if (!parsedResult.nodes) {
        throw new Error("Pasted JSON is missing the 'nodes' object.");
      }

      const fileName = selectedFileName || `${subcategories[selectedSubcategoryId]?.name || "Manual"}_Syllabus.pdf`;
      let cloudinaryUrl = `https://mock-supabase.example.com/${fileName}`;
      let supabaseUrl = `https://mock-supabase.example.com/${fileName}`;

      // Create document record in Firebase
      const db = getFirebaseDb();
      const newDocRef = push(ref(db, "documents"));
      const docId = newDocRef.key;
      if (!docId) throw new Error("Failed to create document key.");

      await set(newDocRef, {
        title: fileName,
        cloudinaryUrl,
        supabaseStoragePath: supabaseUrl,
        pages: extractedData ? extractedData.totalPages : 1,
        status: "running",
        uploadedBy: user?.uid ?? "unknown",
        createdAt: Date.now(),
        categoryId: selectedCategoryId,
        subcategoryId: selectedSubcategoryId,
      });

      // Programmatically build chunks page-by-page
      const chunks: Record<string, SyllabusChunk> = {};
      if (extractedData) {
        extractedData.pages.forEach((p) => {
          const chunkId = `chunk_${p.page}`;
          chunks[chunkId] = {
            text: p.text || "No text content on this page.",
            page: p.page,
            nodeIds: [],
          };
        });
      } else {
        chunks["chunk_1"] = {
          text: `General curriculum syllabus for Category: ${categories[selectedCategoryId]?.name}, Subcategory: ${subcategories[selectedSubcategoryId]?.name}`,
          page: 1,
          nodeIds: [],
        };
      }

      // Link nodes and chunks programmatically
      const nodes: Record<string, SyllabusNode> = {};
      Object.entries(parsedResult.nodes).forEach(([nodeId, node]: [string, any]) => {
        const chunkIds: string[] = [];
        const pagesArray = node.pages && Array.isArray(node.pages) ? node.pages : [1];
        pagesArray.forEach((pageNumber: number) => {
          const chunkId = `chunk_${pageNumber}`;
          if (chunks[chunkId]) {
            chunkIds.push(chunkId);
            chunks[chunkId].nodeIds.push(nodeId);
          }
        });
        nodes[nodeId] = {
          title: node.title,
          kind: node.kind,
          parentId: node.parentId,
          order: node.order,
          chunkIds,
        };
      });

      // Save to Firebase
      await set(ref(db, `syllabusTrees/${docId}/nodes`), nodes);
      await set(ref(db, `docChunks/${docId}`), chunks);
      await update(ref(db, `documents/${docId}`), { status: "parsed" });

      toast.success("Syllabus imported successfully!");
      // Reset manual states
      setExtractedData(null);
      setPastedJson("");
      setSelectedFileName("");
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleUpload(e.target.files[0]);
    }
  };

  const handleDelete = async (docId: string, title: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the document: "${title}"? This will clear its syllabus trees and chunk database records.`,
      )
    )
      return;
    try {
      const db = getFirebaseDb();
      // Remove document record, chunks, and syllabus trees
      await remove(ref(db, `documents/${docId}`));
      await remove(ref(db, `docChunks/${docId}`));
      await remove(ref(db, `syllabusTrees/${docId}`));
      toast.success("Document deleted.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deletion failed.");
    }
  };

  const handleRetryParse = async (docId: string) => {
    toast.info(
      "To retry, please re-upload the PDF file. The extracted text is needed for AI organisation.",
    );
    // Retry requires re-uploading because extracted text lives only in memory.
    // Reset to uploaded status so the UI clears the failed badge.
    try {
      await set(ref(getFirebaseDb(), `documents/${docId}/status`), "uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Retry failed.");
    }
  };

  const docList = Object.entries(documents).sort((a, b) => b[1].createdAt - a[1].createdAt);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Syllabus Documents</h1>
        <p className="text-sm text-muted-foreground">
          Upload PDF curriculum sheets, run AI text extraction, and edit extracted syllabus trees.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Upload Block */}
        <Card className="md:col-span-1 border-primary/20 shadow-sm self-start">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Upload Document</CardTitle>
            <CardDescription>Select category, then upload a PDF file to begin ingestion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Category Selector */}
            <div className="space-y-1.5">
              <Label htmlFor="cat-selector">Syllabus Category</Label>
              <Select
                value={selectedCategoryId}
                onValueChange={(val) => {
                  setSelectedCategoryId(val);
                  setSelectedSubcategoryId("");
                }}
              >
                <SelectTrigger id="cat-selector">
                  <SelectValue placeholder="Choose Category..." />
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

            {/* Subcategory Selector */}
            <div className="space-y-1.5 pb-2">
              <Label htmlFor="subcat-selector">Syllabus Subcategory</Label>
              <Select
                value={selectedSubcategoryId}
                onValueChange={setSelectedSubcategoryId}
                disabled={!selectedCategoryId}
              >
                <SelectTrigger id="subcat-selector">
                  <SelectValue placeholder="Choose Subcategory..." />
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

            <div className="space-y-4 pt-2">
              {/* Optional PDF Grounder */}
              <div className="space-y-1.5 border rounded-lg p-2.5 bg-muted/20">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  PDF Context (Optional)
                </span>
                {extractedData ? (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-[11px] font-medium text-emerald-900 truncate">
                        {selectedFileName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExtractedData(null);
                        setSelectedFileName("");
                      }}
                      className="text-[10px] text-destructive hover:underline font-medium cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="pt-0.5">
                    <label
                      htmlFor="manual-pdf-uploader"
                      className={`text-[11px] text-primary hover:underline font-medium cursor-pointer flex items-center gap-1.5 ${
                        !selectedSubcategoryId ? "pointer-events-none opacity-40" : ""
                      }`}
                    >
                      <FileUp className="h-3.5 w-3.5" />
                      Upload PDF to ground prompt in text
                    </label>
                    <input
                      id="manual-pdf-uploader"
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={isUploading || !selectedSubcategoryId}
                    />
                  </div>
                )}
              </div>

              {/* Prompt Copier */}
              <div className="space-y-1.5">
                <Label>Step 1: Copy AI Prompt</Label>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  This prompt contains instructions and formatting rules for your external AI tools (Claude, ChatGPT, Gemini, etc.).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full text-xs font-semibold flex items-center justify-center gap-1.5 py-1.5 h-auto cursor-pointer"
                  disabled={!selectedSubcategoryId}
                  onClick={() => {
                    navigator.clipboard.writeText(manualPromptString);
                    setCopiedPrompt(true);
                    toast.success("AI Prompt copied to clipboard!");
                    setTimeout(() => setCopiedPrompt(false), 2000);
                  }}
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      Prompt Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      Copy AI Prompt
                    </>
                  )}
                </Button>
              </div>

              {/* JSON Paste Area */}
              <div className="space-y-1.5">
                <Label htmlFor="json-paste-area">Step 2: Paste Generated JSON</Label>
                <Textarea
                  id="json-paste-area"
                  placeholder='{"nodes": {"node_1": {"title": "Unit 1...", "kind": "unit", ...}}}'
                  rows={6}
                  value={pastedJson}
                  onChange={(e) => setPastedJson(e.target.value)}
                  className="font-mono text-[10px] p-2 leading-relaxed resize-y"
                  disabled={!selectedSubcategoryId}
                />
              </div>

              {/* Import Buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleManualImport}
                  className="flex-1 text-xs cursor-pointer"
                  disabled={isUploading || !pastedJson.trim() || !selectedSubcategoryId}
                >
                  {isUploading ? "Importing..." : "Import Syllabus"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setExtractedData(null);
                    setPastedJson("");
                    setSelectedFileName("");
                  }}
                  className="text-xs cursor-pointer"
                  disabled={!selectedSubcategoryId}
                >
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* List Block */}
        <Card className="md:col-span-2 shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-semibold">Ingested Documents</CardTitle>
            <CardDescription>Tracks parsing progress and syllabus trees.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {docList.map(([id, doc]) => (
                <div
                  key={id}
                  className="flex items-start justify-between border rounded-xl p-4 bg-card shadow-xs gap-4"
                >
                  <div className="flex gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted/60 border flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                        {doc.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                        <span>·</span>
                        <span>{doc.pages ? `${doc.pages} Pages` : "Parsing pages..."}</span>

                        {doc.categoryId && categories[doc.categoryId] && (
                          <>
                            <span>·</span>
                            <Badge variant="outline" className="bg-accent/40 text-accent-foreground border-accent/25 text-[10px] py-0 px-1.5 font-normal">
                              {categories[doc.categoryId].name}
                            </Badge>
                          </>
                        )}
                        {doc.subcategoryId && subcategories[doc.subcategoryId] && (
                          <>
                            <span>·</span>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] py-0 px-1.5 font-normal">
                              {subcategories[doc.subcategoryId].name}
                            </Badge>
                          </>
                        )}

                        <span>·</span>
                        {doc.status === "uploaded" && (
                          <Badge
                            variant="outline"
                            className="bg-muted text-muted-foreground text-[10px] uppercase font-bold"
                          >
                            Uploaded
                          </Badge>
                        )}
                        {(doc.status === "parsing" || doc.status === "running") && (
                          <Badge
                            variant="outline"
                            className="bg-sky-50 text-sky-600 border-sky-200 text-[10px] uppercase font-bold flex items-center gap-1"
                          >
                            <RefreshCw className="h-2.5 w-2.5 animate-spin" /> AI Processing
                          </Badge>
                        )}
                        {doc.status === "parsed" && (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-600 border-emerald-200 text-[10px] uppercase font-bold"
                          >
                            Ready
                          </Badge>
                        )}
                        {doc.status === "failed" && (
                          <Badge
                            variant="outline"
                            className="bg-red-50 text-red-500 border-red-200 text-[10px] uppercase font-bold"
                            title={doc.lastError ?? "Unknown error"}
                          >
                            Failed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0">
                    {doc.status === "parsed" && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/syllabus/$docId" params={{ docId: id }}>
                          <BookOpen className="mr-1 h-4 w-4" /> Syllabus Tree
                        </Link>
                      </Button>
                    )}
                    {doc.status === "failed" && (
                      <Button size="sm" variant="ghost" onClick={() => handleRetryParse(id)}>
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(id, doc.title)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}

              {docList.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground border border-dashed rounded-lg">
                  No syllabus documents uploaded yet. Upload a PDF above to get started.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
