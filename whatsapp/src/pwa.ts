/**
 * Service worker registration for PWA/offline support.
 *
 * Registers the service worker at the site root (/sw.js). A service worker's
 * scope is always a sub-path of its own URL, so serving it from the root gives
 * it control over /whatsapp and everything beneath it — this is what makes the
 * app shell load entirely from cache while offline.
 *
 * IMPORTANT: Service workers are only available in SECURE CONTEXTS (HTTPS, or
 * http://localhost). When the app is served over plain HTTP (e.g. accessing a
 * Frappe site over a LAN IP or without TLS), the browser does not expose
 * `navigator.serviceWorker` at all — this is NOT a browser support problem.
 *
 * In those cases we skip registration silently and the app continues to work
 * normally via Dexie (offline chat data is fully functional regardless of the
 * service worker). PWA *installation* simply isn't available without HTTPS.
 *
 * In production Frappe serves waba_suite/www/sw.js at /sw.js; in dev Vite
 * serves public/sw.js at /sw.js. Both are identical and use the root scope.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RegisterSWOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
};

export function registerSW(options: RegisterSWOptions = {}): void {
  // 1. Service workers only exist in secure contexts (HTTPS or localhost).
  //    If the page is served over plain HTTP, silently skip — not a browser
  //    support issue, just a secure-context limitation. Do NOT log a scary
  //    "not supported" warning.
  if (!window.isSecureContext) {
    return;
  }

  // 2. Some browsers/environments genuinely lack service worker support.
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const swUrl = "/sw.js";

  const register = () => {
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        options.onRegisteredSW?.(swUrl, registration);

        if (import.meta.env.DEV) {
          return;
        }

        // Check for updates to the cached app shell.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          let refreshing = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              options.onNeedRefresh?.();
            }
          });
        });

        if (registration.waiting && navigator.serviceWorker.controller) {
          options.onNeedRefresh?.();
        }
      })
      .catch((error) => {
        // Silently ignore — the app works fine without the SW (Dexie handles
        // offline data). Logging here would alarm users on misconfigured setups.
        console.log("PWA: service worker registration skipped:", error?.message || error);
      });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}
