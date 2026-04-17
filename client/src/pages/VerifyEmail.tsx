import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";
import nutriCoreLogo from "@assets/generated_images/heartbeat_mountain_gold_glow.png";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
      return;
    }

    fetch(`/api/focus-group/verify?token=${encodeURIComponent(token)}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'waitlist' || data.message?.includes('verified')) {
          setStatus('success');
          setMessage(data.message || "Email verified successfully! You're now on the waitlist.");
        } else {
          setStatus('error');
          setMessage(data.message || 'Verification failed. Please try again.');
        }
      })
      .catch(err => {
        console.error('Verification error:', err);
        setStatus('error');
        setMessage('An error occurred during verification. Please try again.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-white/10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-black flex items-center justify-center overflow-hidden">
            <img src={nutriCoreLogo} alt="NutriCore" className="w-14 h-14 object-contain" />
          </div>
          <CardTitle className="font-display text-2xl">
            {status === 'loading' && 'Verifying Email...'}
            {status === 'success' && "You're on the Waitlist!"}
            {status === 'error' && 'Verification Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground">Please wait while we verify your email...</p>
            </div>
          )}
          
          {status === 'success' && (
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <p className="text-muted-foreground">{message}</p>
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-left space-y-2">
                <h3 className="font-semibold text-primary flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  What happens next?
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li>We'll review your application</li>
                  <li>When a spot opens, you'll receive full access</li>
                  <li>You'll get an email notification when activated</li>
                </ul>
              </div>
              <Button
                onClick={() => setLocation('/')}
                className="w-full gradient-primary"
                data-testid="button-back-home"
              >
                Back to Home
              </Button>
            </div>
          )}
          
          {status === 'error' && (
            <div className="space-y-4">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <p className="text-muted-foreground">{message}</p>
              <Button
                onClick={() => setLocation('/')}
                variant="outline"
                className="w-full"
                data-testid="button-back-home"
              >
                Back to Home
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
