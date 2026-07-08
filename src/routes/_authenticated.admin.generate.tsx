import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, push, set, serverTimestamp } from "firebase/database";
import { toast } from "sonner";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ChevronLeft,
  HelpCircle,
  FileQuestion,
  AlertCircle,
} from "lucide-react";
// We will modify rag.functions.ts to export generateAiQuestions server function
import { generateAiQuestions } from "@/lib/rag.functions";
import { z } from "zod";

const searchSchema = z.object({
  docId: z.string().optional(),
  nodeIds: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/generate")({
  validateSearch: searchSchema,
  component: AIQuizGenerator,
});

type DocumentItem = { title: string };
type SyllabusNode = { title: string };

type JobItem = {
  status: "queued" | "running" | "done" | "failed";
  producedCount?: number;
  error?: string;
};

function AIQuizGenerator() {
  const search = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<Record<string, DocumentItem>>({});
  const [nodes, setNodes] = useState<Record<string, SyllabusNode>>({});

  // Form State
  const [docId, setDocId] = useState(search.docId ?? "");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(
    search.nodeIds ? search.nodeIds.split(",") : [],
  );
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "mixed">("mixed");

  // Question Type Counts
  const [mcqCount, setMcqCount] = useState(3);
  const [multiCount, setMultiCount] = useState(0);
  const [fillCount, setFillCount] = useState(0);
  const [tfCount, setTfCount] = useState(1);
  const [matchCount, setMatchCount] = useState(0);
  const [codingCount, setCodingCount] = useState(0);

  // Job status
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<JobItem | null>(null);

  useEffect(() => {
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, "documents"), (snap) => {
      setDocuments((snap.val() as Record<string, DocumentItem>) ?? {});
    });
    return () => unsub();
  }, []);

  // Fetch nodes when docId changes
  useEffect(() => {
    if (!docId) {
      setNodes({});
      return;
    }
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, `syllabusTrees/${docId}/nodes`), (snap) => {
      setNodes((snap.val() as Record<string, SyllabusNode>) ?? {});
    });
    return () => unsub();
  }, [docId]);

  // Listen to active job
  useEffect(() => {
    if (!activeJobId) return;
    const db = getFirebaseDb();
    const unsub = onValue(ref(db, `generationJobs/${activeJobId}`), (snap) => {
      setJobState(snap.val() as JobItem | null);
    });
    return () => unsub();
  }, [activeJobId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docId) {
      toast.error("Please select a document.");
      return;
    }
    if (selectedNodeIds.length === 0) {
      toast.error("Please select at least one syllabus topic node.");
      return;
    }

    const totalToGenerate = mcqCount + multiCount + fillCount + tfCount + matchCount + codingCount;
    if (totalToGenerate === 0) {
      toast.error("Please set a count > 0 for at least one question type.");
      return;
    }

    try {
      const db = getFirebaseDb();
      const newJobRef = push(ref(db, "generationJobs"));
      const jobId = newJobRef.key;

      if (!jobId) throw new Error("Failed to create generation job");

      const jobData = {
        docId,
        nodeIds: selectedNodeIds,
        counts: {
          mcq: mcqCount,
          multi: multiCount,
          fill: fillCount,
          tf: tfCount,
          match: matchCount,
          coding: codingCount,
        },
        difficulty,
        status: "queued",
        createdBy: user?.uid ?? "unknown",
        createdAt: serverTimestamp(),
      };

      await set(newJobRef, jobData);
      setActiveJobId(jobId);
      toast.success("AI Generation job queued successfully");

      // Trigger the server function in the background
      generateAiQuestions({ jobId }).catch((err) => {
        console.error("AI Generation failed", err);
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to queue job.");
    }
  };

  const handleSelectNode = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedNodeIds([...selectedNodeIds, id]);
    } else {
      setSelectedNodeIds(selectedNodeIds.filter((x) => x !== id));
    }
  };

  const handleCancelJob = () => {
    setActiveJobId(null);
    setJobState(null);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/admin/documents">
            <ChevronLeft className="mr-1 h-4 w-4" /> Documents
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Quiz Generator</h1>
        <p className="text-sm text-muted-foreground">
          Analyze document syllabus nodes and generate new objective questions grounded in RAG
          chunks.
        </p>
      </div>

      {activeJobId && jobState ? (
        <Card className="border-primary/25 shadow-md max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-amber-500 fill-current" /> Question Generation Job
            </CardTitle>
            <CardDescription>Listen to real-time status updates from Gemini API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="capitalize">{jobState.status}...</span>
                {jobState.status === "done" && (
                  <span className="text-emerald-600">
                    Generated {jobState.producedCount ?? 0} questions
                  </span>
                )}
              </div>
              <Progress
                value={
                  jobState.status === "queued"
                    ? 15
                    : jobState.status === "running"
                      ? 60
                      : jobState.status === "done"
                        ? 100
                        : 0
                }
                className={jobState.status === "failed" ? "bg-destructive/20" : ""}
              />
            </div>

            <div className="rounded-lg border p-4 bg-muted/20 text-sm space-y-3">
              {jobState.status === "queued" && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                  <span>Waiting in the generation queue. Preparing text chunks...</span>
                </div>
              )}
              {jobState.status === "running" && (
                <div className="flex items-center gap-2 text-primary">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Gemini is generating questions. Running cosine similarity checks...</span>
                </div>
              )}
              {jobState.status === "done" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 font-medium">
                    <CheckCircle2 className="h-5 w-5 fill-current text-emerald-600 text-white" />
                    <span>Generation complete! Questions added to Review Queue.</span>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/admin/questions">Open Review Queue</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelJob}>
                      Generate More
                    </Button>
                  </div>
                </div>
              )}
              {jobState.status === "failed" && (
                <div className="space-y-2 text-red-500">
                  <div className="flex items-center gap-2 font-medium">
                    <AlertCircle className="h-5 w-5" />
                    <span>Error generating questions.</span>
                  </div>
                  <p className="text-xs">
                    {jobState.error || "Unknown serverless execution timeout."}
                  </p>
                  <Button
                    size="sm"
                    onClick={handleCancelJob}
                    variant="outline"
                    className="text-foreground"
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleGenerate} className="grid gap-6 md:grid-cols-3">
          {/* Form Settings */}
          <Card className="md:col-span-2 shadow-sm border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle className="text-base">AI Counts Configuration</CardTitle>
              <CardDescription>
                Define how many questions of each format you want to request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Document Select */}
              <div className="space-y-1.5">
                <Label>Source Syllabus Document</Label>
                <Select
                  value={docId}
                  onValueChange={(val) => {
                    setDocId(val);
                    setSelectedNodeIds([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose processed PDF..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(documents).map(([id, doc]) => (
                      <SelectItem key={id} value={id}>
                        {doc.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Counters Mix */}
              <div className="grid gap-4 sm:grid-cols-3 border-t pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="c-mcq">MCQ Questions</Label>
                  <Input
                    id="c-mcq"
                    type="number"
                    min={0}
                    value={mcqCount}
                    onChange={(e) => setMcqCount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-multi">Multi-Select</Label>
                  <Input
                    id="c-multi"
                    type="number"
                    min={0}
                    value={multiCount}
                    onChange={(e) => setMultiCount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-fill">Fill Blank</Label>
                  <Input
                    id="c-fill"
                    type="number"
                    min={0}
                    value={fillCount}
                    onChange={(e) => setFillCount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-tf">True / False</Label>
                  <Input
                    id="c-tf"
                    type="number"
                    min={0}
                    value={tfCount}
                    onChange={(e) => setTfCount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-match">Matching Columns</Label>
                  <Input
                    id="c-match"
                    type="number"
                    min={0}
                    value={matchCount}
                    onChange={(e) => setMatchCount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-code">Coding Stubs</Label>
                  <Input
                    id="c-code"
                    type="number"
                    min={0}
                    value={codingCount}
                    onChange={(e) => setCodingCount(Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Settings */}
              <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
                <div className="space-y-1.5">
                  <Label>Overall Difficulty</Label>
                  <Select
                    value={difficulty}
                    onValueChange={(val: "easy" | "medium" | "hard" | "mixed") =>
                      setDifficulty(val)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                      <SelectItem value="mixed">Mixed/Balanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button type="submit" disabled={!docId || selectedNodeIds.length === 0}>
                  <Sparkles className="mr-2 h-4 w-4 animate-bounce" /> Generate Questions
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Topics selection checklist */}
          <Card className="md:col-span-1 shadow-sm h-[420px] flex flex-col">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold">
                Selected Topics ({selectedNodeIds.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Questions will be grounded in text chunks from these nodes.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pt-3">
              {!docId ? (
                <div className="flex flex-col items-center justify-center text-center p-6 text-muted-foreground h-full">
                  <FileQuestion className="h-8 w-8 mb-2 stroke-1" />
                  <p className="text-xs">Choose a source document to select topics.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(nodes).map(([id, node]) => {
                    const checked = selectedNodeIds.includes(id);
                    return (
                      <div key={id} className="flex items-start gap-2.5 text-xs text-foreground">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(val) => handleSelectNode(id, !!val)}
                          id={`node-chk-${id}`}
                          className="mt-0.5"
                        />
                        <Label
                          htmlFor={`node-chk-${id}`}
                          className="leading-tight cursor-pointer font-medium"
                        >
                          {node.title}
                        </Label>
                      </div>
                    );
                  })}
                  {Object.keys(nodes).length === 0 && (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      No nodes found. Go back to Syllabus Tree Editor.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
