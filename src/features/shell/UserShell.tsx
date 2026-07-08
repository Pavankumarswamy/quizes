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
    <div className="flex h-full w-full overflow-hidden">
      <aside className="hidden w-60 flex-col border-r bg-card md:flex h-full shrink-0">
        <div className="flex h-11 items-center gap-2 border-b px-3 font-semibold shrink-0 text-sm">
          <div className="h-5 w-5 rounded bg-primary" />
          QuizForge
        </div>
        <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto no-scrollbar">
          {nav.map((n) => {
            const active = pathname === n.to;
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
          {role === "admin" && (
            <Link
              to="/admin"
              className="mt-2 flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-[13px] text-foreground hover:bg-accent/60"
            >
              <Shield className="h-3.5 w-3.5 shrink-0" />
              Admin console
            </Link>
          )}
        </nav>
        <div className="border-t p-2 shrink-0 space-y-1.5">
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
