import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, push, set, remove } from "firebase/database";
import { toast } from "sonner";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { uploadPdfToSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { uploadToCloudinary } from "@/lib/cloudinary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { FileText, Trash2, BookOpen, Clock, FileUp, RefreshCw } from "lucide-react";
import { parsePdfAndChunk } from "@/lib/rag.functions";
import { extractTextFromPdf } from "@/lib/pdf-extractor";

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
  extractedText?: string; // temp field stored before server fn processes it
  lastError?: string;     // set by server fn on failure for debugging
};


function DocumentsAdmin() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Record<string, DocumentItem>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, "documents"), (snap) => {
      setDocuments((snap.val() as Record<string, DocumentItem>) ?? {});
    });
    return () => unsub();
  }, []);

  const handleUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF document.");
      return;
    }
    setIsUploading(true);
    try {
      // 1. Extract text from the PDF in the browser using PDF.js
      toast.info("Reading PDF text with PDF.js...");
      const extracted = await extractTextFromPdf(file);

      if (!extracted.fullText.trim()) {
        toast.warning(
          "No text found in this PDF. It may be a scanned image — extraction may be limited.",
        );
      }

      let cloudinaryUrl = "";
      let supabaseUrl = "";

      // 2. Upload to Supabase Storage (for archiving)
      if (isSupabaseConfigured) {
        toast.info("Uploading PDF to Supabase Storage...");
        supabaseUrl = await uploadPdfToSupabase(file);
      } else {
        supabaseUrl = `https://mock-supabase.example.com/${file.name}`;
      }

      // 3. Upload to Cloudinary (for viewing/delivery)
      try {
        toast.info("Uploading PDF to Cloudinary...");
        cloudinaryUrl = await uploadToCloudinary(file);
      } catch (err) {
        console.warn("Cloudinary upload failed/skipped", err);
        cloudinaryUrl = supabaseUrl;
      }

      // 4. Save Document metadata + extracted text in Firebase.
      //    We store extractedText in Firebase so the server function
      //    can read it without a huge RPC payload crossing the boundary.
      const db = getFirebaseDb();
      const newDocRef = push(ref(db, "documents"));
      const docId = newDocRef.key;

      if (!docId) throw new Error("Failed to create document record key.");

      await set(newDocRef, {
        title: file.name,
        cloudinaryUrl,
        supabaseStoragePath: supabaseUrl,
        pages: extracted.totalPages,
        status: "uploaded",
        uploadedBy: user?.uid ?? "unknown",
        createdAt: Date.now(),
        extractedText: extracted.fullText, // temp field — removed by server after parsing
      });

      toast.success("Document saved! Sending to NVIDIA AI for organisation...");

      // 5. Call server function with just the docId — it reads the text from Firebase
      parsePdfAndChunk({ docId }).catch((err) => {
        console.error("PDF Parsing failed", err);
        toast.error("AI organisation failed. Check the document list for details.");
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document.");
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
            <CardDescription>Drag and drop a PDF file to begin ingestion.</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center transition cursor-pointer ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/20 hover:bg-muted/30"
              } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
            >
              <FileUp className="h-10 w-10 text-muted-foreground mb-3 stroke-1.5" />
              <p className="text-xs font-semibold text-foreground mb-1">
                {isUploading ? "Uploading file..." : "Drag & Drop PDF Here"}
              </p>
              <p className="text-[10px] text-muted-foreground mb-4">
                Supported format: PDF up to 50 pages
              </p>

              <Label
                htmlFor="pdf-file-uploader"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition cursor-pointer"
              >
                Choose File
              </Label>
              <input
                id="pdf-file-uploader"
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
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
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm text-foreground line-clamp-1">
                        {doc.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </span>
                        <span>·</span>
                        <span>{doc.pages ? `${doc.pages} Pages` : "Parsing pages..."}</span>
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
