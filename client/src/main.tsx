import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js');
    console.log('[SW] Service worker registered:', registration.scope);
    
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' && event.data?.deepLink) {
        window.location.href = event.data.deepLink;
      }
    });
  } catch (error) {
    console.error('[SW] Service worker registration failed:', error);
  }
}

if (isStandalone()) {
  registerServiceWorker();
}

createRoot(document.getElementById("root")!).render(<App />);
