// WhatsApp Web Service Worker
// Cache Strategy: Cache First for assets, Network First for API calls

const CACHE_NAME = "whatsapp-v1";
const STATIC_ASSETS = [
  "/whatsapp",
  "/whatsapp/",
  "/whatsapp/index.html",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate event - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - cache strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls - Network First with offline fallback
  if (url.pathname.includes("/api/method/")) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Frappe assets - Cache First
  if (url.pathname.includes("/assets/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Static app assets - Cache First
  if (
    url.pathname.startsWith("/whatsapp/") &&
    (request.destination === "script" ||
      request.destination === "style" ||
      request.destination === "font" ||
      request.destination === "image")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navigations - Network First with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }

  // Default - Network only
  event.respondWith(fetch(request).catch(() => {
    return new Response("Offline", { status: 503 });
  }));
});

// Cache First strategy
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response(
      JSON.stringify({ offline: true, message: "You are offline" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Network First with offline fallback strategy
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline page for navigations
    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/whatsapp");
      if (offlinePage) {
        return offlinePage;
      }
    }

    return new Response(
      JSON.stringify({ offline: true, message: "You are offline" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Background sync for pending messages
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-messages") {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach((client) => {
      client.postMessage({ type: "SYNC_TRIGGER" });
    });
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}

// Handle push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || "New message",
      icon: "/assets/waba_suite/whatsapp/whatsapp.png",
      badge: "/assets/waba_suite/whatsapp/images/icon-192.png",
      vibrate: [200, 100, 200],
      data: {
        url: data.url || "/whatsapp",
        chatId: data.chatId,
      },
      actions: [
        {
          action: "open",
          title: "Open Chat",
        },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || "WhatsApp",
        options
      )
    );
  } catch (error) {
    console.error("Push notification error:", error);
  }
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/whatsapp";

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // Open a new window
        return clients.openWindow(urlToOpen);
      })
  );
});

// Listen for messages from the app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});