import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import Layout from "@/components/Layout";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Calendar from "@/pages/Calendar";
import Tracker from "@/pages/Tracker";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import Onboarding from "@/pages/Onboarding";
import Privacy from "@/pages/Privacy";
import VerifyEmail from "@/pages/VerifyEmail";
import Progress from "@/pages/Progress";
import Devices from "@/pages/Devices";
import Plans from "@/pages/Plans";
import Diet from "@/pages/Diet";
import GuidedWorkout from "@/pages/GuidedWorkout";
import WorkoutDetail from "@/pages/WorkoutDetail";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TermsModal } from "@/components/TermsModal";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { motion, AnimatePresence } from "framer-motion";

function ProtectedRoute({ component: Component, allowIncompleteProfile = false }: { component: React.ComponentType, allowIncompleteProfile?: boolean }) {
  const { isHydrating, user } = useAuth();
  const [location, setLocation] = useLocation();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Only redirect after hydration is complete and we're certain there's no user
    if (!isHydrating && !user) {
      setRedirecting(true);
      setLocation("/");
    }
  }, [user, isHydrating, setLocation]);

  useEffect(() => {
    if (user && !user.termsAccepted) {
      setShowTermsModal(true);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.termsAccepted && !user.profileComplete && !allowIncompleteProfile && location !== "/chat" && location !== "/onboarding") {
      setRedirecting(true);
      setLocation("/home");
    }
  }, [user, allowIncompleteProfile, location, setLocation]);

  const handleTermsAccepted = () => {
    setShowTermsModal(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };

  // Show neutral loading state while auth is hydrating
  if (isHydrating || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user.termsAccepted) {
    return (
      <>
        <TermsModal open={showTermsModal} onAccept={handleTermsAccepted} />
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user.profileComplete && !allowIncompleteProfile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <Component />;
}


function Router() {
  const [location] = useLocation();
  
  return (
    <Layout>
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="flex-1"
        >
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/onboarding">
              <ProtectedRoute component={Onboarding} allowIncompleteProfile={true} />
            </Route>
            <Route path="/home">
              <ProtectedRoute component={Home} />
            </Route>
            <Route path="/dashboard">
              <ProtectedRoute component={Home} />
            </Route>
            <Route path="/chat">
              <ProtectedRoute component={Chat} allowIncompleteProfile={true} />
            </Route>
            <Route path="/calendar">
              <ProtectedRoute component={Calendar} />
            </Route>
            <Route path="/tracker">
              <ProtectedRoute component={Tracker} />
            </Route>
            <Route path="/tracker/flow">
              <ProtectedRoute component={GuidedWorkout} />
            </Route>
            <Route path="/progress">
              <ProtectedRoute component={Progress} />
            </Route>
            <Route path="/profile">
              <ProtectedRoute component={Profile} />
            </Route>
            <Route path="/devices">
              <ProtectedRoute component={Devices} />
            </Route>
            <Route path="/admin">
              <ProtectedRoute component={Admin} />
            </Route>
            <Route path="/plans">
              <ProtectedRoute component={Plans} />
            </Route>
            <Route path="/diet">
              <ProtectedRoute component={Diet} />
            </Route>
            <Route path="/workout/:id">
              <ProtectedRoute component={WorkoutDetail} />
            </Route>
            <Route path="/privacy" component={Privacy} />
            <Route path="/verify-email" component={VerifyEmail} />
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <PushPermissionPrompt />
          </TooltipProvider>
        </LanguageProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
