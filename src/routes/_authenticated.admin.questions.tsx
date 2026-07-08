import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, push, set, remove, update, serverTimestamp } from "firebase/database";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Search,
  Filter,
  BookOpen,
  Check,
  X,
  Eye,
  HelpCircle,
  Image,
  Upload,
  Code,
  CheckSquare,
  Sparkles,
  Pencil,
} from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { uploadToCloudinary } from "@/lib/cloudinary";

export const Route = createFileRoute("/_authenticated/admin/questions")({
  component: QuestionsAdmin,
});

type QuestionOption = { id: string; text: string; correct: boolean };

type MatchPair = {
  leftText: string;
  rightText: string;
};

type Question = {
  type: "mcq" | "multi" | "fill" | "match" | "tf" | "coding";
  text: string;
  imageUrl?: string;
  options?: QuestionOption[];
  answer: unknown;
  explanation: string;
  categoryId: string;
  subcategoryId: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  negativeMarks: number;
  source: "manual" | "ai";
  status: "draft" | "approved" | "rejected" | "published";
  matchLeft?: { id: string; text: string }[];
  matchRight?: { id: string; text: string }[];
  codingLanguage?: string;
  codingTemplate?: string;
  codingTests?: string;
  createdBy: string;
  createdAt: number | object;
};

