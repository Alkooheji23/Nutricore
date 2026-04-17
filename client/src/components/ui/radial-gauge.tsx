import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface RadialGaugeProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
  colorScheme?: "green" | "yellow" | "red" | "auto" | "primary";
  className?: string;
}

export function RadialGauge({
  value,
  max,
  label,
  sublabel,
  size = "md",
  showPercentage = true,
  colorScheme = "auto",
  className,
}: RadialGaugeProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const getColor = () => {
    if (colorScheme === "primary") return "stroke-primary";
    if (colorScheme === "green") return "stroke-emerald-500";
    if (colorScheme === "yellow") return "stroke-amber-500";
    if (colorScheme === "red") return "stroke-red-500";
    
    if (percentage >= 70) return "stroke-emerald-500";
    if (percentage >= 40) return "stroke-amber-500";
    return "stroke-red-500";
  };

  const getGlowColor = () => {
    if (colorScheme === "primary") return "drop-shadow-[0_0_8px_hsl(85,30%,42%)]";
    if (colorScheme === "green" || (colorScheme === "auto" && percentage >= 70)) 
      return "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]";
    if (colorScheme === "yellow" || (colorScheme === "auto" && percentage >= 40)) 
      return "drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]";
    return "drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]";
  };

  const sizeConfig = {
    sm: { dimension: 80, stroke: 6, fontSize: "text-lg", labelSize: "text-[10px]" },
    md: { dimension: 120, stroke: 8, fontSize: "text-2xl", labelSize: "text-xs" },
    lg: { dimension: 160, stroke: 10, fontSize: "text-3xl", labelSize: "text-sm" },
  };

  const config = sizeConfig[size];
  const radius = (config.dimension - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="relative" style={{ width: config.dimension, height: config.dimension }}>
        <svg
          width={config.dimension}
          height={config.dimension}
          className="transform -rotate-90"
        >
          <circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={config.stroke}
            className="text-white/10"
          />
          <motion.circle
            cx={config.dimension / 2}
            cy={config.dimension / 2}
            r={radius}
            fill="none"
            strokeWidth={config.stroke}
            strokeLinecap="round"
            className={cn(getColor(), getGlowColor())}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            style={{ strokeDasharray: circumference }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span 
            className={cn("font-display font-bold", config.fontSize)}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            {showPercentage ? `${Math.round(percentage)}%` : value}
          </motion.span>
          {sublabel && (
            <span className={cn("text-muted-foreground", config.labelSize)}>
              {sublabel}
            </span>
          )}
        </div>
      </div>
      <span className={cn("font-medium text-center", config.labelSize === "text-[10px]" ? "text-xs" : config.labelSize)}>
        {label}
      </span>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: number;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({
  icon,
  label,
  value,
  change,
  trend = "neutral",
  className,
}: MetricCardProps) {
  const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground";
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-sm border border-white/5 p-4",
        "hover:bg-card/70 transition-all duration-300 hover:border-white/10",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-display font-bold">{value}</p>
          </div>
        </div>
        {change !== undefined && (
          <div className={cn("text-xs font-medium", trendColor)}>
            {trendIcon} {Math.abs(change)}%
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface InsightBannerProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "info" | "success" | "warning";
  className?: string;
}

export function InsightBanner({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = "info",
  className,
}: InsightBannerProps) {
  const variantStyles = {
    info: "bg-primary/10 border-primary/20 text-primary",
    success: "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        "rounded-2xl border p-4",
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-current/10 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs opacity-80 mt-0.5">{description}</p>
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="mt-2 text-xs font-medium underline underline-offset-2 hover:opacity-80"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function SkeletonGauge({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeConfig = {
    sm: { dimension: 80 },
    md: { dimension: 120 },
    lg: { dimension: 160 },
  };

  return (
    <div className="flex flex-col items-center gap-2 animate-pulse">
      <div 
        className="rounded-full bg-white/5"
        style={{ width: sizeConfig[size].dimension, height: sizeConfig[size].dimension }}
      />
      <div className="h-3 w-16 bg-white/5 rounded" />
    </div>
  );
}
