import { Link, useLocation } from "wouter";
import { 
  MessageSquare, 
  User, 
  LogOut, 
  Menu,
  Sparkles,
  ClipboardList,
  Lock,
  Shield,
  BarChart3,
  Home,
  Watch
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import nutriCoreLogo from "@assets/IMG_2362-Photoroom_1765782477249.png";
import { useUser } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { BottomNav } from "@/components/ui/bottom-nav";
import { hasFullAccess } from "@shared/permissions";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { data: user } = useUser();

  const isPremium = hasFullAccess(user);
  const isAdmin = user?.email?.toLowerCase() === 'maalkooheji@gmail.com';

  const navItems = [
    { href: "/home", label: "Home", icon: Home, badge: false, gated: false },
    { href: "/chat", label: "My Trainer", icon: MessageSquare, badge: false, gated: false },
    { href: "/calendar", label: "Calendar", icon: ClipboardList, gated: false },
    { href: "/plans", label: "Workouts", icon: ClipboardList, gated: false },
    { href: "/devices", label: "Smartwatches & Integrations", icon: Watch, badge: false, gated: false },
    { href: "/profile", label: "Profile", icon: User, gated: false },
    ...(isAdmin ? [{ href: "/admin", label: "Admin Dashboard", icon: Shield, badge: false, gated: false }] : []),
  ];

  const NavContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-6 flex items-center gap-3 border-b border-white/5">
        <div className="w-11 h-11 rounded-xl bg-black flex items-center justify-center overflow-hidden">
          <img src={nutriCoreLogo} alt="NutriCore" className="w-10 h-10 object-contain" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl tracking-tight text-foreground">NutriCore</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">AI Fitness</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const isLocked = item.gated && !isPremium;
          
          if (isLocked) {
            return (
              <button
                key={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative w-full text-left",
                  "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
                onClick={() => {
                  setIsMobileOpen(false);
                  setShowUpgradeModal(true);
                }}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                <span className="font-medium text-sm">{item.label}</span>
                <Lock className="w-4 h-4 ml-auto opacity-50" />
              </button>
            );
          }
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
              onClick={() => setIsMobileOpen(false)}
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-primary" />
              )}
              <item.icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", isActive && "text-primary")} />
              <span className="font-medium text-sm">{item.label}</span>
              {item.badge && (
                <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  <Sparkles className="w-3 h-3" />
                  <span className="text-[10px] font-semibold">AI</span>
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/5 space-y-2">
        {/* Admin link - only visible to admin */}
        {user?.email === 'maalkooheji@gmail.com' && (
          <Link 
            href="/admin"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
              location === '/admin'
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
            onClick={() => setIsMobileOpen(false)}
            data-testid="nav-admin"
          >
            <Shield className="w-5 h-5" />
            <span className="font-medium text-sm">Admin</span>
          </Link>
        )}
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors" 
          data-testid="button-logout"
          onClick={() => {
            window.location.href = "/api/logout";
          }}
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign Out</span>
        </Button>
      </div>
    </div>
  );

  const isLanding = location === "/";
  const isChat = location === "/chat";
  const isHome = location === "/home" || location === "/dashboard";

  // Landing page has its own full-screen layout without bottom nav
  if (isLanding) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  // Chat page has its own layout but gets bottom nav on mobile
  if (isChat) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-20 md:pb-0">
        {children}
        <BottomNav />
      </div>
    );
  }

  // Home page uses standard layout with bottom nav
  if (isHome) {
    return (
      <div className="min-h-screen bg-background text-foreground pb-20 md:pb-0">
        {children}
        <BottomNav />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-64 fixed h-full z-30 border-r border-white/5">
          <NavContent />
        </aside>

        {/* Mobile Navigation */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 glass border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-black flex items-center justify-center overflow-hidden">
              <img src={nutriCoreLogo} alt="NutriCore" className="w-8 h-8 object-contain" />
            </div>
            <span className="font-display font-bold text-lg">NutriCore</span>
          </div>
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72 bg-sidebar border-white/5">
              <NavContent />
            </SheetContent>
          </Sheet>
        </div>

        {/* Main Content */}
        <main className="flex-1 md:ml-64 min-h-screen p-4 md:p-8 pt-20 md:pt-8 pb-24 md:pb-8 overflow-y-auto bg-background texture-noise">
          <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {children}
          </div>
        </main>
        
        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>

      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-md bg-card border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="w-5 h-5" />
              Upgrade to Premium
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Unlock the Daily Tracker and all premium features to take your fitness journey to the next level.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <ClipboardList className="w-4 h-4 text-primary" />
                <span>Track your daily food and workouts</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>Unlimited AI conversations</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-primary" />
                <span>Personalized meal and workout plans</span>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1"
              >
                Maybe Later
              </Button>
              <Button 
                onClick={() => {
                  setShowUpgradeModal(false);
                  window.location.href = '/profile';
                }}
                className="flex-1 bg-gradient-to-r from-primary to-green-600 hover:opacity-90"
              >
                View Plans
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
