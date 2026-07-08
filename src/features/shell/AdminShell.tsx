import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderTree,
  FileText,
  Sparkles,
  BookOpen,
  ClipboardList,
  Users,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { signOutUser } from "@/features/auth/auth-actions";

const nav: Array<{ to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }> = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/documents", label: "Documents", icon: FileText },
  { to: "/admin/generate", label: "AI generator", icon: Sparkles },
  { to: "/admin/questions", label: "Question bank", icon: BookOpen },
  { to: "/admin/quizzes", label: "Quizzes", icon: ClipboardList },
  { to: "/admin/users", label: "Users", icon: Users },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="hidden w-60 flex-col border-r bg-card md:flex h-full shrink-0">
        <div className="flex h-11 items-center gap-2 border-b px-3 font-semibold shrink-0 text-sm">
          <div className="h-5 w-5 rounded bg-primary" />
          Admin console
        </div>
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto no-scrollbar">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1.5 border-t p-2 shrink-0">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start h-8 text-[11px] px-2.5">
            <Link to="/dashboard">
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to app
            </Link>
          </Button>
          <div className="truncate text-[10px] px-1 text-muted-foreground">{user?.email}</div>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-8 text-[11px]"
            onClick={async () => {
              await signOutUser();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 bg-muted/20 h-full overflow-y-auto">{children}</main>
    </div>
  );
}
