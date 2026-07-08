import { type ReactNode, useState } from "react";
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
  ChevronLeft,
  ChevronRight,
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

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin-sidebar-collapsed") === "true";
    }
    return false;
  });

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin-sidebar-collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside
        className={`hidden flex-col border-r bg-card md:flex h-full shrink-0 transition-all duration-200 ${isCollapsed ? "w-12" : "w-60"}`}
      >
        <div className="flex h-11 items-center justify-between border-b px-2 font-semibold shrink-0 text-sm">
          {!isCollapsed && (
            <div className="flex items-center gap-2 truncate pl-1">
              <div className="h-5 w-5 rounded bg-primary shrink-0" />
              <span className="truncate">Admin console</span>
            </div>
          )}
          {isCollapsed && <div className="h-5 w-5 rounded bg-primary mx-auto" />}
          {!isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isCollapsed && (
          <div className="flex justify-center py-2 border-b">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
              title="Expand sidebar"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto no-scrollbar">
          {nav.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 rounded-md p-1.5 text-[13px] transition ${
                  isCollapsed ? "justify-center px-0" : "px-2.5"
                } ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
                title={isCollapsed ? n.label : undefined}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {!isCollapsed && <span className="truncate">{n.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div
          className={`space-y-1.5 border-t p-2 shrink-0 ${isCollapsed ? "flex flex-col items-center" : ""}`}
        >
          {isCollapsed ? (
            <>
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                title="Back to app"
              >
                <Link to="/dashboard">
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 cursor-pointer"
                title="Sign out"
                onClick={async () => {
                  await signOutUser();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 text-[11px] px-2.5 cursor-pointer"
              >
                <Link to="/dashboard">
                  <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Back to app
                </Link>
              </Button>
              <div className="truncate text-[10px] px-1 text-muted-foreground">{user?.email}</div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-[11px] cursor-pointer"
                onClick={async () => {
                  await signOutUser();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign out
              </Button>
            </>
          )}
        </div>
      </aside>
      <main className="flex-1 bg-muted/20 h-full overflow-y-auto">{children}</main>
    </div>
  );
}
