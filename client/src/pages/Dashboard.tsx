import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Activity, Flame, Utensils, Trophy, TrendingUp, Calendar, ArrowUpRight, Dumbbell, Loader2, Sparkles } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import nutriCoreLogo from "@assets/generated_images/heartbeat_mountain_gold_glow.png";
import { useUser, useDashboardStats } from "@/lib/api";
import { format } from "date-fns";
import { Link } from "wouter";
import { AdBanner } from "@/components/AdBanner";
import PageTransition from "@/components/PageTransition";

export default function Dashboard() {
  const { data: user, isLoading: userLoading } = useUser();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const isLoading = userLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto premium-glow">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
          <p className="text-muted-foreground text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const chartData = stats?.weeklyData.map((d, i) => ({
    name: format(new Date(d.date), "EEE"),
    weight: d.weight || 0,
    calories: d.calories || 0,
  })) || [
    { name: "Mon", weight: 0, calories: 0 },
    { name: "Tue", weight: 0, calories: 0 },
    { name: "Wed", weight: 0, calories: 0 },
    { name: "Thu", weight: 0, calories: 0 },
    { name: "Fri", weight: 0, calories: 0 },
  ];

  const weeklyGoalProgress = stats?.targetWeight && stats?.currentWeight 
    ? Math.min(Math.max(0, 100 - Math.abs(stats.currentWeight - stats.targetWeight) * 10), 100)
    : 0;

  const kpis = [
    { 
      label: "Weekly Goal", 
      value: `${Math.round(weeklyGoalProgress)}%`, 
      icon: Trophy, 
      color: "text-gold", 
      bgColor: "bg-gold/10",
      sub: weeklyGoalProgress >= 80 ? "Almost there!" : "Keep pushing!" 
    },
    { 
      label: "Calories Burned", 
      value: stats?.caloriesBurnedToday?.toLocaleString() || "0", 
      icon: Flame, 
      color: "text-orange-400", 
      bgColor: "bg-orange-500/10",
      sub: "kcal today" 
    },
    { 
      label: "Workouts", 
      value: `${stats?.workoutsCompleted || 0}/5`, 
      icon: Activity, 
      color: "text-primary", 
      bgColor: "bg-primary/10",
      sub: "sessions completed" 
    },
    { 
      label: "Current Weight", 
      value: `${stats?.currentWeight || '--'} kg`, 
      icon: TrendingUp, 
      color: "text-chart-1", 
      bgColor: "bg-chart-1/10",
      sub: stats?.weeklyProgress 
        ? `${stats.weeklyProgress > 0 ? '+' : ''}${stats.weeklyProgress.toFixed(1)}kg this week` 
        : "Track your progress" 
    },
  ];

  return (
    <PageTransition className="space-y-8 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-display text-foreground">
            Welcome back, <span className="text-primary">{user?.firstName || 'there'}</span>
          </h1>
          <p className="text-muted-foreground">Here's how you're progressing towards your goals.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl glass border border-white/5">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{format(new Date(), "EEEE, MMM dd")}</span>
          </div>
          <div className="h-12 w-12 rounded-xl overflow-hidden border-2 border-primary/30 premium-glow">
            <img 
              src={user?.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="card-premium bg-card/50 border-0 hover-lift group" data-testid={`kpi-${kpi.label.toLowerCase().replace(' ', '-')}`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
                  <h3 className="text-3xl font-bold font-display text-foreground">{kpi.value}</h3>
                  <p className="text-xs text-muted-foreground">{kpi.sub}</p>
                </div>
                <div className={`h-12 w-12 rounded-xl ${kpi.bgColor} flex items-center justify-center ${kpi.color} group-hover:scale-110 transition-transform duration-300`}>
                  <kpi.icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Ad Banner / Pro Tips */}
      <AdBanner variant="horizontal" user={user} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Progress Chart */}
        <Card className="lg:col-span-2 card-premium bg-card/50 border-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold text-foreground">Progress Overview</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Weight (kg)
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(85, 30%, 42%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(85, 30%, 42%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    stroke="hsl(180, 5%, 40%)" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    stroke="hsl(180, 5%, 40%)" 
                    fontSize={11} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`}
                    dx={-5}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(180, 3%, 10%)', 
                      border: '1px solid hsl(180, 3%, 20%)', 
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                    }}
                    itemStyle={{ color: 'hsl(45, 10%, 95%)' }}
                    labelStyle={{ color: 'hsl(45, 5%, 60%)', marginBottom: '4px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="hsl(85, 30%, 50%)" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#colorWeight)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Today's Focus */}
        <Card className="card-premium bg-card/50 border-0 flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold text-foreground">Today's Focus</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-4">
            {/* Workout Card */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-primary/30 transition-all duration-300 cursor-pointer group hover-lift">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                    <Dumbbell className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">Upper Body Power</h4>
                    <p className="text-xs text-muted-foreground">45 mins • Strength Training</p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </div>
              <Progress value={0} className="h-1.5 bg-white/5" />
            </div>

            {/* Meal Card */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-gold/30 transition-all duration-300 cursor-pointer group hover-lift">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gold/10 flex items-center justify-center text-gold group-hover:bg-gold/20 transition-colors">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground group-hover:text-gold transition-colors">Keto Salmon Bowl</h4>
                    <p className="text-xs text-muted-foreground">Lunch • 650 kcal</p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] bg-white/5 text-muted-foreground font-medium">High Protein</span>
                <span className="px-2.5 py-1 rounded-full text-[10px] bg-white/5 text-muted-foreground font-medium">Low Carb</span>
              </div>
            </div>

            {/* My Trainer Prompt - Premium Logo */}
            <div 
                className="mt-auto p-4 rounded-xl bg-gradient-to-br from-[#4A5D4A]/10 via-[#4A5D4A]/5 to-transparent border border-[#4A5D4A]/20 flex items-center gap-4 cursor-pointer hover:border-[#D4AF37]/40 transition-colors group"
                onClick={() => window.location.href = '/chat'}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-xl bg-[#0A0A0A] flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.15)]">
                    <img src={nutriCoreLogo} className="w-10 h-10 object-contain" alt="My Trainer" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#D4AF37] flex items-center justify-center">
                    <Sparkles className="w-2.5 h-2.5 text-black" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#F2F2F2] group-hover:text-[#D4AF37] transition-colors">My Trainer</p>
                  <p className="text-xs text-[#999999]">"You're 150 calories under your target. Add a snack?"</p>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#999999] group-hover:text-[#D4AF37] transition-colors" />
              </div>
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
