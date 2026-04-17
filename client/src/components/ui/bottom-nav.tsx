import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { PremiumIcon } from "./premium-icons";

interface NavItem {
  href: string;
  label: string;
  iconVariant: "home" | "chat" | "tracker" | "profile" | "calendar" | "workout" | "food";
}

export function BottomNav() {
  const [location] = useLocation();

  const navItems: NavItem[] = [
    {
      href: "/home",
      label: "Home",
      iconVariant: "home",
    },
    {
      href: "/plans",
      label: "Activities",
      iconVariant: "workout",
    },
    {
      href: "/chat",
      label: "Trainer",
      iconVariant: "chat",
    },
    {
      href: "/diet",
      label: "Diet",
      iconVariant: "food",
    },
    {
      href: "/progress",
      label: "Progress",
      iconVariant: "calendar",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-card/95 backdrop-blur-xl border-t border-white/10 px-2 pb-safe">
        <div className="flex items-center justify-around h-20">
          {navItems.map((item) => {
            const isActive = location === item.href || 
              (item.href === "/chat" && location === "/dashboard");

            return (
              <Link key={item.href} href={item.href}>
                <motion.div
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-colors",
                    isActive 
                      ? "text-primary" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="bottomNavIndicator"
                      className="absolute inset-0 bg-primary/10 rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <div className="relative z-10">
                    <PremiumIcon variant={item.iconVariant} size="sm" />
                  </div>
                  <span className={cn(
                    "relative z-10 text-[10px] font-medium mt-0.5",
                    isActive && "text-primary"
                  )}>
                    {item.label}
                  </span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
