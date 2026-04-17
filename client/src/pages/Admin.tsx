import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Activity, UserPlus, Shield, Loader2, ArrowLeft, MessageSquare, Dumbbell, UserCheck, TrendingUp, Download, Mail, Target, CheckCircle2, Calendar, Star, AlertTriangle, Clock, CheckCircle, UserX, Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/lib/api";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface FocusGroupStats {
  guestMessageCount: number;
  totalSignups: number;
  waitlistUsers: number;
  activeUsers: number;
  avgMessagesPerUser: number;
}

interface WaitlistUser {
  id: string;
  email: string;
  firstName: string | null;
  emailVerified: boolean;
  createdAt: string | null;
}

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  premiumUsers: number;
  signupsThisMonth: number;
  signupsThisWeek: number;
  usersWithCompleteProfiles: number;
  totalMessages: number;
  totalFoodEntries: number;
  totalWorkoutLogs: number;
  messagesThisWeek: number;
  totalGoalsAssigned: number;
  goalsCompletedThisWeek: number;
  goalsCompletedThisMonth: number;
  activeGoals: number;
}

interface FeedbackStats {
  totalFeedback: number;
  averageRating: number;
  feedbackByCategory: { category: string; count: number }[];
  recentFeedback: { id: string; rating: number; category: string | null; comment: string | null; userEmail: string | null; status: string | null; createdAt: string | null }[];
  openFeedbackCount: number;
}

