import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold">
          <div className="h-7 w-7 rounded-lg bg-primary" />
          QuizForge
        </div>
        <nav className="flex items-center gap-2">
          {user ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get started
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            AI-powered quizzes, built from your syllabus.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Upload a PDF, extract the syllabus tree, generate questions with AI, and give learners a
            real-time, timed quiz experience — all in one place.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Create free account
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            {
              t: "RAG question generation",
              d: "Upload your syllabus PDF. Pick a topic. Generate high-quality questions grounded in your content.",
            },
            {
              t: "Real-time attempt engine",
              d: "Question palette, timer, autosave and mark-for-review — all synced instantly with no page reloads.",
            },
            {
              t: "Every question type",
              d: "MCQ, multi-select, fill-in-the-blank, match, true/false, image and coding questions.",
            },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border bg-card p-6">
              <h3 className="font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
