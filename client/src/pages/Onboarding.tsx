import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import phoenixLogo from "@assets/generated_images/phoenix_muted_olive_champagne.png";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProfileData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;   // stored as YYYY-MM-DD
  gender: string;
  height: number | null;      // always stored in cm
  heightUnit: "cm" | "ft";
  heightFt: number | null;
  heightIn: number | null;
  currentWeight: number | null;
  primarySport: string;
  experienceLevel: string;
  fitnessGoal: string;
  activityLevel: string;
}

// ─── Option helpers ──────────────────────────────────────────────────────────

const SPORTS = [
  { value: "strength",     label: "Gym / Strength",    emoji: "🏋️" },
  { value: "running",      label: "Running",            emoji: "🏃" },
  { value: "cycling",      label: "Cycling",            emoji: "🚴" },
  { value: "swimming",     label: "Swimming",           emoji: "🏊" },
  { value: "team_sports",  label: "Team Sports",        emoji: "⚽" },
  { value: "yoga",         label: "Yoga / Mobility",   emoji: "🧘" },
  { value: "crossfit",     label: "CrossFit / HIIT",   emoji: "🔥" },
  { value: "general",      label: "General Fitness",   emoji: "💪" },
];

const EXPERIENCE_LEVELS = [
  { value: "beginner",     label: "Beginner",    desc: "Just getting started" },
  { value: "intermediate", label: "Intermediate",desc: "1–3 years of training" },
  { value: "advanced",     label: "Advanced",    desc: "3+ years, serious athlete" },
];

const GOALS = [
  { value: "weight_loss",     label: "Lose Weight" },
  { value: "muscle_gain",     label: "Build Muscle" },
  { value: "performance",     label: "Improve Performance" },
  { value: "endurance",       label: "Build Endurance" },
  { value: "general_fitness", label: "Get Fitter" },
  { value: "recomposition",   label: "Body Recomposition" },
];

const GENDER_OPTIONS = ["Male", "Female", "Prefer not to say"];

// Infer activity level from experience so we don't need a 5th step
const ACTIVITY_FROM_EXPERIENCE: Record<string, string> = {
  beginner:     "light",
  intermediate: "moderate",
  advanced:     "active",
};

// ─── Pill button ─────────────────────────────────────────────────────────────