function QuestionsAdmin() {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [categories, setCategories] = useState<Record<string, { name: string; slug: string }>>({});
  const [subcategories, setSubcategories] = useState<
    Record<string, { categoryId: string; name: string; slug: string }>
  >({});

  // Form State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingQid, setEditingQid] = useState<string | null>(null);
  const [qType, setQType] = useState<Question["type"]>("mcq");
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [catId, setCatId] = useState("");
  const [subCatId, setSubCatId] = useState("");
  const [marks, setMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0);
  const [explanation, setExplanation] = useState("");

  // MCQ & Multi Options
  const [options, setOptions] = useState<QuestionOption[]>([
    { id: "a", text: "", correct: true },
    { id: "b", text: "", correct: false },
    { id: "c", text: "", correct: false },
    { id: "d", text: "", correct: false },
  ]);

  // Fill in the Blank Answer
  const [fillAnswer, setFillAnswer] = useState("");

  // True / False Answer
  const [tfAnswer, setTfAnswer] = useState<"true" | "false">("true");

  // Matching Pairs
  const [matchPairs, setMatchPairs] = useState<MatchPair[]>([
    { leftText: "", rightText: "" },
    { leftText: "", rightText: "" },
  ]);

  // Coding Stub
  const [codingLanguage, setCodingLanguage] = useState("javascript");
  const [codingTemplate, setCodingTemplate] = useState("");
  const [codingTests, setCodingTests] = useState("// Define test cases");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterSub, setFilterSub] = useState("all");
  const [filterDiff, setFilterDiff] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Bulk Actions
  const [bulkSelectedIds, setBulkSelectedIds] = useState<string[]>([]);

  // Preview Dialog State
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);

  useEffect(() => {
    const db = getFirebaseDb();
    const qUnsub = onValue(ref(db, "questionBank"), (s) => setQuestions(s.val() ?? {}));
    const cUnsub = onValue(ref(db, "categories"), (s) => setCategories(s.val() ?? {}));
    const sUnsub = onValue(ref(db, "subcategories"), (s) => setSubcategories(s.val() ?? {}));
    return () => {
      qUnsub();
      cUnsub();
      sUnsub();
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      setImageUrl(url);
      toast.success("Image uploaded successfully");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Upload failed. You can paste a URL manually.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...options];
    updated[idx].text = val;
    setOptions(updated);
  };

  const handleCorrectRadioChange = (id: string) => {
    setOptions(options.map((opt) => ({ ...opt, correct: opt.id === id })));
  };

  const handleCorrectCheckboxChange = (id: string, checked: boolean) => {
    setOptions(options.map((opt) => (opt.id === id ? { ...opt, correct: checked } : opt)));
  };

  const handleAddOption = () => {
    const nextId = String.fromCharCode(97 + options.length);
    setOptions([...options, { id: nextId, text: "", correct: false }]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 2) return;
    const updated = options
      .filter((_, i) => i !== idx)
      .map((opt, i) => ({
        ...opt,
        id: String.fromCharCode(97 + i),
      }));
    if (!updated.some((opt) => opt.correct)) {
      updated[0].correct = true;
    }
    setOptions(updated);
  };

  // Match Pair Handlers
  const handleMatchChange = (idx: number, field: keyof MatchPair, val: string) => {
    const updated = [...matchPairs];
    updated[idx][field] = val;
    setMatchPairs(updated);
  };

  const handleAddMatchPair = () => {
    setMatchPairs([...matchPairs, { leftText: "", rightText: "" }]);
  };

  const handleRemoveMatchPair = (idx: number) => {
    if (matchPairs.length <= 2) return;
    setMatchPairs(matchPairs.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Please enter the question text.");
      return;
    }
    if (!catId) {
      toast.error("Please select a category.");
      return;
    }

    let finalAnswer: unknown = null;
    let matchLeft: { id: string; text: string }[] | undefined = undefined;
    let matchRight: { id: string; text: string }[] | undefined = undefined;

    if (qType === "mcq") {
      if (options.some((o) => !o.text.trim())) {
        toast.error("Please fill in all options.");
        return;
      }
      const correct = options.find((o) => o.correct);
      if (!correct) {
        toast.error("Please select a correct answer.");
        return;
      }
      finalAnswer = correct.id;
    } else if (qType === "multi") {
      if (options.some((o) => !o.text.trim())) {
        toast.error("Please fill in all options.");
        return;
      }
      const correctIds = options.filter((o) => o.correct).map((o) => o.id);
      if (correctIds.length === 0) {
        toast.error("Please select at least one correct answer.");
        return;
      }
      finalAnswer = correctIds;
    } else if (qType === "fill") {
      if (!fillAnswer.trim()) {
        toast.error("Please enter the correct answer.");
        return;
      }
      finalAnswer = fillAnswer.trim();
    } else if (qType === "tf") {
      finalAnswer = tfAnswer;
    } else if (qType === "match") {
      if (matchPairs.some((p) => !p.leftText.trim() || !p.rightText.trim())) {
        toast.error("Please fill in all matching fields.");
        return;
      }
      matchLeft = matchPairs.map((p, i) => ({ id: String(i + 1), text: p.leftText.trim() }));
      matchRight = matchPairs.map((p, i) => ({
        id: String.fromCharCode(97 + i),
        text: p.rightText.trim(),
      }));
      const mapping: Record<string, string> = {};
      matchPairs.forEach((_, i) => {
        mapping[String(i + 1)] = String.fromCharCode(97 + i);
      });
      finalAnswer = mapping;
    } else if (qType === "coding") {
      if (!codingTemplate.trim()) {
        toast.error("Please provide starter template code.");
        return;
      }
      finalAnswer = {
        language: codingLanguage,
        template: codingTemplate,
      };
    }

    try {
      const db = getFirebaseDb();
      const questionData = {
        type: qType,
        text: text.trim(),
        imageUrl: imageUrl.trim() || null,
        explanation: explanation.trim(),
        categoryId: catId,
        subcategoryId: subCatId,
        difficulty,
        marks: Number(marks),
        negativeMarks: Number(negativeMarks),
        source: editingQid ? (questions[editingQid]?.source ?? "manual") : "manual",
        status: editingQid ? (questions[editingQid]?.status ?? "published") : "published",
        ...(qType === "mcq" || qType === "multi"
          ? { options: options.map((o) => ({ id: o.id, text: o.text.trim(), correct: o.correct })) }
          : {}),
        ...(qType === "match" ? { matchLeft, matchRight } : {}),
        ...(qType === "coding"
          ? {
              codingLanguage,
              codingTemplate: codingTemplate.trim(),
              codingTests: codingTests.trim(),
            }
          : {}),
        answer: finalAnswer,
        createdBy: editingQid
          ? (questions[editingQid]?.createdBy ?? "unknown")
          : (user?.uid ?? "unknown"),
        createdAt: editingQid
          ? (questions[editingQid]?.createdAt ?? Date.now())
          : serverTimestamp(),
      };

      if (editingQid) {
        await set(ref(db, `questionBank/${editingQid}`), questionData);
        toast.success("Question updated successfully!");
        setEditingQid(null);
      } else {
        const newRef = push(ref(db, "questionBank"));
        await set(newRef, questionData);
        toast.success("Question saved successfully!");
      }

      // Reset
      setText("");
      setImageUrl("");
      setExplanation("");
      setCatId("");
      setSubCatId("");
      setDifficulty("medium");
      setMarks(1);
      setNegativeMarks(0);
      setFillAnswer("");
      setTfAnswer("true");
      setMatchPairs([
        { leftText: "", rightText: "" },
        { leftText: "", rightText: "" },
      ]);
      setOptions([
        { id: "a", text: "", correct: true },
        { id: "b", text: "", correct: false },
        { id: "c", text: "", correct: false },
        { id: "d", text: "", correct: false },
      ]);
      setCodingTemplate("");
      setCodingTests("// Define test cases");
      setShowCreateForm(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save question.");
    }
  };

  const handleEditNode = (qid: string, q: Question) => {
    setEditingQid(qid);
    setQType(q.type);
    setText(q.text);
    setImageUrl(q.imageUrl ?? "");
    setExplanation(q.explanation);
    setCatId(q.categoryId);
    setSubCatId(q.subcategoryId);
    setDifficulty(q.difficulty);
    setMarks(q.marks);
    setNegativeMarks(q.negativeMarks);

    if (q.type === "mcq" || q.type === "multi") {
      setOptions(q.options ?? []);
    } else if (q.type === "fill") {
      setFillAnswer((q.answer as string) ?? "");
    } else if (q.type === "tf") {
      setTfAnswer((q.answer as "true" | "false") ?? "true");
    } else if (q.type === "match") {
      const pairs: MatchPair[] = [];
      q.matchLeft?.forEach((left, i) => {
        const rightId = (q.answer as Record<string, string>)?.[left.id];
        const right = q.matchRight?.find((r) => r.id === rightId);
        pairs.push({ leftText: left.text, rightText: right?.text ?? "" });
      });
      setMatchPairs(pairs);
    } else if (q.type === "coding") {
      setCodingLanguage(q.codingLanguage ?? "javascript");
      setCodingTemplate(q.codingTemplate ?? "");
      setCodingTests(q.codingTests ?? "");
    }

    setShowCreateForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (qid: string, questionText: string) => {
    if (!confirm(`Delete question: "${questionText.substring(0, 40)}..."?`)) return;
    try {
      await remove(ref(getFirebaseDb(), `questionBank/${qid}`));
      toast.success("Question deleted");
      setBulkSelectedIds(bulkSelectedIds.filter((id) => id !== qid));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete question.");
    }
  };

  // Review Queue actions
  const handleApprove = async (qid: string) => {
    try {
      await update(ref(getFirebaseDb(), `questionBank/${qid}`), {
        status: "published",
      });
      toast.success("Question approved");
      setBulkSelectedIds(bulkSelectedIds.filter((id) => id !== qid));
    } catch (e) {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (qid: string) => {
    try {
      await update(ref(getFirebaseDb(), `questionBank/${qid}`), {
        status: "rejected",
      });
      toast.success("Question rejected");
      setBulkSelectedIds(bulkSelectedIds.filter((id) => id !== qid));
    } catch (e) {
      toast.error("Failed to reject");
    }
  };

  // Bulk Actions
  const handleBulkApprove = async () => {
    if (bulkSelectedIds.length === 0) return;
    try {
      const db = getFirebaseDb();
      for (const qid of bulkSelectedIds) {
        await update(ref(db, `questionBank/${qid}`), { status: "published" });
      }
      toast.success(`Successfully approved ${bulkSelectedIds.length} questions`);
      setBulkSelectedIds([]);
    } catch (e) {
      toast.error("Bulk approve failed");
    }
  };

  const handleBulkReject = async () => {
    if (bulkSelectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to reject ${bulkSelectedIds.length} selected questions?`))
      return;
    try {
      const db = getFirebaseDb();
      for (const qid of bulkSelectedIds) {
        await update(ref(db, `questionBank/${qid}`), { status: "rejected" });
      }
      toast.success(`Successfully rejected ${bulkSelectedIds.length} questions`);
      setBulkSelectedIds([]);
    } catch (e) {
      toast.error("Bulk reject failed");
    }
  };

  const handleSelectAll = (checked: boolean, targetQuestions: [string, Question][]) => {
    if (checked) {
      setBulkSelectedIds(targetQuestions.map(([id]) => id));
    } else {
      setBulkSelectedIds([]);
    }
  };

  const toggleBulkSelect = (id: string, checked: boolean) => {
    if (checked) {
      setBulkSelectedIds([...bulkSelectedIds, id]);
    } else {
      setBulkSelectedIds(bulkSelectedIds.filter((x) => x !== id));
    }
  };

  const applyFilters = (rawQuestions: [string, Question][]) => {
    return rawQuestions.filter(([_, q]) => {
      if (!q) return false;
      const matchesSearch =
        q.text && typeof q.text === "string"
          ? q.text.toLowerCase().includes(searchQuery.toLowerCase())
          : false;
      const matchesCat = filterCat === "all" || q.categoryId === filterCat;
      const matchesSub = filterSub === "all" || q.subcategoryId === filterSub;
      const matchesDiff = filterDiff === "all" || q.difficulty === filterDiff;
      const matchesType = filterType === "all" || q.type === filterType;
      return matchesSearch && matchesCat && matchesSub && matchesDiff && matchesType;
    });
  };

  const allQuestionsArray = Object.entries(questions);

  // Split Active Bank questions vs AI Draft Review Queue questions
  const activeQuestions = applyFilters(
    allQuestionsArray.filter(
      ([_, q]) => q && (q.status === "published" || q.status === "approved"),
    ),
  );

  const draftQuestions = applyFilters(
    allQuestionsArray.filter(([_, q]) => q && q.source === "ai" && q.status === "draft"),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Question Bank</h1>
          <p className="text-sm text-muted-foreground">
            Manage your objective questions and author manual MCQs.
          </p>
        </div>
        <Button
          onClick={() => {
            if (editingQid) {
              setEditingQid(null);
              setText("");
              setImageUrl("");
              setShowCreateForm(false);
            } else {
              setShowCreateForm(!showCreateForm);
            }
          }}
          variant={showCreateForm ? "outline" : "default"}
        >
          {showCreateForm ? (
            <>
              <X className="mr-2 h-4 w-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" /> New Question
            </>
          )}
        </Button>
      </div>

      {showCreateForm && (
        <Card className="border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader>
            <CardTitle>{editingQid ? "Modify Question" : "Create Objective Question"}</CardTitle>
            <CardDescription>Select the question type and set the solution key.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              {/* Type Select */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Question Type</Label>
                  <Select
                    value={qType}
                    onValueChange={(val: Question["type"]) => setQType(val)}
                    disabled={!!editingQid}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">Multiple Choice (MCQ)</SelectItem>
                      <SelectItem value="multi">Multi-Select (Multiple Answers)</SelectItem>
                      <SelectItem value="fill">Fill in the Blank</SelectItem>
                      <SelectItem value="match">Match the Following</SelectItem>
                      <SelectItem value="tf">True / False</SelectItem>
                      <SelectItem value="coding">Coding Stub</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    value={catId}
                    onValueChange={(val) => {
                      setCatId(val);
                      setSubCatId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categories)
                        .filter(([_, c]) => !!c)
                        .map(([id, c]) => (
                          <SelectItem key={id} value={id}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Subcategory</Label>
                  <Select value={subCatId} onValueChange={setSubCatId} disabled={!catId}>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={catId ? "Select Subcategory" : "Select category first"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(subcategories)
                        .filter(([_, s]) => s && s.categoryId === catId)
                        .map(([id, s]) => (
                          <SelectItem key={id} value={id}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Text, Image Uploads */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="qtext">Question Text</Label>
                  <Textarea
                    id="qtext"
                    placeholder="Enter the question text..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-20"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 items-end">
                  <div className="space-y-1.5">
                    <Label htmlFor="image-url">Image URL (Optional)</Label>
                    <Input
                      id="image-url"
                      placeholder="Paste image url..."
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Label
                      htmlFor="image-file"
                      className="flex-1 flex items-center justify-center gap-1.5 h-10 border border-dashed rounded-md bg-muted/40 cursor-pointer text-xs hover:bg-muted/80 transition"
                    >
                      <Upload className="h-4 w-4" /> {isUploading ? "Uploading..." : "Upload Image"}
                      <input
                        id="image-file"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={isUploading}
                      />
                    </Label>
                  </div>
                </div>
                {imageUrl && (
                  <div className="relative h-28 w-28 border rounded-md overflow-hidden bg-muted">
                    <img src={imageUrl} alt="Uploaded" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Dynamic Subforms based on Type */}
              <div className="border-y py-4">
                {qType === "mcq" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">
                        Options (Select one correct answer)
                      </Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddOption}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Option
                      </Button>
                    </div>
                    <RadioGroup
                      value={options.find((o) => o.correct)?.id}
                      onValueChange={handleCorrectRadioChange}
                      className="space-y-2.5"
                    >
                      {options.map((opt, idx) => (
                        <div key={opt.id} className="flex items-center gap-3">
                          <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} />
                          <span className="w-5 text-center font-bold text-muted-foreground uppercase text-xs">
                            {opt.id}.
                          </span>
                          <Input
                            value={opt.text}
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            placeholder={`Option ${opt.id.toUpperCase()}`}
                            className="flex-1"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(idx)}
                            disabled={options.length <= 2}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {qType === "multi" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">
                        Options (Select all correct answers)
                      </Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddOption}>
                        <Plus className="mr-1 h-3.5 w-3.5" /> Option
                      </Button>
                    </div>
                    <div className="space-y-2.5">
                      {options.map((opt, idx) => (
                        <div key={opt.id} className="flex items-center gap-3">
                          <Checkbox
                            checked={opt.correct}
                            onCheckedChange={(val) => handleCorrectCheckboxChange(opt.id, !!val)}
                            id={`opt-${opt.id}`}
                          />
                          <span className="w-5 text-center font-bold text-muted-foreground uppercase text-xs">
                            {opt.id}.
                          </span>
                          <Input
                            value={opt.text}
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            placeholder={`Option ${opt.id.toUpperCase()}`}
                            className="flex-1"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(idx)}
                            disabled={options.length <= 2}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {qType === "fill" && (
                  <div className="space-y-2">
                    <Label htmlFor="blank-ans">Correct Blank Answer</Label>
                    <Input
                      id="blank-ans"
                      placeholder="e.g. Tokyo"
                      value={fillAnswer}
                      onChange={(e) => setFillAnswer(e.target.value)}
                      required
                    />
                  </div>
                )}

                {qType === "tf" && (
                  <div className="space-y-2">
                    <Label>Correct Statement Key</Label>
                    <RadioGroup
                      value={tfAnswer}
                      onValueChange={(val: "true" | "false") => setTfAnswer(val)}
                      className="flex gap-6 mt-1"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="true" id="tf-t" />
                        <Label htmlFor="tf-t">True</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="false" id="tf-f" />
                        <Label htmlFor="tf-f">False</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {qType === "match" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Matching Pairs</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddMatchPair}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add Pair
                      </Button>
                    </div>
                    <div className="space-y-2.5">
                      {matchPairs.map((pair, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-muted-foreground">
                            {idx + 1}.
                          </span>
                          <Input
                            value={pair.leftText}
                            onChange={(e) => handleMatchChange(idx, "leftText", e.target.value)}
                            placeholder="Left Column"
                            className="flex-1"
                            required
                          />
                          <span className="text-muted-foreground font-bold">⇌</span>
                          <Input
                            value={pair.rightText}
                            onChange={(e) => handleMatchChange(idx, "rightText", e.target.value)}
                            placeholder="Right Match"
                            className="flex-1"
                            required
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMatchPair(idx)}
                            disabled={matchPairs.length <= 2}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {qType === "coding" && (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Programming Language</Label>
                        <Select value={codingLanguage} onValueChange={setCodingLanguage}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="javascript">JavaScript</SelectItem>
                            <SelectItem value="python">Python</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="code-temp">Starter Code Template</Label>
                      <Textarea
                        id="code-temp"
                        value={codingTemplate}
                        onChange={(e) => setCodingTemplate(e.target.value)}
                        className="font-mono min-h-24 text-xs"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="code-tests">Test Cases</Label>
                      <Textarea
                        id="code-tests"
                        value={codingTests}
                        onChange={(e) => setCodingTests(e.target.value)}
                        className="font-mono min-h-20 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Difficulty & Marks */}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select
                    value={difficulty}
                    onValueChange={(val: "easy" | "medium" | "hard") => setDifficulty(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="marks">Marks</Label>
                  <Input
                    id="marks"
                    type="number"
                    min={1}
                    value={marks}
                    onChange={(e) => setMarks(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="neg-marks">Negative Marks</Label>
                  <Input
                    id="neg-marks"
                    type="number"
                    min={0}
                    step={0.25}
                    value={negativeMarks}
                    onChange={(e) => setNegativeMarks(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exp">Explanation (Optional)</Label>
                <Textarea
                  id="exp"
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  className="min-h-16"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingQid ? "Update Question" : "Save Question"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tabs list: Bank vs AI Queue */}
      <Tabs defaultValue="active" onValueChange={() => setBulkSelectedIds([])}>
        <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/30 p-2.5 rounded-lg border mb-4">
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-1.5 font-semibold text-xs">
              <BookOpen className="h-3.5 w-3.5" /> Active Question Bank ({activeQuestions.length})
            </TabsTrigger>
            <TabsTrigger
              value="review"
              className="flex items-center gap-1.5 font-semibold text-xs relative"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-current" /> AI Review Queue (
              {draftQuestions.length})
              {draftQuestions.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-amber-500 text-white rounded-full flex items-center justify-center text-[9px] font-bold">
                  {draftQuestions.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Filters summary */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Type: All</SelectItem>
                <SelectItem value="mcq">MCQ</SelectItem>
                <SelectItem value="multi">Multi-Select</SelectItem>
                <SelectItem value="fill">Fill Blank</SelectItem>
                <SelectItem value="match">Matching</SelectItem>
                <SelectItem value="tf">True/False</SelectItem>
                <SelectItem value="coding">Coding</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterDiff} onValueChange={setFilterDiff}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Diff: All</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Search text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-44 text-xs bg-background"
            />
          </div>
        </div>

        {/* Tab 1: Active bank list */}
        <TabsContent value="active">
          <Card>
            <CardContent className="pt-4 px-0 pb-0">
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Question</th>
                      <th className="px-4 py-3">Details</th>
                      <th className="px-4 py-3">Marks</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeQuestions.map(([qid, q]) => (
                      <tr key={qid} className="hover:bg-muted/10 transition">
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className="text-[9px] uppercase font-bold tracking-wider"
                          >
                            {q.type}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 max-w-sm">
                          <div className="font-medium line-clamp-2">{q.text}</div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-semibold">
                            {categories[q.categoryId]?.name || "General"}
                          </div>
                          <div className="text-[10px] text-muted-foreground capitalize">
                            {q.difficulty}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-emerald-600">+{q.marks}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditNode(qid, q)}
                            >
                              <CheckSquare className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDelete(qid, q.text)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {activeQuestions.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground text-xs"
                        >
                          No active questions found matching search criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Review Queue */}
        <TabsContent value="review">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b bg-muted/5 gap-4">
              <div className="space-y-0.5">
                <CardTitle className="text-sm font-bold">Pending AI Draft Questions</CardTitle>
                <CardDescription className="text-xs">
                  Select questions to batch-approve into the bank.
                </CardDescription>
              </div>

              {bulkSelectedIds.length > 0 && (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={handleBulkApprove}
                    className="bg-emerald-600 hover:bg-emerald-600/90 text-white border-transparent"
                  >
                    Approve Selected ({bulkSelectedIds.length})
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleBulkReject}>
                    Reject Selected ({bulkSelectedIds.length})
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50 text-xs font-semibold uppercase text-muted-foreground border-b">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <Checkbox
                          checked={
                            draftQuestions.length > 0 &&
                            bulkSelectedIds.length === draftQuestions.length
                          }
                          onCheckedChange={(val) => handleSelectAll(!!val, draftQuestions)}
                        />
                      </th>
                      <th className="px-4 py-3 w-20">Type</th>
                      <th className="px-4 py-3">Generated Question</th>
                      <th className="px-4 py-3">Difficulty</th>
                      <th className="px-4 py-3 text-right">Review Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {draftQuestions.map(([qid, q]) => {
                      const checked = bulkSelectedIds.includes(qid);
                      return (
                        <tr
                          key={qid}
                          className={`hover:bg-muted/10 transition ${checked ? "bg-primary/5" : ""}`}
                        >
                          <td className="px-4 py-3">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(val) => toggleBulkSelect(qid, !!val)}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className="text-[9px] uppercase font-bold tracking-wider"
                            >
                              {q.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 max-w-sm">
                            <div className="font-medium line-clamp-2">{q.text}</div>
                            <div className="text-[10px] text-amber-600 mt-1 font-medium">
                              Source: AI RAG Generator
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs capitalize font-medium">
                            {q.difficulty}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-emerald-600"
                                onClick={() => handleApprove(qid)}
                              >
                                <Check className="h-4.5 w-4.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEditNode(qid, q)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleReject(qid)}
                              >
                                <X className="h-4.5 w-4.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {draftQuestions.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground text-xs"
                        >
                          AI Review queue is currently empty. Generate questions from syllabus tree
                          first.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
