import { useRef, useEffect, useState, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Bot, 
  Sparkles, 
  Loader2, 
  Menu,
  Plus,
  Settings,
  LogOut,
  Dumbbell,
  Apple,
  Heart,
  Activity,
  ChevronRight,
  X,
  FileText,
  Paperclip,
  Check,
  Utensils,
  Flame,
  Clock,
  Trash2,
  CheckCircle2,
  Calendar,
  CalendarPlus,
  Lock,
  Target,
  MessageCircle,
  MessageSquare,
  User,
  Crown,
  Sun,
  Moon,
  Watch,
  Upload,
  BarChart3
} from "lucide-react";
import { PremiumIcon } from "@/components/ui/premium-icons";
import { Logo } from "@/components/Logo";
import { useChatMessages, useSendMessage, useUser, useCreateScheduledWorkout, useMessageQuota, useActiveGoals, useGoalStats, useCompleteGoal } from "@/lib/api";
import { analytics } from "@/lib/analytics";
import { Link } from "wouter";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ObjectUploader } from "@/components/ObjectUploader";
import { MultiPhotoUploader, PhotoPreviewBar, type UploadedPhoto } from "@/components/MultiPhotoUploader";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AdBanner } from "@/components/AdBanner";
import { FeedbackButton } from "@/components/FeedbackButton";
import { IOSInstallBanner } from "@/components/IOSInstallBanner";
import { getUserState, getPermissions, USER_STATES, hasFullAccess, getTrialDaysRemaining } from "@shared/permissions";
import { PRICING } from "@shared/pricing";

const workoutTemplates = [
  {
    name: "Strength Training",
    activityType: "strength_training",
    duration: 50,
    calories: 320,
    exercises: [
      { name: "Squats", sets: 4, reps: 10, weight: 0, completed: false },
      { name: "Push-ups", sets: 3, reps: 15, weight: 0, completed: false },
      { name: "Rows", sets: 3, reps: 12, weight: 0, completed: false },
      { name: "Lunges", sets: 3, reps: 12, weight: 0, completed: false },
      { name: "Plank", sets: 3, reps: 60, weight: 0, completed: false },
    ],
  },
  {
    name: "Running",
    activityType: "running",
    duration: 30,
    calories: 350,
    distance: 5, // km
  },
];

type WorkoutExercise = {
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  completed: boolean;
};

type WorkoutLog = {
  id: string;
  workoutName: string;
  activityType?: string;
  date: string;
  duration: number;
  caloriesBurned: number;
  distance?: number;
  exercises: WorkoutExercise[];
  completed: boolean;
  notes?: string;
  source?: string;
};


type WorkoutPlan = {
  title: string;
  workoutType: string;
  duration: number;
  intensity: string;
  description?: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: string;
    load?: string;
    rest?: string;
    notes?: string;
  }>;
};

type AgentAction = {
  type: 'workout_log' | 'body_metric' | 'schedule_workout' | 'update_goal' | 'update_profile';
  data: any;
  summary: string;
};

type WorkoutLogAction = {
  workoutName: string;
  activityType?: string;
  duration: number;
  caloriesBurned: number;
  distance?: number;
  exercises?: Array<{ name: string; sets: number; reps: number; weight?: number }>;
  notes?: string;
};

type BodyMetricAction = {
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
};

type UpdateGoalAction = {
  dailyCalorieGoal?: number;
  dailyProteinGoal?: number;
  dailyCarbsGoal?: number;
  dailyFatsGoal?: number;
  targetWeight?: number;
};

function parseAgentActions(content: string): { text: string; actions: AgentAction[] } {
  const actionRegex = /```agent_action\s*([\s\S]*?)```/g;
  const actions: AgentAction[] = [];
  let cleanedContent = content;
  
  let match;
  while ((match = actionRegex.exec(content)) !== null) {
    try {
      const action = JSON.parse(match[1].trim());
      if (action.type && action.data && action.summary) {
        actions.push(action);
      }
    } catch (e) {
      console.error("Failed to parse agent action:", e);
    }
  }
  
  cleanedContent = content.replace(/```agent_action\s*([\s\S]*?)```/g, '').trim();
  return { text: cleanedContent, actions };
}

function parseWorkoutPlan(content: string): { text: string; workoutPlan: WorkoutPlan | null } {
  const workoutPlanRegex = /```workout_plan\s*([\s\S]*?)```/;
  const match = content.match(workoutPlanRegex);
  
  if (match) {
    try {
      const workoutPlan = JSON.parse(match[1].trim());
      const textWithoutPlan = content.replace(workoutPlanRegex, '').trim();
      return { text: textWithoutPlan, workoutPlan };
    } catch (e) {
      return { text: content, workoutPlan: null };
    }
  }
  
  return { text: content, workoutPlan: null };
}

