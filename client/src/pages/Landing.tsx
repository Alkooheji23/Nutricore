import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Loader2, 
  Check,
  Star,
  Lock,
  Crown,
  Paperclip,
  Calendar,
  Gift,
  ChevronRight,
  LogIn,
  Plus,
  Upload,
  Moon,
  Sun,
  Trash2,
  Menu,
  MessageSquare,
  ClipboardList,
  Trophy,
  Shield,
  Watch
} from "lucide-react";
import { PremiumIcon } from "@/components/ui/premium-icons";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

const GUEST_MESSAGE_LIMIT = 50;
const STORAGE_KEY = "nutricore_guest_messages";

interface DemoStatus {
  demoActive: boolean;
  expiryDate: string;
  message: string;
}

interface GuestMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function Landing() {
  const { user, isHydrating } = useAuth();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<GuestMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);
  const [signInFeature, setSignInFeature] = useState<string>("");
  const [guestMessageCount, setGuestMessageCount] = useState(0);
  const [showFocusGroupModal, setShowFocusGroupModal] = useState(false);
  const [focusGroupEmail, setFocusGroupEmail] = useState("");
  const [focusGroupName, setFocusGroupName] = useState("");
  const [focusGroupLoading, setFocusGroupLoading] = useState(false);
  const [focusGroupSuccess, setFocusGroupSuccess] = useState(false);
  const [focusGroupError, setFocusGroupError] = useState("");

  // Redirect logged-in users to their dashboard
  useEffect(() => {
    if (!isHydrating && user) {
      setLocation("/home");
    }
  }, [user, isHydrating, setLocation]);

  const handleFocusGroupSignup = async () => {
    if (!focusGroupEmail.includes('@')) {
      setFocusGroupError("Please enter a valid email address");
      return;
    }
    
    setFocusGroupLoading(true);
    setFocusGroupError("");
    
    try {
      const res = await fetch('/api/focus-group/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: focusGroupEmail, firstName: focusGroupName }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setFocusGroupSuccess(true);
      } else {
        setFocusGroupError(data.message || 'Signup failed. Please try again.');
      }
    } catch (err) {
      setFocusGroupError('Network error. Please try again.');
    } finally {
      setFocusGroupLoading(false);
    }
  };
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleFeatureClick = (feature: string) => {
    setSignInFeature(feature);
    setShowSignInModal(true);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const [demoCodeValid, setDemoCodeValid] = useState(false);
  const [demoEndDate, setDemoEndDate] = useState<string | null>(null);

  // Check for demo code in URL and validate it
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const demoCode = urlParams.get('demo');
    
    if (demoCode) {
      // Store demo code for later use after login
      localStorage.setItem('nutricore_demo_code', demoCode);
      
      // Validate the demo code
      fetch(`/api/demo/validate?code=${encodeURIComponent(demoCode)}`)
        .then(res => res.json())
        .then(data => {
          if (data.valid) {
            setDemoCodeValid(true);
            setDemoEndDate(data.endDate);
          }
        })
        .catch(err => console.error('Error validating demo code:', err));
      
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      // Check if there's a stored demo code
      const storedCode = localStorage.getItem('nutricore_demo_code');
      if (storedCode) {
        fetch(`/api/demo/validate?code=${encodeURIComponent(storedCode)}`)
          .then(res => res.json())
          .then(data => {
            if (data.valid) {
              setDemoCodeValid(true);
              setDemoEndDate(data.endDate);
            } else {
              // Invalid code, remove it
              localStorage.removeItem('nutricore_demo_code');
            }
          })
          .catch(err => console.error('Error validating demo code:', err));
      }
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setMessages(parsed.messages || []);
        setGuestMessageCount(parsed.count || 0);
      } catch (e) {
        console.error("Error parsing stored messages:", e);
      }
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      messages,
      count: guestMessageCount
    }));
  }, [messages, guestMessageCount]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (guestMessageCount >= GUEST_MESSAGE_LIMIT) {
      setShowUpgradeModal(true);
      return;
    }

    const userMessage: GuestMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setGuestMessageCount(prev => prev + 1);

    try {
      const response = await fetch("/api/chat/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: userMessage.content })
      });

      const data = await response.json();
      
      if (response.ok) {
        const aiMessage: GuestMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.response
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // Sync with server-side remaining count
        if (typeof data.remaining === 'number') {
          setGuestMessageCount(GUEST_MESSAGE_LIMIT - data.remaining);
        }
      } else {
        if (data.limitReached) {
          setShowUpgradeModal(true);
          setGuestMessageCount(GUEST_MESSAGE_LIMIT);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadClick = () => {
    const aiMessage: GuestMessage = {
      id: `ai-${Date.now()}`,
      role: "assistant",
      content: "I'd love to help you analyze your health documents! 📄\n\nDocument analysis (blood tests, medical reports, etc.) is a premium feature that provides personalized insights based on your health data.\n\nSign up for a free 1-month trial to unlock:\n• AI-powered document analysis\n• Personalized recommendations based on your results\n• Up to 3 document uploads per month\n• Unlimited AI coaching\n\nClick 'Sign In' above to get started!"
    };
    setMessages(prev => [...prev, aiMessage]);
  };

  const suggestedPrompts = [
    { variant: "cardio" as const, text: "I want to start running - where do I begin?", color: "text-emerald-400" },
    { variant: "food" as const, text: "What should I eat before a swim workout?", color: "text-orange-400" },
    { variant: "heart" as const, text: "Best yoga routine for flexibility", color: "text-purple-400" },
    { variant: "zap" as const, text: "How do I train for a 5K race?", color: "text-blue-400" },
  ];

  const remainingMessages = Math.max(0, GUEST_MESSAGE_LIMIT - guestMessageCount);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Minimal Header - ChatGPT Style */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-background">
        {/* Left: Burger Menu + Logo */}
        <div className="flex items-center gap-2">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-burger-menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
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
                    onClick={() => setIsMobileMenuOpen(false)}
                    data-testid="nav-ai-trainer"
                  >
                    <PremiumIcon variant="chat" size="sm" />
                    <span className="font-medium text-sm">My Trainer</span>
                  </button>
                  <button
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-left text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      window.location.href = '/api/login';
                    }}
                    data-testid="nav-daily-tracker"
                  >
                    <PremiumIcon variant="tracker" size="sm" />
                    <span className="font-medium text-sm">Daily Tracker</span>
                    <Lock className="w-4 h-4 ml-auto opacity-50" />
                  </button>
                  <button
                    className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 w-full text-left text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      window.location.href = '/api/login';
                    }}
                    data-testid="nav-profile"
                  >
                    <PremiumIcon variant="profile" size="sm" />
                    <span className="font-medium text-sm">Profile</span>
                    <Lock className="w-4 h-4 ml-auto opacity-50" />
                  </button>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 space-y-2">
                    <Button 
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      window.location.href = '/api/login';
                    }}
                    className="w-full justify-start gap-3 bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 rounded-xl transition-colors" 
                    data-testid="menu-sign-in"
                  >
                    <PremiumIcon variant="signin" size="xs" />
                    <span className="text-sm font-medium">Sign In</span>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Logo size="sm" />
        </div>

        {/* Right: Theme Toggle & Sign In */}
        <div className="flex items-center gap-3">
          <Button 
            size="sm"
            onClick={() => window.location.href = '/api/login'}
            className="h-9 px-5 text-xs font-semibold btn-luxury text-white rounded-xl" 
            data-testid="button-sign-in"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Demo Banner - Compact */}
      {demoCodeValid && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2">
          <p className="text-xs text-center text-primary">
            <Gift className="w-3 h-3 inline mr-1" />
            Demo link active - Sign in to unlock all premium features!
          </p>
        </div>
      )}

      {/* Chat Area */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center relative">
              {/* Hero Logo - generous negative space */}
              <div className="mb-16 md:mb-20">
                <Logo size="lg" />
              </div>
              
              {/* Premium Hero Content */}
              <div className="max-w-2xl mx-auto px-4">
                {/* Refined Headline */}
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-display headline-luxury mb-6">
                  Elite AI Coaching
                </h1>
                
                {/* Premium Subheadline */}
                <p className="subhead-luxury text-lg md:text-xl max-w-lg mx-auto mb-10 leading-relaxed">
                  Personalized training and nutrition guidance powered by sports science.
                </p>
                
                {/* Premium Free Preview Badge */}
                <div className="badge-luxury inline-flex items-center gap-2 px-5 py-2.5 rounded-full mb-10">
                  <div className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                  <span className="text-sm font-medium tracking-wide">Free Preview Access</span>
                </div>
                
                {/* Focus Group CTA - Premium Button */}
                <div className="space-y-4">
                  <Button
                    onClick={() => setShowFocusGroupModal(true)}
                    className="btn-luxury text-white font-semibold px-10 py-6 text-base rounded-xl"
                    data-testid="button-join-focus-group-cta"
                  >
                    <Crown className="w-5 h-5 mr-3" />
                    Join Focus Group
                  </Button>
                  <p className="text-xs text-[#666666] tracking-wide">
                    Limited early access • Full features unlocked
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 pb-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${msg.role}-${msg.id}`}
                >
                  {/* Message Content - Premium Bubbles with Depth */}
                  <div className="max-w-[80%]">
                    <div
                      className={`inline-block px-5 py-4 text-[15px] leading-relaxed ${
                        msg.role === "user"
                          ? "bubble-user rounded-[20px] rounded-br-md"
                          : "bubble-ai rounded-[20px] rounded-bl-md"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* AI Typing Indicator - Premium Animated Dots */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bubble-ai px-5 py-4 rounded-[20px] rounded-bl-md">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area - Premium Luxury Style */}
      <div className="border-t border-border bg-background p-4">
        <div className="max-w-[750px] mx-auto">
          {guestMessageCount >= GUEST_MESSAGE_LIMIT ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 text-gold mb-4">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">Free messages used</span>
              </div>
              <p className="text-muted-foreground text-sm mb-4">
                Sign up to continue chatting with your AI trainer
              </p>
              <Button 
                onClick={() => window.location.href = '/api/login'}
                className="gradient-primary text-white font-semibold px-8 premium-glow" 
                data-testid="button-unlock-full"
              >
                <Crown className="w-4 h-4 mr-2" />
                Unlock Full Access - 1 Month Free Trial
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                {/* Plus Button with Popover */}
                <div className="relative">
                  <Button
                    data-testid="button-plus-menu"
                    onClick={() => setShowPlusMenu(!showPlusMenu)}
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 rounded-full border border-white/20 hover:bg-white/10 transition-colors flex-shrink-0"
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
                      <div className="absolute bottom-14 left-0 z-50 w-56 rounded-xl border border-white/10 bg-card shadow-xl p-2 space-y-1">
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Sign in for full access
                        </div>
                        <button
                          onClick={() => {
                            setShowPlusMenu(false);
                            handleFeatureClick("workout");
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
                          data-testid="plus-menu-workout"
                        >
                          <PremiumIcon variant="workout" size="sm" />
                          <span className="flex-1 text-left">Log Activity</span>
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => {
                            setShowPlusMenu(false);
                            handleFeatureClick("diet");
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
                          data-testid="plus-menu-food"
                        >
                          <PremiumIcon variant="food" size="sm" />
                          <span className="flex-1 text-left">Log Food</span>
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => {
                            setShowPlusMenu(false);
                            handleFeatureClick("health");
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
                          data-testid="plus-menu-upload"
                        >
                          <PremiumIcon variant="upload" size="sm" />
                          <span className="flex-1 text-left">Upload Document</span>
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <div className="border-t border-white/5 my-1" />
                        <button
                          onClick={() => {
                            setShowPlusMenu(false);
                            handleFeatureClick("smartwatch");
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm hover:bg-white/5 transition-colors"
                          data-testid="plus-menu-smartwatch"
                        >
                          <PremiumIcon variant="watch" size="sm" />
                          <span className="flex-1 text-left">Smartwatches</span>
                          <Lock className="w-3 h-3 text-muted-foreground" />
                        </button>
                        <div className="border-t border-white/5 my-1" />
                        <Button 
                          onClick={() => {
                            setShowPlusMenu(false);
                            window.location.href = '/api/login';
                          }}
                          className="w-full h-9 bg-[#4A5D4A] text-white text-xs flex items-center justify-center gap-2 border border-[#D4AF37]/50 hover:border-[#D4AF37] hover:shadow-[0_0_8px_rgba(212,175,55,0.25)] transition-all duration-300"
                        >
                          <Crown className="w-4 h-4" />
                          <span>Sign In to Unlock</span>
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Input Field - Premium Slim Design with Ambient Glow */}
                <div className="flex-1 ambient-glow">
                  <div className="input-luxury rounded-2xl">
                    <Input
                      data-testid="input-message"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      placeholder="Ask your coach..."
                      className="w-full h-12 bg-transparent border-0 rounded-2xl px-5 text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 text-[15px]"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                
                {/* Send Button - Premium Gold Accent */}
                <Button 
                  data-testid="button-send"
                  onClick={handleSend} 
                  size="icon" 
                  className="h-11 w-11 rounded-xl send-btn-luxury text-[#0A0A0A] disabled:opacity-50 flex-shrink-0"
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading 
                    ? <Loader2 className="w-4 h-4 animate-spin" /> 
                    : <Send className="w-4 h-4" />
                  }
                </Button>
              </div>
              {messages.length > 0 && (
                <div className="flex items-center justify-center gap-4 mt-4">
                  <button
                    onClick={handleClearChat}
                    className="text-[11px] text-[#555555] hover:text-[#999999] flex items-center gap-1.5 transition-colors"
                    data-testid="button-clear-chat"
                  >
                    <Trash2 className="w-3 h-3" />
                    New Chat
                  </button>
                  <span className="text-[#333333]">•</span>
                  <button
                    onClick={() => window.location.href = '/api/login'}
                    className="text-[11px] text-[#D4AF37] hover:text-[#D4AF37]/80 transition-colors"
                    data-testid="button-upgrade-cta"
                  >
                    Sign in to save history
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer with Privacy Link */}
      <footer className="border-t border-white/5 bg-background py-3 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-4 text-[10px] text-muted-foreground/60">
          <span>© 2025 NutriCore</span>
          <span>•</span>
          <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy">
            Privacy Policy
          </Link>
        </div>
      </footer>

      {/* Upgrade Modal */}
      <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
        <DialogContent className="sm:max-w-lg bg-[#111111] border-[#1A1A1A]">
          <DialogHeader className="text-center">
            <DialogTitle className="text-2xl font-display text-[#F2F2F2]">Unlock Your Full Potential</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              You've used your free messages. Sign up to continue with unlimited AI coaching.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Benefits */}
            <div className="space-y-3">
              {[
                "Unlimited AI trainer conversations",
                "Personalized workout & diet plans",
                "Weekly plan updates based on progress",
                "Health metrics tracking",
                "Medical document analysis"
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <span className="text-foreground">{benefit}</span>
                </div>
              ))}
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 text-center">
                <p className="text-2xl font-bold font-display text-foreground">$9.99</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
              <div className="p-4 rounded-xl bg-gold/5 border border-gold/20 text-center relative">
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gold text-black text-[10px] px-2">
                  BEST VALUE
                </Badge>
                <p className="text-2xl font-bold font-display text-gold">$89.99</p>
                <p className="text-xs text-muted-foreground">per year (save 25%)</p>
              </div>
            </div>

            {/* CTA */}
            <div className="space-y-3">
              <Button 
                onClick={() => {
                  setShowUpgradeModal(false);
                  window.location.href = '/api/login';
                }}
                className="w-full h-12 gradient-primary text-white font-semibold premium-glow" 
                data-testid="button-modal-signup"
              >
                <Star className="w-4 h-4 mr-2" />
                Start 1-Month Free Trial
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                No credit card required • Cancel anytime
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign In Required Modal */}
      <Dialog open={showSignInModal} onOpenChange={setShowSignInModal}>
        <DialogContent className="sm:max-w-md bg-card border-white/10">
          <DialogHeader className="text-center">
            <div className="flex items-center justify-center mx-auto mb-4">
              {signInFeature === "diet" && <PremiumIcon variant="food" size="xl" />}
              {signInFeature === "workout" && <PremiumIcon variant="workout" size="xl" />}
              {signInFeature === "health" && <PremiumIcon variant="heart" size="xl" />}
            </div>
            <DialogTitle className="text-xl font-display">
              {signInFeature === "diet" && "Track Your Diet"}
              {signInFeature === "workout" && "Log Your Workouts"}
              {signInFeature === "health" && "Upload Health Documents"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Sign in to access this feature and unlock your full fitness potential.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
              {signInFeature === "diet" && (
                <>
                  <p className="text-sm text-foreground font-medium">Track with ease:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Log meals with calorie counts</li>
                    <li>• Track protein, carbs & fats</li>
                    <li>• Set daily nutrition goals</li>
                  </ul>
                </>
              )}
              {signInFeature === "workout" && (
                <>
                  <p className="text-sm text-foreground font-medium">Workout templates:</p>
                  <div className="flex flex-wrap gap-2">
                    {["Push Day", "Pull Day", "Leg Day", "Full Body", "Cardio"].map(workout => (
                      <Badge key={workout} variant="outline" className="border-white/10 text-muted-foreground">
                        {workout}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
              {signInFeature === "health" && (
                <>
                  <p className="text-sm text-foreground font-medium">AI-powered analysis:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Upload blood test results</li>
                    <li>• Get personalized insights</li>
                    <li>• Track health markers over time</li>
                  </ul>
                </>
              )}
            </div>

            <Button 
              onClick={() => {
                setShowSignInModal(false);
                window.location.href = '/api/login';
              }}
              className="w-full h-12 gradient-primary text-white font-semibold premium-glow" 
              data-testid="button-signin-feature"
            >
              <PremiumIcon variant="signin" size="xs" />
              Sign In to Access
            </Button>
            
            {demoCodeValid && (
              <p className="text-[10px] text-center text-gold">
                Demo link active - sign in to unlock all premium features!
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Focus Group Signup Modal */}
      <Dialog open={showFocusGroupModal} onOpenChange={(open) => {
        setShowFocusGroupModal(open);
        if (!open) {
          setFocusGroupSuccess(false);
          setFocusGroupError("");
        }
      }}>
        <DialogContent className="sm:max-w-md bg-card border-white/10">
          <DialogHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <DialogTitle className="text-xl font-display">
              {focusGroupSuccess ? "Check Your Email!" : "Join the Focus Group"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {focusGroupSuccess 
                ? "We've sent you a verification link. Click it to confirm your spot."
                : "Get early access to NutriCore's full coaching experience."}
            </DialogDescription>
          </DialogHeader>
          
          {focusGroupSuccess ? (
            <div className="py-4 space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Verify your email to join the waitlist. We'll let you know when your spot opens up!
              </p>
              <Button
                onClick={() => setShowFocusGroupModal(false)}
                className="w-full"
                variant="outline"
              >
                Got it
              </Button>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Your Name (optional)</label>
                  <Input
                    placeholder="First name"
                    value={focusGroupName}
                    onChange={(e) => setFocusGroupName(e.target.value)}
                    className="h-11 bg-white/5 border-white/10"
                    data-testid="input-focus-group-name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Email Address *</label>
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={focusGroupEmail}
                    onChange={(e) => setFocusGroupEmail(e.target.value)}
                    className="h-11 bg-white/5 border-white/10"
                    data-testid="input-focus-group-email"
                  />
                </div>
              </div>
              
              {focusGroupError && (
                <p className="text-sm text-red-400 text-center">{focusGroupError}</p>
              )}
              
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <p className="text-sm font-medium text-primary">What you'll get:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-primary" /> Personalized workout & diet plans</li>
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-primary" /> AI that remembers your journey</li>
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-primary" /> Unlimited coaching chat</li>
                  <li className="flex items-center gap-2"><Check className="w-3 h-3 text-primary" /> Priority access to new features</li>
                </ul>
              </div>

              <Button 
                onClick={handleFocusGroupSignup}
                disabled={focusGroupLoading || !focusGroupEmail}
                className="w-full h-12 gradient-primary text-white font-semibold premium-glow" 
                data-testid="button-join-focus-group"
              >
                {focusGroupLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {focusGroupLoading ? "Signing up..." : "Join Focus Group"}
              </Button>
              
              <p className="text-[10px] text-center text-muted-foreground">
                By signing up, you agree to receive updates about NutriCore.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
