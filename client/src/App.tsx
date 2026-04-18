import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/lib/i18n";
import Layout from "@/components/Layout";
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TermsModal } from "@/components/TermsModal";
import { PushPermissionPrompt } from "@/components/PushPermissionPrompt";
import { motion, AnimatePresence } from "framer-motion";

// Lazy-load all page components - fixes circular dependency TDZ crash
const Landing = lazy(() => import("@/pages/Landing"));
const Home = lazy(() => import("@/pages/Home"));
const Chat = lazy(() => import("@/pages/Chat"));
const Calendar = lazy(() => import("@/pages/Calendar"));
const Tracker = lazy(() => import("@/pages/Tracker"));
const Profile = lazy(() => import("@/pages/Profile"));
const Admin = lazy(() => import("@/pages/Admin"));
const Onboarding = lazy(() => import("@/pages/Onboarding"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const VerifyEmail = lazy(() => import("@/pages/VerifyEmail"));
const Progress = lazy(() => import("@/pages/Progress"));
const Devices = lazy(() => import("@/pages/Devices"));
const Plans = lazy(() => import("@/pages/Plans"));
const Diet = lazy(() => import("@/pages/Diet"));
const GuidedWorkout = lazy(() => import("@/pages/GuidedWorkout"));
const WorkoutDetail = lazy(() => import("@/pages/WorkoutDetail"));
const NotFound = lazy(() => import("@/pages/not-found"));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}

function ProtectedRoute({ component: Component, allowIncompleteProfile = false }) {
  const { isHydrating, user } = useAuth();
  const [location, setLocation] = useLocation();
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
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
      setLocation("/onboarding");
    }
  }, [user, allowIncompleteProfile, location, setLocation]);

  const handleTermsAccepted = () => {
    setShowTermsModal(false);
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
  };

  if (isHydrating || redirecting) return <PageLoader />;
  if (!user) return <PageLoader />;

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

  if (!user.profileComplete && !allowIncompleteProfile) return <PageLoader />;

  return <Component />;
}

function Router() {
  const [location] = useLocation();
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
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
      </Suspense>
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
