import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/history")({
  component: () => (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-semibold">Attempt history</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your quiz attempts will appear here once the attempt engine is enabled.
      </p>
    </div>
  ),
});
