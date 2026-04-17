import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

function canShowPrompt(): boolean {
  if (!isStandalone()) return false;
  if (!('Notification' in window)) return false;
  if (!('serviceWorker' in navigator)) return false;
  if (Notification.permission !== 'default') return false;
  
  const dismissed = localStorage.getItem('push_prompt_dismissed');
  if (dismissed) {
    const dismissedAt = new Date(dismissed);
    const now = new Date();
    const daysSinceDismissed = (now.getTime() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceDismissed < 7) return false;
  }
  
  return true;
}

async function subscribeToPush(): Promise<boolean> {
  try {
    const response = await fetch('/api/push/public-key');
    if (!response.ok) {
      console.log('[Push] Push service not available');
      return false;
    }
    
    const { publicKey } = await response.json();
    if (!publicKey) return false;
    
    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    
    const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' :
                     /Android/.test(navigator.userAgent) ? 'android' : 'desktop';
    
    const subscribeResponse = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        platform,
        displayMode: isStandalone() ? 'standalone' : 'browser',
      }),
    });
    
    return subscribeResponse.ok;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushPermissionPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      if (canShowPrompt()) {
        setVisible(true);
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    
    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        const success = await subscribeToPush();
        if (success) {
          toast({
            title: 'Notifications enabled',
            description: 'You\'ll receive updates about your workouts and training.',
          });
        }
      } else if (permission === 'denied') {
        toast({
          title: 'Notifications blocked',
          description: 'You can enable them later in your device settings.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
    } finally {
      setLoading(false);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('push_prompt_dismissed', new Date().toISOString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="push-permission-prompt"
      className="fixed bottom-20 left-4 right-4 z-50 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom-4 duration-300"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-[#666] hover:text-white transition-colors"
        data-testid="button-dismiss-push-prompt"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="p-2 bg-[#D4A84B]/10 rounded-lg">
          <Bell className="w-5 h-5 text-[#D4A84B]" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm mb-1">
            Stay on track
          </h3>
          <p className="text-[#888] text-xs mb-3">
            Enable notifications to receive workout confirmations and recovery insights.
          </p>
          
          <div className="flex gap-2">
            <Button
              onClick={handleEnable}
              disabled={loading}
              size="sm"
              className="bg-[#D4A84B] hover:bg-[#C49A3F] text-black font-medium"
              data-testid="button-enable-notifications"
            >
              {loading ? 'Enabling...' : 'Enable'}
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="text-[#888] hover:text-white"
              data-testid="button-not-now-notifications"
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
