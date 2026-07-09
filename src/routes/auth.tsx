import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { signIn, signUp, sendReset, signInWithGoogle } from "@/features/auth/auth-actions";
import { isFirebaseConfigured } from "@/lib/firebase";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [isBlind, setIsBlind] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Background Interactive Node-Connecting Network Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
    }> = [];

    const particleCount = Math.min(65, Math.floor((width * height) / 18000));
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 1.5 + 1.5,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw and update node dots
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Bounce walls
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(148, 163, 184, 0.3)";
        ctx.fill();
      });

      // Draw lines between nodes close to each other
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.15 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: role === "admin" ? "/admin" : "/dashboard" });
    }
  }, [user, loading, role, navigate]);

  // Live password validation criteria
  const passwordCriteria = {
    length: password.length >= 6,
    number: /\D*\d/.test(password),
    uppercase: /\D*[A-Z]/.test(password),
  };

  const passwordStrength = Object.values(passwordCriteria).filter(Boolean).length;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }
        await signUp(email, password, displayName);
        toast.success("Account created — signing you in…");
      } else if (mode === "reset") {
        await sendReset(email);
        toast.success("Password reset email sent");
        setBusy(false);
        return;
      } else {
        await signIn(email, password);
        toast.success("Welcome back!");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setBusy(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google successfully!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
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
              <code className="rounded bg-muted px-1">src/lib/firebase-config.ts</code>, then reload.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
      {/* Canvas background nodes connection */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      {/* Back to Home Button */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-xs cursor-pointer select-none"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Home
      </Link>

      <style>{`
        /* From Uiverse.io by ilkhoeri */ 
        .card {
          --p: 20px;
          --h-form: auto;
          --w-form: 360px;
          --input-px: 0.75rem;
          --input-py: 0.5rem;
          --submit-h: 36px;
          --blind-w: 64px;
          --space-y: 0.35rem;
          width: var(--w-form);
          height: var(--h-form);
          max-width: 95%;
          border-radius: 16px;
          background: white;
          border: 1px solid #e2e8f0;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          overflow: hidden;
          padding: var(--p);
          -webkit-font-smoothing: antialiased;
          -webkit-user-select: none;
          user-select: none;
          font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          z-index: 10;
        }

        .avatar {
          --sz-avatar: 100px;
          order: 0;
          width: var(--sz-avatar);
          min-width: var(--sz-avatar);
          max-width: var(--sz-avatar);
          height: var(--sz-avatar);
          min-height: var(--sz-avatar);
          max-height: var(--sz-avatar);
          border: 1px solid #e2e8f0;
          border-radius: 9999px;
          overflow: hidden;
          cursor: pointer;
          z-index: 2;
          perspective: 80px;
          position: relative;
          margin: 0 0 0.5rem 0;
          display: flex;
          justify-content: center;
          align-items: center;
          --sz-svg: calc(var(--sz-avatar) - 10px);
          background-color: #f8fafc;
        }
        .avatar svg {
          position: absolute;
          transition:
            transform 0.2s ease-in,
            opacity 0.1s;
          transform-origin: 50% 100%;
          height: var(--sz-svg);
          width: var(--sz-svg);
          pointer-events: none;
        }
        .avatar svg#monkey {
          z-index: 1;
        }
        .avatar svg#monkey-hands {
          z-index: 2;
          transform-style: preserve-3d;
          transform: translateY(calc(var(--sz-avatar) / 1.25)) rotateX(-21deg);
        }

        .avatar::before {
          content: "";
          border-radius: 45%;
          width: calc(var(--sz-svg) / 3.889);
          height: calc(var(--sz-svg) / 5.833);
          border: 0;
          border-bottom: calc(var(--sz-svg) * (4 / 100)) solid #3c302a;
          bottom: 20%;

          position: absolute;
          transition: all 0.2s ease;
          z-index: 3;
        }
        .blind-check:checked ~ .avatar::before {
          width: calc(var(--sz-svg) * (9 / 100));
          height: 0;
          border-radius: 50%;
          border-bottom: calc(var(--sz-svg) * (10 / 100)) solid #3c302a;
        }
        .avatar svg#monkey .monkey-eye-r,
        .avatar svg#monkey .monkey-eye-l {
          animation: blink 10s 1s infinite;
          transition: all 0.2s ease;
        }
        @keyframes blink {
          0%,
          2%,
          4%,
          26%,
          28%,
          71%,
          73%,
          100% {
            ry: 4.5;
            cy: 31.7;
          }
          1%,
          3%,
          27%,
          72% {
            ry: 0.5;
            cy: 30;
          }
        }
        .blind-check:checked ~ .avatar svg#monkey .monkey-eye-r,
        .blind-check:checked ~ .avatar svg#monkey .monkey-eye-l {
          ry: 0.5;
          cy: 30;
        }
        .blind-check:checked ~ .avatar svg#monkey-hands {
          transform: translate3d(0, 0, 0) rotateX(0deg);
        }
        .avatar svg#monkey,
        .avatar::before,
        .avatar svg#monkey .monkey-eye-nose,
        .avatar svg#monkey .monkey-eye-r,
        .avatar svg#monkey .monkey-eye-l {
          transition: all 0.2s ease;
        }
        .blind-check:checked ~ .form:focus-within ~ .avatar svg#monkey,
        .blind-check:checked ~ .form:focus-within ~ .avatar::before,
        .blind-check:checked ~ .form:focus-within ~ .avatar svg#monkey .monkey-eye-nose,
        .blind-check:checked ~ .form:focus-within ~ .avatar svg#monkey .monkey-eye-r,
        .blind-check:checked ~ .form:focus-within ~ .avatar svg#monkey .monkey-eye-l {
          animation: none;
        }
        .form:focus-within ~ .avatar svg#monkey {
          animation: slick 3s ease infinite 1s;
          --center: rotateY(0deg);
          --left: rotateY(-4deg);
          --right: rotateY(4deg);
        }
        .form:focus-within ~ .avatar::before,
        .form:focus-within ~ .avatar svg#monkey .monkey-eye-nose,
        .blind-check:not(:checked)
          ~ .form:focus-within
          ~ .avatar
          svg#monkey
          .monkey-eye-r,
        .blind-check:not(:checked)
          ~ .form:focus-within
          ~ .avatar
          svg#monkey
          .monkey-eye-l {
          ry: 3;
          cy: 35;
          animation: slick 3s ease infinite 1s;
          --center: translateX(0);
          --left: translateX(-0.5px);
          --right: translateX(0.5px);
        }
        @keyframes slick {
          0%,
          100% {
            transform: var(--center);
          }
          25% {
            transform: var(--left);
          }
          75% {
            transform: var(--right);
          }
        }

        .card .blind_input {
          -webkit-user-select: none;
          user-select: none;
          cursor: pointer;
          z-index: 10;
          position: absolute;
          border: none;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          padding: 4px 8px;
          border-radius: 4px;
          background-color: transparent;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: bold;
        }
        .card .blind_input:hover {
          color: #1e293b;
          background-color: #f1f5f9;
        }

        .form {
          order: 1;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          flex-direction: column;
          width: 100%;
        }

        .form .title {
          width: 100%;
          font-size: 1.25rem;
          font-weight: 800;
          margin-top: 0;
          margin-bottom: 0.75rem;
          padding-top: 0;
          padding-bottom: 0.5rem;
          color: #1e293b;
          border-bottom: 1px solid #e2e8f0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-align: center;
        }

        .form .label_input {
          white-space: nowrap;
          font-size: 11px;
          margin-top: calc(var(--space-y) / 2);
          color: #64748b;
          font-weight: 700;
          display: inline;
          text-align: left;
          margin-right: auto;
          position: relative;
          z-index: 3;
          -webkit-user-select: none;
          user-select: none;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form .input {
          resize: vertical;
          background: white;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          outline: none;
          padding: var(--input-py) var(--input-px);
          font-size: 14px;
          width: 100%;
          color: #1e293b;
          margin: var(--space-y) 0;
          transition: all 0.25s ease;
        }
        .form .password-field {
          padding-right: calc(var(--blind-w) + var(--input-px) + 4px);
        }
        .form .input:focus {
          border: 1px solid #2563eb;
          outline: 0;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }
        .form .frg_pss {
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }
        .form .frg_pss a {
          background-color: transparent;
          cursor: pointer;
          text-decoration: none;
          transition: color 0.25s ease;
          color: #2563eb;
          font-weight: 600;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .form .frg_pss a:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }

        .form .submit {
          height: var(--submit-h);
          width: 100%;
          outline: none;
          cursor: pointer;
          background-color: #2563eb;
          border: 1px solid #1d4ed8;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: white;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 11px;
          text-align: center;
          text-decoration: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          text-transform: uppercase;
          margin: var(--space-y) 0 0;
          box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.15);
          transition: all 0.2s ease;
        }
        .form .submit:hover {
          background-color: #1d4ed8;
          box-shadow: 0 4px 12px -1px rgba(37, 99, 235, 0.25);
        }
        .form .submit:active {
          transform: scale(0.98);
        }

        .form .google-submit {
          height: var(--submit-h);
          width: 100%;
          outline: none;
          cursor: pointer;
          background-color: #ffffff;
          border: 1px solid #cbd5e1;
          font-weight: 700;
          letter-spacing: 0.05em;
          color: #334155;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 11px;
          text-align: center;
          text-decoration: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          text-transform: uppercase;
          margin: 0;
          box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .form .google-submit:hover {
          background-color: #f8fafc;
          border-color: #cbd5e1;
          color: #1e293b;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .form .google-submit:active {
          transform: scale(0.98);
        }

        .blind-check:checked ~ .form .password-field {
          -webkit-text-security: disc;
        }
      `}</style>

      {/* Main card */}
      <div className={`card ${mode === "signup" ? "register-mode" : ""}`}>
        {/* Toggle password visibility input */}
        <input
          checked={isBlind}
          onChange={(e) => setIsBlind(e.target.checked)}
          className="blind-check"
          type="checkbox"
          id="blind-input"
          name="blindcheck"
          hidden
        />

        {/* Auth form logic */}
        <form onSubmit={onSubmit} className="form">
          <div className="title">
            {mode === "signup" ? "Sign Up" : mode === "reset" ? "Reset Password" : "Sign In"}
          </div>

          {/* Full Name for Signup */}
          {mode === "signup" && (
            <>
              <label className="label_input" htmlFor="name-input">Full Name</label>
              <input
                spellCheck="false"
                className="input"
                type="text"
                name="name"
                id="name-input"
                placeholder="Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </>
          )}

          {/* Email input */}
          <label className="label_input" htmlFor="email-input">Email Address</label>
          <input
            spellCheck="false"
            className="input"
            type="email"
            name="email"
            id="email-input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* Password label / forgot password link */}
          {mode !== "reset" && (
            <>
              <div className="frg_pss">
                <label className="label_input" htmlFor="password-input">Password</label>
                {mode === "signin" && (
                  <Link to="/auth" search={{ mode: "reset" }} className="z-10">
                    Forgot password?
                  </Link>
                )}
              </div>
              <div className="relative w-full">
                <input
                  spellCheck="false"
                  className="input password-field"
                  type="text"
                  name="password"
                  id="password-input"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <label htmlFor="blind-input" className="blind_input">
                  {isBlind ? "Show" : "Hide"}
                </label>
              </div>
            </>
          )}

          {/* Confirm Password (only in signup mode) */}
          {mode === "signup" && (
            <>
              <label className="label_input" htmlFor="confirm-password-input">Confirm Password</label>
              <div className="relative w-full">
                <input
                  spellCheck="false"
                  className="input password-field"
                  type="text"
                  name="confirmPassword"
                  id="confirm-password-input"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          {/* Password strength details for Signup */}
          {mode === "signup" && password.length > 0 && (
            <div className="w-full space-y-1.5 pb-2.5">
              <div className="flex items-center justify-between text-[9px] font-bold text-slate-400">
                <span>Strength:</span>
                <span className={
                  passwordStrength === 3 ? "text-emerald-500" : passwordStrength === 2 ? "text-amber-500" : "text-red-500"
                }>
                  {passwordStrength === 3 ? "Strong" : passwordStrength === 2 ? "Medium" : "Weak"}
                </span>
              </div>
              <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    passwordStrength === 3 ? "w-full bg-emerald-500" : passwordStrength === 2 ? "w-2/3 bg-amber-500" : "w-1/3 bg-red-500"
                  }`}
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[8px] font-bold text-slate-400">
                <span className={`flex items-center gap-0.5 ${passwordCriteria.length ? "text-emerald-500 font-extrabold" : ""}`}>
                  <CheckCircle2 className="h-2 w-2 shrink-0" /> min 6 chars
                </span>
                <span className={`flex items-center gap-0.5 ${passwordCriteria.number ? "text-emerald-500 font-extrabold" : ""}`}>
                  <CheckCircle2 className="h-2 w-2 shrink-0" /> 1 number
                </span>
                <span className={`flex items-center gap-0.5 ${passwordCriteria.uppercase ? "text-emerald-500 font-extrabold" : ""}`}>
                  <CheckCircle2 className="h-2 w-2 shrink-0" /> 1 upper
                </span>
              </div>
            </div>
          )}

          {/* Submit button */}
          <button className="submit" type="submit" disabled={busy}>
            {busy ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Working...</span>
              </span>
            ) : mode === "signup" ? (
              "Register"
            ) : mode === "reset" ? (
              "Send Link"
            ) : (
              "Sign In"
            )}
          </button>

          {/* Google Button */}
          {mode !== "reset" && (
            <>
              <div className="w-full flex items-center justify-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest my-1.5">
                <div className="h-[1px] bg-slate-100 flex-1" />
                <span>or</span>
                <div className="h-[1px] bg-slate-100 flex-1" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
                className="google-submit"
              >
                <img
                  src="https://www.vectorlogo.zone/logos/google/google-icon.svg"
                  alt="Google"
                  className="h-4 w-4"
                />
                {mode === "signup" ? "Continue with Google" : "Sign In with Google"}
              </button>
            </>
          )}

          {/* Nav links block */}
          <div className="w-full text-center mt-4 text-[10px] font-bold text-slate-400 flex flex-col gap-1.5 border-t border-slate-100 pt-3">
            {mode === "signin" ? (
              <>
                <Link to="/auth" search={{ mode: "signup" }} className="text-blue-600 hover:underline text-xs tracking-wide">
                  CREATE ACCOUNT
                </Link>
              </>
            ) : (
              <Link to="/auth" search={{ mode: "signin" }} className="text-blue-600 hover:underline text-xs tracking-wide">
                BACK TO SIGN IN
              </Link>
            )}
          </div>
        </form>

        {/* Monkey Avatar Wrapper */}
        <label htmlFor="blind-input" className="avatar">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="35"
            height="35"
            viewBox="0 0 64 64"
            id="monkey"
          >
            <ellipse cx="53.7" cy="33" rx="8.3" ry="8.2" fill="#89664c"></ellipse>
            <ellipse cx="53.7" cy="33" rx="5.4" ry="5.4" fill="#ffc5d3"></ellipse>
            <ellipse cx="10.2" cy="33" rx="8.2" ry="8.2" fill="#89664c"></ellipse>
            <ellipse cx="10.2" cy="33" rx="5.4" ry="5.4" fill="#ffc5d3"></ellipse>
            <g fill="#89664c">
              <path
                d="m43.4 10.8c1.1-.6 1.9-.9 1.9-.9-3.2-1.1-6-1.8-8.5-2.1 1.3-1 2.1-1.3 2.1-1.3-20.4-2.9-30.1 9-30.1 19.5h46.4c-.7-7.4-4.8-12.4-11.8-15.2"
              ></path>
              <path
                d="m55.3 27.6c0-9.7-10.4-17.6-23.3-17.6s-23.3 7.9-23.3 17.6c0 2.3.6 4.4 1.6 6.4-1 2-1.6 4.2-1.6 6.4 0 9.7 10.4 17.6 23.3 17.6s23.3-7.9 23.3-17.6c0-2.3-.6-4.4-1.6-6.4 1-2 1.6-4.2 1.6-6.4"
              ></path>
            </g>
            <path
              d="m52 28.2c0-16.9-20-6.1-20-6.1s-20-10.8-20 6.1c0 4.7 2.9 9 7.5 11.7-1.3 1.7-2.1 3.6-2.1 5.7 0 6.1 6.6 11 14.7 11s14.7-4.9 14.7-11c0-2.1-.8-4-2.1-5.7 4.4-2.7 7.3-7 7.3-11.7"
              fill="#e0ac7e"
            ></path>
            <g fill="#3b302a" className="monkey-eye-nose">
              <path
                d="m35.1 38.7c0 1.1-.4 2.1-1 2.1-.6 0-1-.9-1-2.1 0-1.1.4-2.1 1-2.1.6.1 1 1 1 2.1"
              ></path>
              <path
                d="m30.9 38.7c0 1.1-.4 2.1-1 2.1-.6 0-1-.9-1-2.1 0-1.1.4-2.1 1-2.1.5.1 1 1 1 2.1"
              ></path>
              <ellipse
                cx="40.7"
                cy="31.7"
                rx="3.5"
                ry="4.5"
                className="monkey-eye-r"
              ></ellipse>
              <ellipse
                cx="23.3"
                cy="31.7"
                rx="3.5"
                ry="4.5"
                className="monkey-eye-l"
              ></ellipse>
            </g>
          </svg>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="35"
            height="35"
            viewBox="0 0 64 64"
            id="monkey-hands"
          >
            <path
              fill="#89664C"
              d="M9.4,32.5L2.1,61.9H14c-1.6-7.7,4-21,4-21L9.4,32.5z"
            ></path>
            <path
              fill="#FFD6BB"
              d="M15.8,24.8c0,0,4.9-4.5,9.5-3.9c2.3,0.3-7.1,7.6-7.1,7.6s9.7-8.2,11.7-5.6c1.8,2.3-8.9,9.8-8.9,9.8
	s10-8.1,9.6-4.6c-0.3,3.8-7.9,12.8-12.5,13.8C11.5,43.2,6.3,39,9.8,24.4C11.6,17,13.3,25.2,15.8,24.8"
            ></path>
            <path
              fill="#89664C"
              d="M54.8,32.5l7.3,29.4H50.2c1.6-7.7-4-21-4-21L54.8,32.5z"
            ></path>
            <path
              fill="#FFD6BB"
              d="M48.4,24.8c0,0-4.9-4.5-9.5-3.9c-2.3,0.3,7.1,7.6,7.1,7.6s-9.7-8.2-11.7-5.6c-1.8,2.3,8.9,9.8,8.9,9.8
	s-10-8.1-9.7-4.6c0.4,3.8,8,12.8,12.6,13.8c6.6,1.3,11.8-2.9,8.3-17.5C52.6,17,50.9,25.2,48.4,24.8"
            ></path>
          </svg>
        </label>
      </div>
    </div>
  );
}
