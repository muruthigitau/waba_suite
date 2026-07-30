import { useCallback, useEffect, useState } from "react";

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

    const registerSW = async () => {
      if ("serviceWorker" in navigator) {
        try {
          // Register SW from Frappe's www directory so it can control /whatsapp/ scope
          // The sw.js is copied to waba_suite/www/sw.js and served at /whatsapp/sw.js
          const swUrl = `${window.location.origin}/assets/waba_suite/whatsapp/sw.js`;
          const registration = await navigator.serviceWorker.register(swUrl);
          // Removed explicit scope so SW defaults to its own path scope
          // On Frappe, this will be /assets/waba_suite/whatsapp/ which is sufficient
          // for caching app shell assets on PWA install

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  setCanUpdate(true);
                  setWaitingWorker(newWorker);
                }
              });
            }
          });

          if (registration.waiting) {
            setCanUpdate(true);
            setWaitingWorker(registration.waiting);
          }
        } catch (error) {
          console.error("Service Worker registration failed:", error);
        }
      }
    };
    registerSW();

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