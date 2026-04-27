import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: (props: { size: number; strokeWidth: number; color: string }) => React.ReactNode;
}

function HomeIcon({ size, strokeWidth, color }: { size: number; strokeWidth: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  );
}

function TrainIcon({ size, strokeWidth, color }: { size: number; strokeWidth: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4v16M18 4v16M6 12h12" />
      <circle cx="6" cy="4" r="1.5" fill={color} stroke="none" />
      <circle cx="6" cy="20" r="1.5" fill={color} stroke="none" />
      <circle cx="18" cy="4" r="1.5" fill={color} stroke="none" />
      <circle cx="18" cy="20" r="1.5" fill={color} stroke="none" />
    </svg>
  );
}

function CoachIcon({ size, strokeWidth, color }: { size: number; strokeWidth: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function NutritionIcon({ size, strokeWidth, color }: { size: number; strokeWidth: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function ProgressIcon({ size, strokeWidth, color }: { size: number; strokeWidth: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function BottomNav() {
  const [location] = useLocation();

  const navItems: NavItem[] = [
    { href: "/home", label: "Home", icon: HomeIcon },
    { href: "/plans", label: "Train", icon: TrainIcon },
    { href: "/chat", label: "Coach", icon: CoachIcon },
    { href: "/diet", label: "Nutrition", icon: NutritionIcon },
    { href: "/progress", label: "Progress", icon: ProgressIcon },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-background border-t border-[#1a1a1a]" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-center justify-around px-3 py-2 gap-0">
          {navItems.map((item, index) => {
            const isActive = location === item.href || (item.href === "/chat" && location === "/dashboard");
            const isCenter = index === 2;
            if (isCenter) {
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "#C9943A" }}>
                      {item.icon({ size: 18, strokeWidth: 1.5, color: "#0a0a0a" })}
                    </div>
                    <span className="text-[8px] font-medium uppercase tracking-[0.5px] whitespace-nowrap" style={{ color: isActive ? "#C9943A" : "#555" }}>
                      {item.label}
                    </span>
                  </div>
                </Link>
              );
            }
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className="flex flex-col items-center gap-1">
                  {item.icon({ size: 18, strokeWidth: 1.5, color: isActive ? "#C9943A" : "#555" })}
                  <span className="text-[8px] font-medium uppercase tracking-[0.5px] whitespace-nowrap" style={{ color: isActive ? "#C9943A" : "#555" }}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