export default function Chat() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  
  // Track page view
  useEffect(() => {
    analytics.trackPageView('chat');
  }, []);
  
  const { data: messages = [], isLoading } = useChatMessages(activeConversationId);
  const { data: user, refetch: refetchUser } = useUser();
  const { data: messageQuota } = useMessageQuota();
  const { data: activeGoals } = useActiveGoals();
  const { data: goalStats } = useGoalStats();
  const completeGoalMutation = useCompleteGoal();
  const sendMessage = useSendMessage(activeConversationId);
  
  const createScheduledWorkout = useCreateScheduledWorkout();
  const [input, setInput] = useState("");
  const [scheduledPlans, setScheduledPlans] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<UploadedPhoto[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [demoApplied, setDemoApplied] = useState(false);

  // Apply demo code if present and user is logged in but not yet a demo user
  useEffect(() => {
    const applyDemoCode = async () => {
      if (!user || demoApplied) return;
      
      const storedDemoCode = localStorage.getItem('nutricore_demo_code');
      if (!storedDemoCode) return;
      
      // Check if user already has full access
      if (hasFullAccess(user)) {
        localStorage.removeItem('nutricore_demo_code');
        return;
      }
      
      try {
        const res = await fetch('/api/demo/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ demoCode: storedDemoCode }),
        });
        
        if (res.ok) {
          const data = await res.json();
          localStorage.removeItem('nutricore_demo_code');
          setDemoApplied(true);
          refetchUser();
          
          // Only show toast if not already applied
          if (!data.alreadyApplied) {
            toast({
              title: "Demo Access Activated!",
              description: "You now have full premium access for the demo period.",
            });
          }
        } else {
          // Invalid code, remove it
          localStorage.removeItem('nutricore_demo_code');
        }
      } catch (error) {
        console.error('Error applying demo code:', error);
      }
    };
    
    applyDemoCode();
  }, [user, demoApplied, refetchUser, toast]);

  const [workoutForm, setWorkoutForm] = useState({
    workoutName: "",
    duration: 30,
    caloriesBurned: 0,
    exercises: [] as WorkoutExercise[],
    notes: "",
  });
  const [newExercise, setNewExercise] = useState({ name: "", sets: 3, reps: 10, weight: 0, completed: false });
  const [editingWorkout, setEditingWorkout] = useState<string | null>(null);

  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set());

  const executeAction = useMutation({
    mutationFn: async ({ action, messageId }: { action: AgentAction; messageId: string }) => {
      const res = await fetch("/api/agent/execute-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actionType: action.type, actionData: action.data }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to execute action");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      const actionKey = `${variables.messageId}-${variables.action.type}-${JSON.stringify(variables.action.data)}`;
      setExecutedActions(prev => new Set(prev).add(actionKey));
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/goals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/health-metrics"] });
      if (variables.action.type === 'update_profile') {
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        toast({
          title: "Profile Saved!",
          description: "Welcome! Your profile has been set up successfully.",
        });
      } else {
        toast({
          title: "Done!",
          description: variables.action.summary,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: workoutLogs = [] } = useQuery<WorkoutLog[]>({
    queryKey: ["/api/workout-logs"],
    queryFn: async () => {
      const res = await fetch("/api/workout-logs", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });


  const createWorkoutLog = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/workout-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create workout log");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({ title: "Workout logged!", description: "Keep up the great work!" });
      setShowWorkoutModal(false);
      resetWorkoutForm();
    },
  });

  const updateWorkoutLog = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/workout-logs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({ title: "Workout updated!" });
      setEditingWorkout(null);
    },
  });

  const deleteWorkoutLog = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/workout-logs/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete workout");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workout-logs"] });
      toast({ title: "Workout deleted" });
    },
  });


  const loadWorkoutTemplate = (template: typeof workoutTemplates[0]) => {
    setWorkoutForm({
      workoutName: template.name,
      duration: template.duration,
      caloriesBurned: template.calories,
      exercises: template.exercises?.map(ex => ({ ...ex })) || [],
      notes: "",
    });
    toast({ title: "Template loaded!", description: `${template.name} template applied` });
  };

  const resetWorkoutForm = () => {
    setWorkoutForm({ workoutName: "", duration: 30, caloriesBurned: 0, exercises: [], notes: "" });
    setNewExercise({ name: "", sets: 3, reps: 10, weight: 0, completed: false });
  };

  const addExercise = () => {
    if (!newExercise.name) return;
    setWorkoutForm(prev => ({
      ...prev,
      exercises: [...prev.exercises, { ...newExercise }],
    }));
    setNewExercise({ name: "", sets: 3, reps: 10, weight: 0, completed: false });
  };

  const toggleExerciseComplete = (index: number) => {
    setWorkoutForm(prev => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => 
        i === index ? { ...ex, completed: !ex.completed } : ex
      ),
    }));
  };

  const removeExercise = (index: number) => {
    setWorkoutForm(prev => ({
      ...prev,
      exercises: prev.exercises.filter((_, i) => i !== index),
    }));
  };

  const handleLogWorkout = () => {
    if (!workoutForm.workoutName) {
      toast({ title: "Please enter a workout name", variant: "destructive" });
      return;
    }
    createWorkoutLog.mutate({
      workoutName: workoutForm.workoutName,
      duration: workoutForm.duration,
      caloriesBurned: workoutForm.caloriesBurned,
      exercises: workoutForm.exercises,
      notes: workoutForm.notes,
      completed: workoutForm.exercises.every(ex => ex.completed),
    });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-trigger onboarding for users who need goal/activity level collected
  const [onboardingTriggered, setOnboardingTriggered] = useState(false);
  const [pendingCoachIntro, setPendingCoachIntro] = useState(false);

  // Step 1: when user has no conversations, create one directly via fetch (avoids TDZ on createConversation)
  useEffect(() => {
    if (user && conversationsLoaded && conversationsList.length === 0 && !onboardingTriggered) {
      setOnboardingTriggered(true);
      setPendingCoachIntro(true);
      fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
        credentials: "include",
      })
        .then(r => r.json())
        .then(newConvo => {
          if (newConvo?.id) setActiveConversationId(newConvo.id);
        })
        .catch(() => setPendingCoachIntro(false));
    }
  }, [user, conversationsLoaded, conversationsList.length, onboardingTriggered]);

  // Step 2: once conversation is ready, send the intro
  useEffect(() => {
    if (pendingCoachIntro && activeConversationId && !sendMessage.isPending) {
      setPendingCoachIntro(false);
      sendMessage.mutate("__coach_intro__");
    }
  }, [pendingCoachIntro, activeConversationId, sendMessage.isPending]);

  const handleSend = async () => {
    const uploadedPhotoUrls = pendingPhotos
      .filter(p => p.status === 'uploaded' && p.uploadUrl)
      .map(p => p.uploadUrl!);
    
    if (!input.trim() && uploadedPhotoUrls.length === 0) return;
    if (isStreaming) return;
    
    if (!messageQuota?.unlimited && messageQuota?.remaining === 0) {
      setShowLimitModal(true);
      return;
    }
    
    const messageText = input;
    setInput("");
    setPendingPhotos([]);
    setIsStreaming(true);
    setStreamingContent("");
    
    try {
      // Set a timeout for the entire request (60 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          content: messageText, 
          conversationId: activeConversationId,
          imageUrls: uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : undefined,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('nutricore_user_cache');
          localStorage.removeItem('nutricore_session_active');
          toast({
            title: "Session Expired",
            description: "Please sign in again to continue.",
            variant: "destructive",
          });
          setTimeout(() => {
            window.location.href = '/api/login';
          }, 1500);
          return;
        }
        const errorText = await response.text();
        console.error('[Chat] Response error:', response.status, errorText);
        throw new Error('Failed to send message');
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        console.error('[Chat] No response body from server');
        throw new Error('No response body');
      }
      
      let buffer = '';
      let receivedDone = false;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        
        for (const event of events) {
          const lines = event.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'user_message') {
                  queryClient.setQueryData<any[]>(
                    ["/api/chat/messages", activeConversationId],
                    (old) => [...(old || []), data.message]
                  );
                } else if (data.type === 'chunk') {
                  setStreamingContent(prev => prev + data.content);
                } else if (data.type === 'done') {
                  receivedDone = true;
                  setStreamingContent("");
                  queryClient.setQueryData<any[]>(
                    ["/api/chat/messages", activeConversationId],
                    (old) => [...(old || []), data.message]
                  );
                  queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", activeConversationId] });
                  queryClient.invalidateQueries({ queryKey: ["/api/message-quota"] });
                  
                  // If AI performed actions, invalidate related data across all pages
                  if (data.actions && data.actions.length > 0) {
                    // Invalidate ALL scheduled workout queries (covers Home, Plans, Activities)
                    queryClient.invalidateQueries({ predicate: (query) => {
                      const key = query.queryKey;
                      return Array.isArray(key) && (
                        (typeof key[0] === 'string' && key[0].includes('scheduled-workouts')) ||
                        (typeof key[0] === 'string' && key[0].includes('workout'))
                      );
                    }});
                    // Also invalidate progress stats
                    queryClient.invalidateQueries({ queryKey: ["/api/user/progress-stats"] });
                  }
                } else if (data.type === 'error') {
                  console.error('[Chat] Server error:', data.message);
                  throw new Error(data.message);
                }
              } catch (parseError: any) {
                // Only log if it's not a JSON parse error (those are expected for incomplete chunks)
                if (parseError.name !== 'SyntaxError') {
                  console.error('[Chat] Parse/processing error:', parseError);
                  throw parseError;
                }
              }
            }
          }
        }
      }
      
      // If stream ended without receiving 'done', refresh messages from server
      if (!receivedDone) {
        console.warn('[Chat] Stream ended without done event, refreshing messages...');
        queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", activeConversationId] });
      }
    } catch (error: any) {
      // Handle abort error (timeout)
      if (error.name === 'AbortError') {
        console.error('[Chat] Request timed out');
        toast({
          title: "Request Timeout",
          description: "The trainer is taking too long to respond. Please try again.",
          variant: "destructive",
        });
        // Refresh messages in case something was saved
        queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", activeConversationId] });
        return;
      }
      console.error('[Chat] Error:', error);
      if (error?.message?.includes("monthly message limit")) {
        setShowLimitModal(true);
      } else {
        toast({
          title: "Error",
          description: error?.message || "Failed to send message",
          variant: "destructive",
        });
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const createDocumentMutation = useMutation({
    mutationFn: async ({ fileName, fileType, uploadURL }: { fileName: string; fileType: string; uploadURL: string }) => {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, fileType, uploadURL }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to save document');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      toast({
        title: "Blood test uploaded!",
        description: "Your document has been saved. Ask me to analyze it!",
      });
      setInput("Can you analyze my blood test results I just uploaded?");
    },
  });

  const handleGetUploadParameters = async () => {
    const res = await fetch('/api/documents/upload-url', {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || 'Failed to get upload URL');
    }
    const { uploadURL } = await res.json();
    return {
      method: 'PUT' as const,
      url: uploadURL,
    };
  };

  const handleGetPhotoUploadParameters = async () => {
    const res = await fetch('/api/uploads/request-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `photo-${Date.now()}.jpg`, contentType: 'image/jpeg' }),
      credentials: 'include',
    });
    if (!res.ok) {
      throw new Error('Failed to get upload URL');
    }
    const { uploadURL } = await res.json();
    return {
      method: 'PUT' as const,
      url: uploadURL,
    };
  };

  const handleUploadComplete = async (result: any) => {
    const successfulUpload = result.successful?.[0];
    if (successfulUpload) {
      await createDocumentMutation.mutateAsync({
        fileName: successfulUpload.name || 'document',
        fileType: successfulUpload.type || 'application/octet-stream',
        uploadURL: successfulUpload.uploadURL,
      });
    }
  };

  const suggestedPrompts = (() => {
    const goal = user?.fitnessGoal ?? "";

    const byGoal: Record<string, { icon: any; text: string; color: string }[]> = {
      weight_loss: [
        { icon: Flame, text: "Build me a fat-loss training plan", color: "text-orange-400" },
        { icon: Utensils, text: "What should I eat on rest days to lose fat?", color: "text-emerald-400" },
        { icon: Activity, text: "Best cardio for fat loss without losing muscle", color: "text-blue-400" },
        { icon: Dumbbell, text: "How do I track my progress effectively?", color: "text-purple-400" },
      ],
      muscle_gain: [
        { icon: Dumbbell, text: "Create a hypertrophy training plan for me", color: "text-orange-400" },
        { icon: Utensils, text: "How much protein do I need to build muscle?", color: "text-emerald-400" },
        { icon: Heart, text: "Best recovery routine for muscle growth", color: "text-blue-400" },
        { icon: Activity, text: "Progressive overload — how should I apply it?", color: "text-purple-400" },
      ],
      performance: [
        { icon: Activity, text: "Design a performance training block for me", color: "text-emerald-400" },
        { icon: Dumbbell, text: "How do I peak for competition?", color: "text-orange-400" },
        { icon: Heart, text: "Best warmup protocol for athletic performance", color: "text-blue-400" },
        { icon: Utensils, text: "Pre-competition nutrition strategy", color: "text-purple-400" },
      ],
      endurance: [
        { icon: Activity, text: "Build me an endurance training plan", color: "text-emerald-400" },
        { icon: Heart, text: "How do I improve my aerobic base?", color: "text-blue-400" },
        { icon: Utensils, text: "What to eat during long training sessions?", color: "text-orange-400" },
        { icon: Dumbbell, text: "Strength training for endurance athletes", color: "text-purple-400" },
      ],
      recomposition: [
        { icon: Dumbbell, text: "Build me a recomposition training plan", color: "text-orange-400" },
        { icon: Utensils, text: "How to eat for muscle gain and fat loss together?", color: "text-emerald-400" },
        { icon: Activity, text: "How do I track body composition changes?", color: "text-blue-400" },
        { icon: Heart, text: "Optimal recovery for body recomposition", color: "text-purple-400" },
      ],
    };

    return byGoal[goal] ?? [
      { icon: Activity, text: "Help me train for a 5K run", color: "text-emerald-400" },
      { icon: Dumbbell, text: "Create a strength training plan", color: "text-orange-400" },
      { icon: Heart, text: "Best warmup before lifting weights", color: "text-blue-400" },
      { icon: Activity, text: "Create a weekly training schedule", color: "text-purple-400" },
    ];
  })();

  const [showPlusMenu, setShowPlusMenu] = useState(false);

  const { data: conversationsList = [], isSuccess: conversationsLoaded } = useQuery<{ id: string; title: string; createdAt: string }[]>({
    queryKey: ["/api/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createConversation = useMutation({
    mutationFn: async (title?: string) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title || "New Chat" }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (newConvo) => {
      setActiveConversationId(newConvo.id);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", newConvo.id] });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return res.json();
    },
    onSuccess: () => {
      setActiveConversationId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", null] });
    },
  });

  const handleNewChat = () => {
    createConversation.mutate("New Chat");
  };

  const userState = getUserState(user);
  const permissions = getPermissions(user);
  const isExpiredUser = userState === USER_STATES.EXPIRED;
  const hasAccess = hasFullAccess(user);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Expired User Banner - calm, minimal messaging */}
      {isExpiredUser && (
        <div className="bg-card border-b border-white/5 px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">
              Your access has been paused. Subscribe to continue with full coaching features.
            </span>
            <Link href="/profile">
              <Button variant="outline" size="sm" className="whitespace-nowrap">
                View Options
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Hamburger Menu Drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-card border-white/5">
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-6 border-b border-white/5">
              <Logo size="sm" />
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-6 space-y-1.5">
              <button
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-left bg-primary/10 text-primary"
                onClick={() => setSidebarOpen(false)}
                data-testid="nav-ai-trainer"
              >
                <PremiumIcon variant="chat" size="sm" />
                <span className="font-medium text-sm">My Trainer</span>
              </button>
              <Link 
                href="/tracker"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-left text-muted-foreground hover:bg-white/5 hover:text-foreground"
                onClick={() => setSidebarOpen(false)}
                data-testid="nav-daily-tracker"
              >
                <PremiumIcon variant="tracker" size="sm" />
                <span className="font-medium text-sm">Daily Tracker</span>
              </Link>
              <Link 
                href="/profile"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-left text-muted-foreground hover:bg-white/5 hover:text-foreground"
                onClick={() => setSidebarOpen(false)}
                data-testid="nav-profile"
              >
                <PremiumIcon variant="profile" size="sm" />
                <span className="font-medium text-sm">Profile</span>
              </Link>
              {user?.email?.toLowerCase() === 'maalkooheji@gmail.com' && (
                <Link 
                  href="/admin"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-left text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  onClick={() => setSidebarOpen(false)}
                  data-testid="nav-admin"
                >
                  <BarChart3 className="w-5 h-5 text-gold" />
                  <span className="font-medium text-sm">Admin Dashboard</span>
                </Link>
              )}
            </nav>

            {/* Conversations Section - Active Users */}
            {hasAccess && (
              <div className="px-3 py-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chats</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      handleNewChat();
                      setSidebarOpen(false);
                    }}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    data-testid="button-new-conversation"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {conversationsList.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-2 py-2">No conversations yet</p>
                    ) : (
                      conversationsList.map((convo) => (
                        <div
                          key={convo.id}
                          className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
                            activeConversationId === convo.id
                              ? 'bg-primary/10 text-foreground'
                              : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                          }`}
                          onClick={() => {
                            setActiveConversationId(convo.id);
                            setSidebarOpen(false);
                          }}
                          data-testid={`conversation-${convo.id}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="text-sm truncate flex-1">{convo.title}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteConversation.mutate(convo.id);
                            }}
                            data-testid={`delete-conversation-${convo.id}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex-1" />

            {/* Active Goals Section */}
            {activeGoals && activeGoals.length > 0 && (
              <div className="px-3 py-4 border-t border-white/5">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Your Goals</span>
                  <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">
                    {goalStats?.active || 0} Active
                  </Badge>
                </div>
                <ScrollArea className="max-h-32">
                  <div className="space-y-2">
                    {activeGoals.slice(0, 3).map((goal) => {
                      const progress = goal.targetValue && goal.currentValue 
                        ? Math.round((goal.currentValue / goal.targetValue) * 100)
                        : 0;
                      const endDate = new Date(goal.endDate);
                      const daysLeft = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      
                      return (
                        <div key={goal.id} className="px-2 py-2 bg-white/5 rounded-lg" data-testid={`goal-${goal.id}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="w-3 h-3 text-primary" />
                            <span className="text-xs font-medium truncate flex-1">{goal.title}</span>
                            <Badge variant="outline" className="text-[8px] px-1.5 py-0">
                              {goal.goalType === 'weekly' ? '7d' : '30d'}
                            </Badge>
                          </div>
                          {goal.targetValue && (
                            <div className="mt-1.5">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] text-muted-foreground">
                                  {goal.currentValue || 0}/{goal.targetValue} {goal.unit}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {daysLeft > 0 ? `${daysLeft}d left` : 'Due'}
                                </span>
                              </div>
                              <Progress value={progress} className="h-1" />
                            </div>
                          )}
                          {!goal.targetValue && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-primary hover:bg-primary/20 w-full mt-1"
                              onClick={() => completeGoalMutation.mutate(goal.id)}
                              data-testid={`complete-goal-${goal.id}`}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Mark Complete
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                {goalStats && goalStats.completed > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-2 px-2">
                    {goalStats.completed} goals completed
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-white/5 space-y-2">
                <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
                data-testid="button-logout"
                onClick={() => {
                  window.location.href = "/api/logout";
                }}
              >
                <PremiumIcon variant="logout" size="xs" />
                <span className="text-sm font-medium">Sign Out</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Top Header - ChatGPT Style */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-background">
        {/* Left: Hamburger Menu */}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSidebarOpen(true)} 
          className="rounded-lg h-10 w-10" 
          data-testid="button-menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        {/* Center: Logo */}
        <Logo size="sm" />

        {/* Right: New Chat + User Avatar */}
        <div className="flex items-center gap-2">
          {hasAccess && messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNewChat}
              className="h-8 px-3 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              data-testid="button-new-chat"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              New Chat
            </Button>
          )}
          <Link href="/profile" className="block" data-testid="link-user-profile">
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
            )}
          </Link>
        </div>
      </header>

        {/* Chat Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-8">
            {isLoading ? (
              <div className="flex items-center justify-center h-[60vh]">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto premium-glow">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                  <p className="text-muted-foreground">Loading your conversation...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[65vh] text-center relative">
                {/* Hero Logo */}
                <div className="mb-12">
                  <Logo size="lg" />
                </div>
                
                {/* Welcome Section - Premium Typography */}
                <div className="mb-10 max-w-xl mx-auto px-4">
                  <h1 className="text-3xl md:text-4xl font-display headline-luxury mb-4">
                    Elite AI Coaching
                  </h1>
                  <p className="subhead-luxury text-lg max-w-md mx-auto leading-relaxed">
                    Personalized training and nutrition guidance powered by sports science.
                  </p>
                </div>

                {/* Suggested Prompts - Premium Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl relative z-10">
                  {suggestedPrompts.map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(prompt.text)}
                      className="flex items-center gap-4 p-5 rounded-2xl glass-premium text-left hover:border-[#D4AF37]/30 transition-all duration-300 group hover-lift"
                      data-testid={`prompt-suggestion-${i}`}
                    >
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center ${prompt.color} group-hover:scale-105 transition-transform`}>
                        <prompt.icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-[#999999] group-hover:text-[#F2F2F2] transition-colors">
                        {prompt.text}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                <AnimatePresence initial={false}>
                {messages.filter(msg => !(msg.role === "user" && msg.content === "__coach_intro__")).map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.25,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    data-testid={`message-${msg.role}-${msg.id}`}
                  >
                    {/* Message Content - No Avatars */}
                    <div className={`max-w-[85%]`}>
                      {(() => {
                        const { text: workoutText, workoutPlan } = msg.role === "assistant" 
                          ? parseWorkoutPlan(msg.content) 
                          : { text: msg.content, workoutPlan: null };
                        const { text, actions } = msg.role === "assistant" 
                          ? parseAgentActions(workoutText) 
                          : { text: workoutText, actions: [] };
                        const isScheduled = scheduledPlans.has(msg.id);
                        
                        const messageImages = (msg as any).imageUrls as string[] | null;
                        
                        return (
                          <div className="space-y-3">
                            {/* Display uploaded images for user messages */}
                            {msg.role === "user" && messageImages && messageImages.length > 0 && (
                              <div className="flex flex-wrap gap-2 justify-end" data-testid={`message-images-${msg.id}`}>
                                {messageImages.map((imageUrl, imgIdx) => (
                                  <div 
                                    key={imgIdx}
                                    className="relative w-24 h-24 rounded-lg overflow-hidden border border-white/10"
                                  >
                                    <img
                                      src={imageUrl}
                                      alt={`Uploaded image ${imgIdx + 1}`}
                                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() => window.open(imageUrl, '_blank')}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div
                              className={`inline-block px-5 py-4 text-[15px] leading-relaxed ${
                                msg.role === "user"
                                  ? "bubble-user rounded-[20px] rounded-br-md"
                                  : "bubble-ai rounded-[20px] rounded-bl-md"
                              }`}
                            >
                              <div className="whitespace-pre-wrap prose prose-sm prose-invert max-w-none">
                                                <ReactMarkdown
                                                  components={{
                                                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                    strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
                                                    em: ({ children }) => <em className="italic">{children}</em>,
                                                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                                                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                                                    li: ({ children }) => <li className="mb-1">{children}</li>,
                                                  }}
                                                >
                                                  {text}
                                                </ReactMarkdown>
                                              </div>
                            </div>
                            
                            {/* Agent Action Buttons */}
                            {actions.length > 0 && (
                              <div className="space-y-2">
                                {actions.map((action, idx) => {
                                  const actionKey = `${msg.id}-${action.type}-${JSON.stringify(action.data)}`;
                                  const isExecuted = executedActions.has(actionKey);
                                  const actionIcon = action.type === 'workout_log' ? Dumbbell
                                    : action.type === 'body_metric' ? Activity
                                    : Target;
                                  const ActionIcon = actionIcon;
                                  
                                  return (
                                    <div 
                                      key={idx}
                                      className="bg-card border border-primary/30 rounded-xl p-3 flex items-center justify-between gap-3"
                                      data-testid={`agent-action-${msg.id}-${idx}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                          <ActionIcon className="w-5 h-5 text-primary" />
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium text-white">{action.summary}</p>
                                          <p className="text-xs text-muted-foreground capitalize">{action.type.replace('_', ' ')}</p>
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        onClick={() => executeAction.mutate({ action, messageId: msg.id })}
                                        disabled={isExecuted || executeAction.isPending}
                                        className={isExecuted ? 'bg-green-500/20 text-green-400' : 'gradient-primary'}
                                        data-testid={`button-approve-action-${msg.id}-${idx}`}
                                      >
                                        {isExecuted ? (
                                          <>
                                            <Check className="w-4 h-4 mr-1" />
                                            Done
                                          </>
                                        ) : executeAction.isPending ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <>
                                            <Check className="w-4 h-4 mr-1" />
                                            Approve
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            
                            {workoutPlan && (
                              <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-4" data-testid={`workout-plan-${msg.id}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Dumbbell className="w-5 h-5 text-primary" />
                                    <h4 className="font-bold text-white">{workoutPlan.title}</h4>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="w-3 h-3" />
                                    <span>{workoutPlan.duration}min</span>
                                    <Flame className="w-3 h-3 ml-2" />
                                    <span className="capitalize">{workoutPlan.intensity}</span>
                                  </div>
                                </div>
                                
                                {workoutPlan.description && (
                                  <p className="text-sm text-muted-foreground">{workoutPlan.description}</p>
                                )}
                                
                                <div className="space-y-2">
                                  {workoutPlan.exercises.map((ex, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2 text-sm">
                                      <span className="text-white font-medium">{ex.name}</span>
                                      <div className="flex items-center gap-3 text-muted-foreground">
                                        <span>{ex.sets} x {ex.reps}</span>
                                        {ex.load && (
                                          <span className="text-primary font-semibold">{ex.load}</span>
                                        )}
                                        {ex.rest && (
                                          <span className="text-xs text-muted-foreground/70">({ex.rest})</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                
                                <Button
                                  onClick={() => {
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    createScheduledWorkout.mutate({
                                      title: workoutPlan.title,
                                      workoutType: workoutPlan.workoutType || "Custom",
                                      scheduledDate: tomorrow,
                                      duration: workoutPlan.duration,
                                      intensity: workoutPlan.intensity,
                                      description: workoutPlan.description,
                                      exercises: workoutPlan.exercises,
                                      status: "scheduled",
                                      aiGenerated: true,
                                    }, {
                                      onSuccess: () => {
                                        setScheduledPlans(prev => new Set(Array.from(prev).concat(msg.id)));
                                        toast({
                                          title: "Workout added to schedule!",
                                          description: `"${workoutPlan.title}" has been added to your weekly planner.`,
                                        });
                                      }
                                    });
                                  }}
                                  disabled={isScheduled || createScheduledWorkout.isPending}
                                  className={`w-full ${isScheduled ? 'bg-green-500/20 text-green-400' : 'gradient-primary'}`}
                                  data-testid={`button-schedule-plan-${msg.id}`}
                                >
                                  {isScheduled ? (
                                    <>
                                      <CheckCircle2 className="w-4 h-4 mr-2" />
                                      Added to Schedule
                                    </>
                                  ) : createScheduledWorkout.isPending ? (
                                    <>
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                      Adding...
                                    </>
                                  ) : (
                                    <>
                                      <CalendarPlus className="w-4 h-4 mr-2" />
                                      Add to Schedule
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                ))}
                </AnimatePresence>
                
                {/* AI Streaming Response */}
                <AnimatePresence>
                {isStreaming && (
                  <motion.div 
                    className="flex justify-start"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="bubble-ai px-5 py-4 rounded-[20px] rounded-bl-md max-w-[85%]">
                      {streamingContent ? (
                        <div className="prose prose-invert prose-sm max-w-none text-[15px] leading-relaxed">
                          {streamingContent}
                          <span className="inline-block w-2 h-4 bg-[#D4A84B] ml-1 animate-pulse" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1.5">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area - Premium Luxury Style */}
        <div className="border-t border-border bg-background p-4">
          <div className="max-w-[750px] mx-auto">
            {/* Photo Preview Bar */}
            {pendingPhotos.length > 0 && (
              <div className="mb-2 bg-white/5 rounded-xl border border-white/10">
                <PhotoPreviewBar 
                  photos={pendingPhotos} 
                  onRemove={(id) => setPendingPhotos(prev => prev.filter(p => p.id !== id))} 
                />
              </div>
            )}
            
            <div className="flex items-center gap-3">
              {/* Plus Button with Popover */}
              <div className="relative">
                <Button
                  data-testid="button-plus-menu"
                  onClick={() => setShowPlusMenu(!showPlusMenu)}
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </Button>
                
                {/* Plus Menu Popover */}
                {showPlusMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowPlusMenu(false)}
                    />
                    <div className="absolute bottom-14 left-0 z-50 w-64 rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl p-3 space-y-1">
                      <button
                        onClick={() => {
                          setShowPlusMenu(false);
                          if (hasAccess) {
                            setShowWorkoutModal(true);
                          } else {
                            setShowUpgradeModal(true);
                          }
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition-all duration-200 group"
                        data-testid="plus-menu-workout"
                      >
                        <PremiumIcon variant="workout" size="sm" />
                        <span className="flex-1 text-left">Log Activity</span>
                        {!hasAccess && <Lock className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      {hasAccess ? (
                        <ObjectUploader
                          onGetUploadParameters={handleGetUploadParameters}
                          onComplete={(result) => {
                            setShowPlusMenu(false);
                            handleUploadComplete(result);
                          }}
                          buttonClassName="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition-all duration-200 group text-left"
                        >
                          <PremiumIcon variant="upload" size="sm" />
                          <span className="flex-1 text-left">Upload Document</span>
                        </ObjectUploader>
                      ) : (
                        <button
                          onClick={() => {
                            setShowPlusMenu(false);
                            setShowUpgradeModal(true);
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition-all duration-200 group"
                          data-testid="plus-menu-upload"
                        >
                          <PremiumIcon variant="upload" size="sm" />
                          <span className="flex-1 text-left">Upload Document</span>
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                      <div className="border-t border-white/5 my-2" />
                      <button
                        onClick={() => {
                          setShowPlusMenu(false);
                          if (hasAccess) {
                            window.location.href = '/devices';
                          } else {
                            setShowUpgradeModal(true);
                          }
                        }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-white/5 transition-all duration-200 group"
                        data-testid="plus-menu-smartwatch"
                      >
                        <PremiumIcon variant="watch" size="sm" />
                        <span className="flex-1 text-left">Smartwatches</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        {!hasAccess && <Lock className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Photo Upload Button */}
              {hasAccess && (
                <MultiPhotoUploader
                  onGetUploadParameters={handleGetPhotoUploadParameters}
                  photos={pendingPhotos}
                  setPhotos={setPendingPhotos}
                  disabled={isStreaming}
                />
              )}

              {/* Input Field - Premium Slim Design with Ambient Glow */}
              <div className="flex-1 ambient-glow">
                <div className="input-luxury rounded-2xl">
                  <Input
                    data-testid="input-message"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    placeholder={pendingPhotos.length > 0 ? "Add a message about your photos..." : "Ask your coach..."}
                    className="w-full h-12 bg-transparent border-0 rounded-2xl px-5 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px]"
                    disabled={isStreaming}
                  />
                </div>
              </div>
              
              {/* Send Button - Premium Gold Accent */}
              <Button 
                data-testid="button-send"
                onClick={handleSend} 
                size="icon" 
                className="h-11 w-11 rounded-xl send-btn-luxury text-[#0A0A0A] disabled:opacity-50"
                disabled={isStreaming || (!input.trim() && pendingPhotos.filter(p => p.status === 'uploaded').length === 0)}
              >
                {isStreaming 
                  ? <Loader2 className="w-4 h-4 animate-spin" /> 
                  : <Send className="w-4 h-4" />
                }
              </Button>
            </div>
          </div>
        </div>

      {/* Workout Logging Modal */}
      <Dialog open={showWorkoutModal} onOpenChange={setShowWorkoutModal}>
        <DialogContent className="sm:max-w-lg bg-card border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Dumbbell className="w-5 h-5 text-primary" />
              Log Workout
            </DialogTitle>
            <DialogDescription>
              Track your exercises and mark them as complete
            </DialogDescription>
          </DialogHeader>
          
          {/* Quick Templates */}
          <div className="mt-4 mb-2">
            <p className="text-xs text-muted-foreground mb-2">Quick Templates:</p>
            <div className="flex flex-wrap gap-2">
              {workoutTemplates.map((template) => (
                <Button
                  key={template.name}
                  variant="outline"
                  size="sm"
                  onClick={() => loadWorkoutTemplate(template)}
                  className="text-xs h-7 bg-white/5 border-white/10 hover:bg-primary/20"
                  data-testid={`button-template-${template.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </div>

          <Tabs defaultValue="log" className="mt-2">
            <TabsList className="grid w-full grid-cols-2 bg-white/5">
              <TabsTrigger value="log">Log New</TabsTrigger>
              <TabsTrigger value="history">Today's History</TabsTrigger>
            </TabsList>
            
            <TabsContent value="log" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="workoutName">Workout Name</Label>
                <Input
                  id="workoutName"
                  placeholder="e.g., Morning Push Day"
                  value={workoutForm.workoutName}
                  onChange={(e) => setWorkoutForm(prev => ({ ...prev, workoutName: e.target.value }))}
                  className="bg-white/5 border-white/10"
                  data-testid="input-workout-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={workoutForm.duration}
                    onChange={(e) => setWorkoutForm(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))}
                    className="bg-white/5 border-white/10"
                    data-testid="input-duration"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calories">Calories Burned</Label>
                  <Input
                    id="calories"
                    type="number"
                    value={workoutForm.caloriesBurned}
                    onChange={(e) => setWorkoutForm(prev => ({ ...prev, caloriesBurned: parseInt(e.target.value) || 0 }))}
                    className="bg-white/5 border-white/10"
                    data-testid="input-calories-burned"
                  />
                </div>
              </div>

              {/* Add Exercise */}
              <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                <p className="text-sm font-medium">Add Exercise</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Exercise name"
                    value={newExercise.name}
                    onChange={(e) => setNewExercise(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-white/5 border-white/10 text-sm"
                    data-testid="input-exercise-name"
                  />
                  <div className="flex gap-1">
                    <Input
                      type="number"
                      placeholder="Sets"
                      value={newExercise.sets}
                      onChange={(e) => setNewExercise(prev => ({ ...prev, sets: parseInt(e.target.value) || 0 }))}
                      className="bg-white/5 border-white/10 text-sm w-16"
                      data-testid="input-sets"
                    />
                    <Input
                      type="number"
                      placeholder="Reps"
                      value={newExercise.reps}
                      onChange={(e) => setNewExercise(prev => ({ ...prev, reps: parseInt(e.target.value) || 0 }))}
                      className="bg-white/5 border-white/10 text-sm w-16"
                      data-testid="input-reps"
                    />
                    <Input
                      type="number"
                      placeholder="lbs"
                      value={newExercise.weight || ""}
                      onChange={(e) => setNewExercise(prev => ({ ...prev, weight: parseInt(e.target.value) || 0 }))}
                      className="bg-white/5 border-white/10 text-sm w-16"
                      data-testid="input-weight"
                    />
                  </div>
                </div>
                <Button onClick={addExercise} size="sm" variant="outline" className="w-full" data-testid="button-add-exercise">
                  <Plus className="w-4 h-4 mr-1" /> Add Exercise
                </Button>
              </div>

              {/* Exercise List */}
              {workoutForm.exercises.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Exercises ({workoutForm.exercises.filter(e => e.completed).length}/{workoutForm.exercises.length} done)</p>
                  {workoutForm.exercises.map((ex, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        ex.completed ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/[0.02] border-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleExerciseComplete(index)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            ex.completed ? "bg-emerald-500 text-white" : "bg-white/10"
                          }`}
                          data-testid={`button-toggle-exercise-${index}`}
                        >
                          {ex.completed && <Check className="w-4 h-4" />}
                        </button>
                        <div>
                          <p className={`font-medium text-sm ${ex.completed ? "line-through text-muted-foreground" : ""}`}>
                            {ex.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {ex.sets} sets x {ex.reps} reps {ex.weight ? `@ ${ex.weight} lbs` : ""}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => removeExercise(index)} className="text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="How did the workout feel?"
                  value={workoutForm.notes}
                  onChange={(e) => setWorkoutForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="bg-white/5 border-white/10 min-h-[60px]"
                  data-testid="input-workout-notes"
                />
              </div>

              <Button
                onClick={handleLogWorkout}
                className="w-full gradient-primary text-white"
                disabled={createWorkoutLog.isPending}
                data-testid="button-save-workout"
              >
                {createWorkoutLog.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Log Workout
              </Button>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {workoutLogs.filter(w => new Date(w.date).toDateString() === new Date().toDateString()).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Dumbbell className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p>No workouts logged today</p>
                  <p className="text-sm">Start by logging your first workout!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workoutLogs
                    .filter(w => new Date(w.date).toDateString() === new Date().toDateString())
                    .map((log) => (
                      <div key={log.id} className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{log.workoutName}</h4>
                          <div className="flex items-center gap-2">
                            {log.completed && (
                              <Badge className="bg-emerald-500/20 text-emerald-400">Complete</Badge>
                            )}
                            <button
                              onClick={() => deleteWorkoutLog.mutate(log.id)}
                              className="text-muted-foreground hover:text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {log.duration} min
                          </span>
                          {log.caloriesBurned > 0 && (
                            <span className="flex items-center gap-1">
                              <Flame className="w-3 h-3" /> {log.caloriesBurned} kcal
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-md bg-card border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Crown className="w-5 h-5 text-gold" />
              Upgrade to Premium
            </DialogTitle>
            <DialogDescription>
              Unlock all features to reach your fitness goals faster
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>Unlimited activity logging</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Utensils className="w-4 h-4 text-orange-400" />
                <span>Food & calorie tracking</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Upload className="w-4 h-4 text-purple-400" />
                <span>Document uploads & analysis</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Target className="w-4 h-4 text-primary" />
                <span>Weekly personalized plans</span>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg border border-primary/30 bg-primary/5">
                <div>
                  <p className="font-medium">{PRICING.monthly.label}</p>
                  <p className="text-xs text-muted-foreground">Billed monthly</p>
                </div>
                <p className="text-xl font-bold">{PRICING.monthly.displayAmount}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border border-gold/30 bg-gold/5">
                <div>
                  <p className="font-medium">{PRICING.yearly.label}</p>
                  <p className="text-xs text-gold">Save {PRICING.yearly.savings}%</p>
                </div>
                <p className="text-xl font-bold">{PRICING.yearly.displayAmount}<span className="text-sm font-normal text-muted-foreground">/yr</span></p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              className="flex-1 gradient-primary text-white"
              onClick={() => {
                setShowUpgradeModal(false);
                window.location.href = '/profile';
              }}
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      
      {/* Trial Ended Modal */}
      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent className="sm:max-w-md bg-card border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Clock className="w-5 h-5 text-orange-400" />
              Trial Period Ended
            </DialogTitle>
            <DialogDescription>
              Your {PRICING.trial.duration}-day free trial has ended
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Upgrade to Premium for unlimited AI conversations, plus access to all tracking features and personalized plans.
            </p>

            <div className="border-t border-white/5 pt-4 space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg border border-primary/30 bg-primary/5">
                <div>
                  <p className="font-medium">{PRICING.monthly.label}</p>
                  <p className="text-xs text-muted-foreground">Billed monthly</p>
                </div>
                <p className="text-xl font-bold">{PRICING.monthly.displayAmount}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg border border-gold/30 bg-gold/5">
                <div>
                  <p className="font-medium">{PRICING.yearly.label}</p>
                  <p className="text-xs text-gold">Save {PRICING.yearly.savings}%</p>
                </div>
                <p className="text-xl font-bold">{PRICING.yearly.displayAmount}<span className="text-sm font-normal text-muted-foreground">/yr</span></p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowLimitModal(false)}
              className="flex-1"
            >
              Maybe Later
            </Button>
            <Button
              className="flex-1 gradient-primary text-white"
              onClick={() => {
                setShowLimitModal(false);
                window.location.href = '/profile';
              }}
            >
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <IOSInstallBanner />
    </div>
  );
}
