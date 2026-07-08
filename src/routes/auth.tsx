import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/features/auth/AuthProvider";
import { signIn, signUp, sendReset } from "@/features/auth/auth-actions";
import { isFirebaseConfigured } from "@/lib/firebase";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "reset"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const { user, loading, role } = useAuth();
  const mode = search.mode ?? "signin";

  useEffect(() => {
    if (!loading && user) {
      // role is always resolved before loading turns false (see AuthProvider)
      navigate({ to: role === "admin" ? "/admin" : "/dashboard" });
    }
  }, [user, loading, role, navigate]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        await signUp(email, password, displayName);
        toast.success("Account created — signing you in…");
      } else if (mode === "reset") {
        await sendReset(email);
        toast.success("Password reset email sent");
        setBusy(false);
        return;
      } else {
        await signIn(email, password);
        toast.success("Signed in");
      }
      // Do NOT navigate here — wait for onAuthStateChanged → useEffect above
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="mx-auto max-w-md p-8">
        <Card>
          <CardHeader>
            <CardTitle>Firebase not configured</CardTitle>
            <CardDescription>
              Paste your Firebase web config into{" "}
              <code className="rounded bg-muted px-1">src/lib/firebase-config.ts</code>, then
              reload.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {mode === "signup" ? "Create account" : mode === "reset" ? "Reset password" : "Sign in"}
          </CardTitle>
          <CardDescription>
            {mode === "signup"
              ? "The first account to sign up becomes the platform admin."
              : mode === "reset"
                ? "We'll email you a reset link."
                : "Welcome back to QuizForge."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {mode !== "reset" && (
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input
                  id="pw"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy
                ? "Working…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "reset"
                    ? "Send reset email"
                    : "Sign in"}
            </Button>
          </form>

          <div className="mt-6 flex justify-between text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                <Link to="/auth" search={{ mode: "reset" }} className="hover:underline">
                  Forgot password?
                </Link>
                <Link to="/auth" search={{ mode: "signup" }} className="hover:underline">
                  Create account
                </Link>
              </>
            ) : (
              <Link to="/auth" search={{ mode: "signin" }} className="hover:underline">
                Back to sign in
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
