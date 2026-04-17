import { useState, useEffect } from "react";
import { X, Share } from "lucide-react";

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (window.navigator as any).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
}

export function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isIOS() && !isStandalone() && !sessionStorage.getItem("ios-banner-dismissed")) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem("ios-banner-dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 bg-[#1C1C1E] border border-white/10 rounded-2xl p-4 shadow-2xl flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white mb-0.5">Add NutriCore to Home Screen</p>
        <p className="text-xs text-muted-foreground leading-snug">
          Tap <Share className="inline w-3.5 h-3.5 mx-0.5 -mt-0.5" /> then <strong>"Add to Home Screen"</strong> for the full app experience.
        </p>
      </div>
      <button
        onClick={dismiss}
        className="text-muted-foreground hover:text-white transition-colors mt-0.5 shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
