import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/features/auth/AuthProvider";
import { signOutUser } from "@/features/auth/auth-actions";
import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, LayoutDashboard, User } from "lucide-react";

export function NavBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [prevScrollPos, setPrevScrollPos] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollPos = window.scrollY;
      
      if (currentScrollPos > 80) {
        if (prevScrollPos > currentScrollPos) {
          setVisible(true); // scrolling up
        } else {
          setVisible(false); // scrolling down
        }
      } else {
        setVisible(true); // show near top
      }
      
      setPrevScrollPos(currentScrollPos);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [prevScrollPos]);

  const handleLogout = async () => {
    await signOutUser();
    navigate({ to: "/" });
  };

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/exams", label: "Exams" },
    { to: "/materials", label: "Materials" },
    ...(user ? [{ to: "/dashboard", label: "Dashboard" }] : []),
  ];

  return (
    <header className={`sticky top-4 z-50 mx-auto max-w-7xl w-[calc(100%-2rem)] border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-350 ease-in-out rounded-[25px] shadow-md transform ${
      visible ? "translate-y-0 opacity-100" : "-translate-y-[150%] opacity-0 pointer-events-none"
    }`}>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between relative">
          {/* Logo (Left side) */}
          <div className="flex items-center">
            <Link
              to="/"
              className="flex items-center gap-2 font-extrabold text-lg tracking-wider uppercase text-sky-500 hover:text-sky-600 transition-colors"
            >
              electricwisers
            </Link>
          </div>

          {/* Center Nav items (Absolute Center) */}
          <nav className="hidden md:flex items-center justify-center gap-8 absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeProps={{ className: "text-sky-500 font-extrabold underline underline-offset-4" }}
                inactiveProps={{ className: "text-slate-700 hover:text-sky-500 dark:text-slate-200 dark:hover:text-sky-400 font-medium" }}
                className="text-xs uppercase tracking-wider transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right actions (Auth buttons) */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 border border-slate-100 dark:border-slate-800 rounded-full py-1.5 px-3 bg-slate-50/50 dark:bg-slate-800/50">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs text-slate-700 dark:text-slate-350 font-medium truncate max-w-[150px]">
                    {user.email}
                  </span>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 rounded-xl text-xs font-semibold gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 hover:text-red-650 hover:border-red-200 hover:bg-red-50/10 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  className="text-xs font-bold uppercase tracking-wider text-slate-600 hover:text-sky-500 dark:text-slate-300 dark:hover:text-sky-400 transition-colors"
                >
                  Sign In
                </Link>
                <Button
                  asChild
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 text-xs rounded-xl shadow-md shadow-blue-500/10"
                >
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Get Started
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top duration-200">
          <nav className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileMenuOpen(false)}
                activeProps={{ className: "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/50 dark:bg-blue-950/20" }}
                inactiveProps={{ className: "text-slate-600 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-400 font-medium" }}
                className="text-xs uppercase tracking-wider p-2.5 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-3">
            {user ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-2 text-xs text-slate-500 dark:text-slate-400 truncate">
                  <User className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  variant="outline"
                  className="w-full text-xs font-semibold gap-1.5 h-10 border-slate-200 text-slate-700 dark:border-slate-700 dark:text-slate-300 hover:text-red-600 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  asChild
                  variant="ghost"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-xs font-bold text-slate-600 hover:text-blue-600 w-full h-10 justify-center cursor-pointer"
                >
                  <Link to="/auth" search={{ mode: "signin" }}>
                    Sign In
                  </Link>
                </Button>
                <Button
                  asChild
                  onClick={() => setMobileMenuOpen(false)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold w-full h-10 justify-center rounded-lg cursor-pointer"
                >
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Get Started
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
