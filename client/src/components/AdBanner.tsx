import { useState, useEffect } from "react";
import { X, Sparkles, Crown, Lightbulb, Heart, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { hasFullAccess } from "@shared/permissions";

interface AdBannerProps {
  variant?: "horizontal" | "sidebar" | "inline";
  className?: string;
  showUpgrade?: boolean;
  user?: { subscriptionType?: string | null; createdAt?: Date | string | null; subscriptionEndDate?: Date | string | null } | null;
}

const adContent = [
  {
    title: "Upgrade to Premium",
    description: "Get unlimited AI coaching, document analysis, and personalized plans",
    cta: "Start Free Trial",
    gradient: "from-primary/20 via-primary/10 to-transparent",
    icon: Crown,
  },
  {
    title: "Transform Your Health",
    description: "Join thousands achieving their fitness goals with NutriCore",
    cta: "Go Premium",
    gradient: "from-amber-500/20 via-amber-500/10 to-transparent",
    icon: Sparkles,
  },
  {
    title: "Unlock Full Potential",
    description: "Premium members see 3x faster results with AI-powered coaching",
    cta: "Upgrade Now",
    gradient: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    icon: Crown,
  },
];

const premiumTips = [
  {
    title: "Stay Hydrated",
    description: "Drink water 30 minutes before meals to boost metabolism and reduce hunger",
    gradient: "from-blue-500/20 via-blue-500/10 to-transparent",
    icon: Heart,
  },
  {
    title: "Recovery Matters",
    description: "Rest days are when your muscles actually grow stronger - embrace them",
    gradient: "from-purple-500/20 via-purple-500/10 to-transparent",
    icon: Lightbulb,
  },
  {
    title: "Consistency is Key",
    description: "Small daily efforts compound into remarkable results over time",
    gradient: "from-primary/20 via-primary/10 to-transparent",
    icon: Flame,
  },
];

export function AdBanner({ variant = "horizontal", className, showUpgrade = true, user }: AdBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Use hasFullAccess to treat TRIAL users the same as PAID users
  const isPremium = hasFullAccess(user);
  const content = isPremium ? premiumTips : adContent;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % content.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [content.length]);

  if (dismissed) return null;

  const item = content[currentIndex];
  const Icon = item.icon;

  if (variant === "sidebar") {
    return (
      <Card 
        className={cn(
          "relative overflow-hidden border-0 bg-gradient-to-br",
          item.gradient,
          className
        )}
        data-testid="ad-banner-sidebar"
      >
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/10 transition-colors z-10"
          data-testid="button-dismiss-ad"
        >
          <X className="w-3 h-3 text-muted-foreground" />
        </button>
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isPremium ? "Pro Tip" : "Sponsored"}
            </span>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground">{item.title}</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.description}</p>
          </div>
          {!isPremium && showUpgrade && (
            <a href="/profile">
              <Button 
                size="sm" 
                className="w-full gradient-primary text-white text-xs h-8"
                data-testid="button-ad-upgrade"
              >
                {(item as typeof adContent[0]).cta}
              </Button>
            </a>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-1 pb-2">
          {content.map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1 h-1 rounded-full transition-colors",
                i === currentIndex ? "bg-primary" : "bg-white/20"
              )}
            />
          ))}
        </div>
      </Card>
    );
  }

  if (variant === "inline") {
    return (
      <div 
        className={cn(
          "relative flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r border border-white/5",
          item.gradient,
          className
        )}
        data-testid="ad-banner-inline"
      >
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
        </div>
        {!isPremium && showUpgrade && (
          <a href="/profile">
            <Button 
              size="sm" 
              className="gradient-primary text-white text-xs shrink-0"
              data-testid="button-ad-upgrade-inline"
            >
              Upgrade
            </Button>
          </a>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
          data-testid="button-dismiss-ad-inline"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
        <span className="absolute top-1 right-10 text-[8px] uppercase tracking-wider text-muted-foreground/50">
          {isPremium ? "Tip" : "Ad"}
        </span>
      </div>
    );
  }

  return (
    <Card 
      className={cn(
        "relative overflow-hidden border-0 bg-gradient-to-r",
        item.gradient,
        className
      )}
      data-testid="ad-banner-horizontal"
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 transition-colors z-10"
        data-testid="button-dismiss-ad-horizontal"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
      <div className="flex items-center gap-4 p-4">
        <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-foreground">{item.title}</h4>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-0.5 rounded-full bg-white/5">
              {isPremium ? "Pro Tip" : "Sponsored"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
        {!isPremium && showUpgrade && (
          <a href="/profile">
            <Button 
              className="gradient-primary text-white shrink-0 premium-glow"
              data-testid="button-ad-upgrade-horizontal"
            >
              {(item as typeof adContent[0]).cta}
            </Button>
          </a>
        )}
      </div>
    </Card>
  );
}

export function AdBannerWrapper({ 
  children, 
  user,
  variant = "horizontal",
  className 
}: { 
  children?: React.ReactNode;
  user?: { subscriptionType?: string | null; createdAt?: Date | string | null; subscriptionEndDate?: Date | string | null } | null;
  variant?: "horizontal" | "sidebar" | "inline";
  className?: string;
}) {
  return (
    <>
      <AdBanner variant={variant} className={className} user={user} />
      {children}
    </>
  );
}

export default AdBanner;