export default function Admin() {
  const { data: user } = useUser();
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data: isAdminData, isLoading: checkingAdmin } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
    queryFn: async () => {
      const res = await fetch("/api/admin/check", { credentials: "include" });
      if (!res.ok) return { isAdmin: false };
      return res.json();
    },
  });

  const { data: stats, isLoading: loadingStats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: isAdminData?.isAdmin === true,
  });

  const { data: feedbackStats } = useQuery<FeedbackStats>({
    queryKey: ["/api/admin/feedback"],
    queryFn: async () => {
      const res = await fetch("/api/admin/feedback", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch feedback");
      return res.json();
    },
    enabled: isAdminData?.isAdmin === true,
  });

  const { data: focusGroupStats } = useQuery<FocusGroupStats>({
    queryKey: ["/api/admin/focus-group-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/focus-group-stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch focus group stats");
      return res.json();
    },
    enabled: isAdminData?.isAdmin === true,
  });

  const { data: waitlistUsers, isLoading: loadingWaitlist } = useQuery<WaitlistUser[]>({
    queryKey: ["/api/admin/waitlist"],
    queryFn: async () => {
      const res = await fetch("/api/admin/waitlist", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch waitlist");
      return res.json();
    },
    enabled: isAdminData?.isAdmin === true,
  });

  const activateUser = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/admin/activate-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to activate user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/waitlist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/focus-group-stats"] });
      toast({ title: "User activated successfully", description: "Activation email has been sent." });
    },
    onError: () => {
      toast({ title: "Failed to activate user", variant: "destructive" });
    },
  });

  const updateFeedbackStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/admin/feedback/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      toast({ title: "Status updated" });
    },
  });

  if (checkingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdminData?.isAdmin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">You don't have permission to view this page.</p>
        <Button variant="outline" onClick={() => window.location.href = '/chat'}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.location.href = '/chat'}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
            <h1 className="text-3xl font-bold font-display text-white">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/10"
              disabled={isExporting}
              onClick={async () => {
                setIsExporting(true);
                try {
                  const response = await fetch('/api/admin/export-emails', { credentials: 'include' });
                  if (!response.ok) throw new Error('Export failed');
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `nutricore_users_${new Date().toISOString().split('T')[0]}.csv`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  console.error('Export failed:', error);
                } finally {
                  setIsExporting(false);
                }
              }}
              data-testid="button-export-emails"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Export Emails
            </Button>
            <Badge variant="outline" className="border-primary text-primary px-4 py-1">
              <Shield className="w-3 h-3 mr-1" />
              Admin View
            </Badge>
          </div>
        </div>

        {loadingStats ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.totalUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">All registered users</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
                  <Activity className="h-4 w-4 text-emerald-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.activeUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">Users with active accounts</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Profiles Complete</CardTitle>
                  <UserCheck className="h-4 w-4 text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.usersWithCompleteProfiles || 0}</div>
                  <p className="text-xs text-muted-foreground">Users with complete profiles</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
                  <UserPlus className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.signupsThisWeek || 0}</div>
                  <p className="text-xs text-muted-foreground">New signups this week</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle>
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.totalMessages || 0}</div>
                  <p className="text-xs text-muted-foreground">All AI chat messages</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Messages This Week</CardTitle>
                  <MessageSquare className="h-4 w-4 text-pink-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.messagesThisWeek || 0}</div>
                  <p className="text-xs text-muted-foreground">AI messages this week</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Workout Logs</CardTitle>
                  <Dumbbell className="h-4 w-4 text-red-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.totalWorkoutLogs || 0}</div>
                  <p className="text-xs text-muted-foreground">Total workouts logged</p>
                </CardContent>
              </Card>
            </div>

            {/* Goal Tracking Stats */}
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Goal Tracking
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Goals Assigned</CardTitle>
                  <Target className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.totalGoalsAssigned || 0}</div>
                  <p className="text-xs text-muted-foreground">AI-assigned goals</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Goals</CardTitle>
                  <Activity className="h-4 w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.activeGoals || 0}</div>
                  <p className="text-xs text-muted-foreground">Currently in progress</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completed This Week</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.goalsCompletedThisWeek || 0}</div>
                  <p className="text-xs text-muted-foreground">Weekly completions</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completed This Month</CardTitle>
                  <Calendar className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{stats?.goalsCompletedThisMonth || 0}</div>
                  <p className="text-xs text-muted-foreground">Monthly completions</p>
                </CardContent>
              </Card>
            </div>

            {/* Focus Group Management */}
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Focus Group Management
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Guest Messages</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{focusGroupStats?.guestMessageCount || 0}</div>
                  <p className="text-xs text-muted-foreground">From non-signed up users</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Signups</CardTitle>
                  <UserPlus className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{focusGroupStats?.totalSignups || 0}</div>
                  <p className="text-xs text-muted-foreground">Focus group registrations</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Waitlist</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{focusGroupStats?.waitlistUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">Pending activation</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{focusGroupStats?.activeUsers || 0}</div>
                  <p className="text-xs text-muted-foreground">Full access granted</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Messages</CardTitle>
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{focusGroupStats?.avgMessagesPerUser || 0}</div>
                  <p className="text-xs text-muted-foreground">Per signed up user</p>
                </CardContent>
              </Card>
            </div>

            {/* Waitlist Users Table */}
            {waitlistUsers && waitlistUsers.length > 0 && (
              <Card className="bg-card border-white/5">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    Waitlist Users ({waitlistUsers.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {waitlistUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="text-sm text-white font-medium">{user.firstName || 'No name'}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                          {user.emailVerified ? (
                            <Badge variant="outline" className="border-green-500/30 text-green-400 text-xs">Verified</Badge>
                          ) : (
                            <Badge variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs">Unverified</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : ''}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => activateUser.mutate(user.id)}
                            disabled={!user.emailVerified || activateUser.isPending}
                            className="bg-green-600 hover:bg-green-700 text-white"
                            data-testid={`button-activate-${user.id}`}
                          >
                            {activateUser.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* User Feedback Section */}
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              User Feedback (Focus Group)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Feedback</CardTitle>
                  <MessageSquare className="h-4 w-4 text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{feedbackStats?.totalFeedback || 0}</div>
                  <p className="text-xs text-muted-foreground">Feedback submissions</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
                  <Star className="h-4 w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white flex items-center gap-1">
                    {(feedbackStats?.averageRating || 0).toFixed(1)}
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  </div>
                  <p className="text-xs text-muted-foreground">Out of 5 stars</p>
                </CardContent>
              </Card>
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">By Category</CardTitle>
                  <Activity className="h-4 w-4 text-cyan-400" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {feedbackStats?.feedbackByCategory?.slice(0, 3).map((cat) => (
                      <div key={cat.category} className="flex justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{cat.category}</span>
                        <span className="text-white">{cat.count}</span>
                      </div>
                    )) || <p className="text-xs text-muted-foreground">No feedback yet</p>}
                  </div>
                </CardContent>
              </Card>
            </div>

            {feedbackStats?.recentFeedback && feedbackStats.recentFeedback.length > 0 && (
              <Card className="bg-card border-white/5">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-white text-sm">Recent Feedback</CardTitle>
                  {feedbackStats.openFeedbackCount > 0 && (
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {feedbackStats.openFeedbackCount} Open
                    </Badge>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {feedbackStats.recentFeedback.slice(0, 10).map((fb) => (
                      <div key={fb.id} className={`flex gap-3 p-3 rounded-lg ${fb.rating <= 2 ? 'bg-red-500/10 border border-red-500/30' : 'bg-white/5'}`}>
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3 h-3 ${star <= fb.rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                              />
                            ))}
                          </div>
                          {fb.rating <= 2 && (
                            <Badge variant="destructive" className="text-[10px] px-1">Urgent</Badge>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <Badge variant="outline" className="text-xs">{fb.category || 'general'}</Badge>
                            {fb.userEmail && (
                              <a href={`mailto:${fb.userEmail}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {fb.userEmail}
                              </a>
                            )}
                          </div>
                          {fb.comment && <p className="text-sm text-white/80 mb-2">{fb.comment}</p>}
                          <div className="flex items-center gap-2">
                            <Select
                              value={fb.status || 'open'}
                              onValueChange={(value) => updateFeedbackStatus.mutate({ id: fb.id, status: value })}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">
                                  <span className="flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                    Open
                                  </span>
                                </SelectItem>
                                <SelectItem value="in_progress">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-blue-500" />
                                    In Progress
                                  </span>
                                </SelectItem>
                                <SelectItem value="resolved">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-green-500" />
                                    Resolved
                                  </span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-xs text-muted-foreground">
                              {fb.createdAt ? new Date(fb.createdAt).toLocaleDateString() : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-card border-white/5">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Platform Health Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Profile Completion Rate</p>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-white">
                        {stats?.totalUsers ? Math.round((stats.usersWithCompleteProfiles / stats.totalUsers) * 100) : 0}%
                      </span>
                      <span className="text-xs text-muted-foreground pb-1">
                        ({stats?.usersWithCompleteProfiles || 0}/{stats?.totalUsers || 0} users)
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Avg Messages per User</p>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-white">
                        {stats?.totalUsers ? (stats.totalMessages / stats.totalUsers).toFixed(1) : 0}
                      </span>
                      <span className="text-xs text-muted-foreground pb-1">messages</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Premium Conversion</p>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-bold text-white">
                        {stats?.totalUsers ? Math.round((stats.premiumUsers / stats.totalUsers) * 100) : 0}%
                      </span>
                      <span className="text-xs text-muted-foreground pb-1">
                        ({stats?.premiumUsers || 0} premium users)
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-xs text-muted-foreground text-center">
                    All statistics are aggregated and anonymized to protect user privacy.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
