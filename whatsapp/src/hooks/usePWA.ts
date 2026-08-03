import { useCallback, useEffect, useState } from "react";
import { registerSW } from "../pwa";

interface PWADetails {
  isInstallable: boolean;
  isInstalled: boolean;
  canUpdate: boolean;
  installApp: () => Promise<void>;
  updateApp: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let deferredPrompt: any = null;

export function usePWA(): PWADetails {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const checkInstalled = () => {
      const isStandalone = window.matchMedia(
        "(display-mode: standalone)",
      ).matches;
      if (isStandalone) {
        setIsInstalled(true);
      }
    };
    checkInstalled();

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setIsInstallable(true);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPrompt = null;
    };
    window.addEventListener("appinstalled", handleAppInstalled);

    // Register the service worker at the site root (/sw.js) so it controls
    // the /whatsapp scope and the app shell loads from cache while offline.
    registerSW({
      onNeedRefresh: () => {
        setCanUpdate(true);
        if (!window.isSecureContext || !("serviceWorker" in navigator)) return;
        navigator.serviceWorker.getRegistration().then((registration) => {
          if (registration?.waiting) {
            setWaitingWorker(registration.waiting);
          }
        });
      },
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const installApp = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setIsInstallable(false);
    if (result.outcome === "accepted") {
      setIsInstalled(true);
    }
  }, []);

  const updateApp = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
  }, [waitingWorker]);

  return {
    isInstallable,
    isInstalled,
    canUpdate,
    installApp,
    updateApp,
  };
}