function Pill({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-medium transition-all duration-200 text-left",
        selected
          ? "border-primary bg-primary/15 text-primary"
          : "border-white/10 bg-white/5 text-muted-foreground hover:border-white/30 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

// ─── Progress dots ───────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === current ? "w-6 bg-primary" : i < current ? "w-3 bg-primary/50" : "w-3 bg-white/15"
          )}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Onboarding() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);

  const [data, setData] = useState<ProfileData>({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    height: null,
    heightUnit: "cm",
    heightFt: null,
    heightIn: null,
    currentWeight: null,
    primarySport: "",
    experienceLevel: "",
    fitnessGoal: "",
    activityLevel: "",
  });

  const set = <K extends keyof ProfileData>(field: K, value: ProfileData[K]) =>
    setData(prev => ({ ...prev, [field]: value }));

  // Calculate age in years from YYYY-MM-DD
  const ageFromDob = (dob: string): number | null => {
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  // Convert ft+in → cm
  const heightInCm = () => {
    if (data.heightUnit === "cm") return data.height;
    if (data.heightFt === null) return null;
    const totalInches = (data.heightFt * 12) + (data.heightIn ?? 0);
    return Math.round(totalInches * 2.54);
  };

  // ── Save mutation ──
  const save = useMutation({
    mutationFn: async () => {
      const cm = heightInCm();
      const activityLevel = ACTIVITY_FROM_EXPERIENCE[data.experienceLevel] || "moderate";

      // 1. Save core profile
      const r1 = await fetch("/api/profile/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim() || null,
          age: ageFromDob(data.dateOfBirth),
          dateOfBirth: data.dateOfBirth || null,
          gender: data.gender === "Prefer not to say" ? null : data.gender,
          height: cm,
          currentWeight: data.currentWeight,
          fitnessGoal: data.fitnessGoal,
          activityLevel,
        }),
      });
      if (!r1.ok) throw new Error("Failed to save profile");

      // 2. Save sport + experience level (best-effort, don't block on failure)
      try {
        await fetch("/api/profile/sport", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            primarySport: data.primarySport,
            experienceLevel: data.experienceLevel,
          }),
        });
      } catch (_) { /* non-critical */ }

      return r1.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setLocation("/chat");
    },
  });

  // ── Validation per step ──
  const canProceed = () => {
    if (step === 0) {
      const age = ageFromDob(data.dateOfBirth);
      return data.firstName.trim() !== "" && age !== null && age >= 13 && data.gender !== "";
    }
    if (step === 1) {
      const cm = heightInCm();
      return cm !== null && cm >= 100 && data.currentWeight !== null && data.currentWeight > 0;
    }
    if (step === 2) return data.primarySport !== "" && data.experienceLevel !== "";
    if (step === 3) return data.fitnessGoal !== "";
    return false;
  };

  const next = () => { if (canProceed()) setStep(s => s + 1); };
  const back = () => setStep(s => s - 1);

  const TOTAL_STEPS = 4;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <img src={phoenixLogo} alt="NutriCore" className="w-10 h-10 object-contain" />
          </div>
          <p className="text-xs text-muted-foreground tracking-widest uppercase">
            Calibrate your training profile
          </p>
        </div>

        <StepDots total={TOTAL_STEPS} current={step} />

        {/* ── Step 0: Basics ── */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-display font-semibold mb-1">Who are you?</h2>
              <p className="text-xs text-muted-foreground">This personalizes your coaching experience.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">First name</label>
                <Input
                  value={data.firstName}
                  onChange={e => set("firstName", e.target.value)}
                  placeholder="Mohamed"
                  className="bg-white/5 border-white/10 h-12"
                  data-testid="input-first-name"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Last name</label>
                <Input
                  value={data.lastName}
                  onChange={e => set("lastName", e.target.value)}
                  placeholder="Al-Kooheji"
                  className="bg-white/5 border-white/10 h-12"
                  data-testid="input-last-name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Date of birth</label>
              <Input
                type="date"
                max={new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                value={data.dateOfBirth}
                onChange={e => set("dateOfBirth", e.target.value)}
                className="bg-white/5 border-white/10 h-12"
                data-testid="input-dob"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Gender</label>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map(g => (
                  <Pill key={g} selected={data.gender === g} onClick={() => set("gender", g)}>
                    {g}
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: Body ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-display font-semibold mb-1">Your body stats</h2>
              <p className="text-xs text-muted-foreground">Used to calculate your nutrition targets and training load.</p>
            </div>

            {/* Height with unit toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Height</label>
                <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
                  {(["cm", "ft"] as const).map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => set("heightUnit", u)}
                      className={cn(
                        "px-3 py-1 rounded-md text-xs font-medium transition-all",
                        data.heightUnit === u ? "bg-primary text-white" : "text-muted-foreground"
                      )}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {data.heightUnit === "cm" ? (
                <Input
                  type="number"
                  min={100}
                  max={250}
                  value={data.height ?? ""}
                  onChange={e => set("height", parseFloat(e.target.value) || null)}
                  placeholder="175"
                  className="bg-white/5 border-white/10 h-12"
                  data-testid="input-height"
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    type="number"
                    min={4}
                    max={7}
                    value={data.heightFt ?? ""}
                    onChange={e => set("heightFt", parseInt(e.target.value) || null)}
                    placeholder="5 ft"
                    className="bg-white/5 border-white/10 h-12"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={11}
                    value={data.heightIn ?? ""}
                    onChange={e => set("heightIn", parseInt(e.target.value) || null)}
                    placeholder="9 in"
                    className="bg-white/5 border-white/10 h-12"
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Weight (kg)</label>
              <Input
                type="number"
                min={30}
                max={300}
                step={0.1}
                value={data.currentWeight ?? ""}
                onChange={e => set("currentWeight", parseFloat(e.target.value) || null)}
                placeholder="70"
                className="bg-white/5 border-white/10 h-12"
                data-testid="input-current-weight"
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Sport & Experience ── */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-display font-semibold mb-1">Your sport & level</h2>
              <p className="text-xs text-muted-foreground">Your trainer will tailor plans to your discipline.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Primary activity</label>
              <div className="grid grid-cols-2 gap-2">
                {SPORTS.map(s => (
                  <Pill
                    key={s.value}
                    selected={data.primarySport === s.value}
                    onClick={() => set("primarySport", s.value)}
                  >
                    <span className="mr-1.5">{s.emoji}</span>
                    {s.label}
                  </Pill>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wide">Experience level</label>
              <div className="space-y-2">
                {EXPERIENCE_LEVELS.map(e => (
                  <Pill
                    key={e.value}
                    selected={data.experienceLevel === e.value}
                    onClick={() => set("experienceLevel", e.value)}
                    className="w-full"
                  >
                    <div className="flex items-center justify-between">
                      <span>{e.label}</span>
                      <span className="text-[11px] opacity-60">{e.desc}</span>
                    </div>
                  </Pill>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Goal ── */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-display font-semibold mb-1">What's your main goal?</h2>
              <p className="text-xs text-muted-foreground">Your trainer prioritizes everything around this.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(g => (
                <Pill
                  key={g.value}
                  selected={data.fitnessGoal === g.value}
                  onClick={() => set("fitnessGoal", g.value)}
                  className="py-4 text-center justify-center"
                >
                  {g.label}
                </Pill>
              ))}
            </div>
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex gap-3 mt-8">
          {step > 0 && (
            <Button
              variant="ghost"
              onClick={back}
              className="h-12 px-4 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}

          {step < TOTAL_STEPS - 1 ? (
            <Button
              onClick={next}
              disabled={!canProceed()}
              className="flex-1 gradient-primary text-white h-12 font-semibold"
              data-testid="button-continue"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={() => save.mutate()}
              disabled={!canProceed() || save.isPending}
              className="flex-1 gradient-primary text-white h-12 font-semibold"
              data-testid="button-continue"
            >
              {save.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up…</>
              ) : (
                <>Meet your coach <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
