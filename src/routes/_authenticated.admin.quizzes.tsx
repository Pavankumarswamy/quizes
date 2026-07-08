import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { onValue, ref, push, set, remove, serverTimestamp } from "firebase/database";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Search,
  BookOpen,
  Clock,
  Award,
  ShieldAlert,
  Settings,
  Eye,
  Check,
  X,
  FileQuestion,
} from "lucide-react";
import { getFirebaseDb } from "@/lib/firebase";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/admin/quizzes")({
  component: QuizzesAdmin,
});

type QuestionOption = { id: string; text: string; correct: boolean };
type Question = {
  type: "mcq";
  text: string;
  options: QuestionOption[];
  answer: string;
  categoryId: string;
  subcategoryId: string;
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  negativeMarks: number;
};

type Quiz = {
  title: string;
  description: string;
  coverUrl?: string;
  categoryId: string;
  subcategoryId: string;
  durationSec: number;
  totalMarks: number;
  passingMarks: number;
  negativeMarking: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  questionIds: string[];
  isFree: boolean;
  price: number;
  status: "draft" | "published" | "archived";
  createdBy: string;
  createdAt: number | object;
};

function QuizzesAdmin() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});
  const [questions, setQuestions] = useState<Record<string, Question>>({});
  const [categories, setCategories] = useState<Record<string, { name: string; slug: string }>>({});
  const [subcategories, setSubcategories] = useState<
    Record<string, { categoryId: string; name: string; slug: string }>
  >({});

  // Form State
  const [showBuilder, setShowBuilder] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [catId, setCatId] = useState("");
  const [subCatId, setSubCatId] = useState("");
  const [durationMin, setDurationMin] = useState(30);
  const [passingMarks, setPassingMarks] = useState(10);
  const [negativeMarking, setNegativeMarking] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [status, setStatus] = useState<"draft" | "published">("published");

  // Filters / Search
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const db = getFirebaseDb();
    const qzUnsub = onValue(ref(db, "quizzes"), (s) => setQuizzes(s.val() ?? {}));
    const qnUnsub = onValue(ref(db, "questionBank"), (s) => setQuestions(s.val() ?? {}));
    const cUnsub = onValue(ref(db, "categories"), (s) => setCategories(s.val() ?? {}));
    const sUnsub = onValue(ref(db, "subcategories"), (s) => setSubcategories(s.val() ?? {}));
    return () => {
      qzUnsub();
      qnUnsub();
      cUnsub();
      sUnsub();
    };
  }, []);

  // Filter questions by selected Category & Subcategory to help user select relevant ones
  const filteredQuestionsForBuilder = Object.entries(questions).filter(([_, q]) => {
    if (!catId) return false;
    const matchesCat = q.categoryId === catId;
    const matchesSub = !subCatId || q.subcategoryId === subCatId;
    return matchesCat && matchesSub;
  });

  // Calculate total marks based on selected questions
  const totalSelectedMarks = selectedQuestionIds.reduce((sum, qid) => {
    const q = questions[qid];
    return sum + (q?.marks ?? 0);
  }, 0);

  const toggleQuestionSelection = (qid: string) => {
    if (selectedQuestionIds.includes(qid)) {
      setSelectedQuestionIds(selectedQuestionIds.filter((id) => id !== qid));
    } else {
      setSelectedQuestionIds([...selectedQuestionIds, qid]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a quiz title.");
      return;
    }
    if (!catId) {
      toast.error("Please select a category.");
      return;
    }
    if (selectedQuestionIds.length === 0) {
      toast.error("Please select at least one question.");
      return;
    }
    if (passingMarks > totalSelectedMarks) {
      toast.error("Passing marks cannot exceed total marks.");
      return;
    }

    try {
      const db = getFirebaseDb();
      const quizData: Omit<Quiz, "id"> = {
        title: title.trim(),
        description: description.trim(),
        categoryId: catId,
        subcategoryId: subCatId,
        durationSec: durationMin * 60,
        totalMarks: totalSelectedMarks,
        passingMarks: Number(passingMarks),
        negativeMarking,
        shuffleQuestions,
        shuffleOptions,
        questionIds: selectedQuestionIds,
        isFree: true,
        price: 0,
        status,
        createdBy: user?.uid ?? "unknown",
        createdAt: serverTimestamp(),
      };

      const newRef = push(ref(db, "quizzes"));
      await set(newRef, quizData);
      toast.success("Quiz saved successfully!");

      // Reset
      setTitle("");
      setDescription("");
      setCatId("");
      setSubCatId("");
      setDurationMin(30);
      setPassingMarks(10);
      setNegativeMarking(false);
      setShuffleQuestions(true);
      setShuffleOptions(true);
      setSelectedQuestionIds([]);
      setShowBuilder(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save quiz.");
    }
  };

  const toggleStatus = async (qid: string, currentStatus: "draft" | "published" | "archived") => {
    const nextStatus = currentStatus === "published" ? "draft" : "published";
    try {
      await set(ref(getFirebaseDb(), `quizzes/${qid}/status`), nextStatus);
      toast.success(`Quiz status updated to ${nextStatus}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const handleDelete = async (qid: string, quizTitle: string) => {
    if (!confirm(`Are you sure you want to delete the quiz: "${quizTitle}"?`)) return;
    try {
      await remove(ref(getFirebaseDb(), `quizzes/${qid}`));
      toast.success("Quiz deleted");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete quiz.");
    }
  };

  const filteredQuizzes = Object.entries(quizzes).filter(([_, q]) =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quizzes</h1>
          <p className="text-sm text-muted-foreground">
            Build quizzes by compiling questions from your question bank.
          </p>
        </div>
        <Button
          onClick={() => setShowBuilder(!showBuilder)}
          variant={showBuilder ? "outline" : "default"}
        >
          {showBuilder ? (
            <>
              <X className="mr-2 h-4 w-4" /> Cancel
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" /> Create Quiz
            </>
          )}
        </Button>
      </div>

      {showBuilder && (
        <Card className="border-primary/20 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <CardHeader>
            <CardTitle>Quiz Builder</CardTitle>
            <CardDescription>
              Setup your quiz metadata, rules, and select its questions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Left Column: Metadata */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="quiz-title">Quiz Title</Label>
                    <Input
                      id="quiz-title"
                      placeholder="e.g. Midterm Physics Exam"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="quiz-desc">Description</Label>
                    <Textarea
                      id="quiz-desc"
                      placeholder="e.g. Covers chapters 1-3. Shuffled questions."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-16"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Category</Label>
                      <Select
                        value={catId}
                        onValueChange={(val) => {
                          setCatId(val);
                          setSubCatId("");
                          setSelectedQuestionIds([]);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(categories).map(([id, c]) => (
                            <SelectItem key={id} value={id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Subcategory</Label>
                      <Select
                        value={subCatId}
                        onValueChange={(val) => {
                          setSubCatId(val);
                          setSelectedQuestionIds([]);
                        }}
                        disabled={!catId}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={catId ? "Select Subcategory" : "Select category first"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_all">All subcategories</SelectItem>
                          {Object.entries(subcategories)
                            .filter(([_, s]) => s.categoryId === catId)
                            .map(([id, s]) => (
                              <SelectItem key={id} value={id}>
                                {s.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="duration">Duration (Minutes)</Label>
                      <Input
                        id="duration"
                        type="number"
                        min={1}
                        value={durationMin}
                        onChange={(e) => setDurationMin(Number(e.target.value))}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="passing">Passing Marks</Label>
                      <Input
                        id="passing"
                        type="number"
                        min={0}
                        value={passingMarks}
                        onChange={(e) => setPassingMarks(Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-3.5 rounded-lg border p-4 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Negative Marking</Label>
                        <p className="text-xs text-muted-foreground">
                          Apply penalty for wrong answers.
                        </p>
                      </div>
                      <Switch checked={negativeMarking} onCheckedChange={setNegativeMarking} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Shuffle Questions</Label>
                        <p className="text-xs text-muted-foreground">
                          Randomize order for each user.
                        </p>
                      </div>
                      <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Shuffle Options</Label>
                        <p className="text-xs text-muted-foreground">Randomize MCQ choices.</p>
                      </div>
                      <Switch checked={shuffleOptions} onCheckedChange={setShuffleOptions} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Quiz Status</Label>
                    <Select
                      value={status}
                      onValueChange={(val: "draft" | "published") => setStatus(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="published">Published (Visible to users)</SelectItem>
                        <SelectItem value="draft">Draft (Hidden)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Right Column: Question Checklist */}
                <div className="flex flex-col border rounded-lg p-4 bg-background">
                  <div className="mb-4 pb-2 border-b">
                    <h3 className="font-semibold text-sm">
                      Select Questions ({selectedQuestionIds.length} chosen)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Showing questions under category:{" "}
                      <span className="font-medium text-foreground">
                        {categories[catId]?.name ?? "None Selected"}
                      </span>
                    </p>
                  </div>

                  {!catId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                      <FileQuestion className="h-8 w-8 mb-2 stroke-1" />
                      <p className="text-xs">
                        Select a category on the left to load matching questions.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[360px] pr-1">
                      {filteredQuestionsForBuilder.map(([qid, q]) => {
                        const checked = selectedQuestionIds.includes(qid);
                        return (
                          <div
                            key={qid}
                            onClick={() => toggleQuestionSelection(qid)}
                            className={`flex items-start gap-3 rounded-lg border p-3 text-xs transition cursor-pointer select-none ${
                              checked ? "border-primary bg-primary/5" : "hover:bg-muted/30"
                            }`}
                          >
                            <Checkbox checked={checked} id={`chk-${qid}`} className="mt-0.5" />
                            <div className="flex-1 space-y-1">
                              <p className="font-medium text-foreground line-clamp-2">{q.text}</p>
                              <div className="flex items-center gap-1.5">
                                <Badge
                                  variant="secondary"
                                  className="text-[9px] px-1 py-0 capitalize"
                                >
                                  {q.difficulty}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">
                                  +{q.marks} Marks
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {filteredQuestionsForBuilder.length === 0 && (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                          No questions found in this category. Author questions in the Question Bank
                          first.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>
                      Total Marks:{" "}
                      <span className="text-emerald-600 font-bold text-sm">
                        {totalSelectedMarks}
                      </span>
                    </span>
                    <span>Questions: {selectedQuestionIds.length}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setShowBuilder(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save & Build Quiz</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Quiz List dashboard */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Quiz Library</CardTitle>
          <CardDescription>Search and manage published and draft quizzes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quizzes by title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {filteredQuizzes.map(([qid, q]) => (
              <Card key={qid} className="hover:border-primary/30 transition shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <Badge
                      variant={q.status === "published" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {q.status}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleStatus(qid, q.status)}
                      >
                        {q.status === "published" ? (
                          <X
                            className="h-4 w-4 text-muted-foreground hover:text-foreground"
                            title="Set to draft"
                          />
                        ) : (
                          <Check className="h-4 w-4 text-emerald-600" title="Publish" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(qid, q.title)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-base line-clamp-1 mt-1">{q.title}</CardTitle>
                  <CardDescription className="line-clamp-2 text-xs h-8">
                    {q.description || "No description."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2 text-xs border-t bg-muted/5 flex flex-wrap gap-4 items-center justify-between text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{Math.round(q.durationSec / 60)} mins</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-3.5 w-3.5" />
                    <span>{q.questionIds?.length ?? 0} Questions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="h-3.5 w-3.5" />
                    <span>
                      {q.passingMarks} / {q.totalMarks} Passing
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredQuizzes.length === 0 && (
              <div className="col-span-2 text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
                No quizzes built yet. Click "Create Quiz" to build your first quiz.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
