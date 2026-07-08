import { type ReactNode } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, BookOpen, History, User as UserIcon, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { signOutUser } from "@/features/auth/auth-actions";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/categories", label: "Categories", icon: BookOpen },
  { to: "/history", label: "Attempt history", icon: History },
  { to: "/profile", label: "Profile", icon: UserIcon },
] as const;

export function UserShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, role } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 flex-col border-r bg-card md:flex h-screen sticky top-0 overflow-y-auto shrink-0">
        <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
          <div className="h-6 w-6 rounded-md bg-primary" />
          QuizForge
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((n) => {
            const active = pathname === n.to;
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          {role === "admin" && (
            <Link
              to="/admin"
              className="mt-4 flex items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-foreground hover:bg-accent/60"
            >
              <Shield className="h-4 w-4" />
              Admin console
            </Link>
          )}
        </nav>
        <div className="border-t p-3">
          <div className="mb-2 truncate text-xs text-muted-foreground">{user?.email}</div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={async () => {
              await signOutUser();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 bg-muted/20">{children}</main>
    </div>
  );
}
