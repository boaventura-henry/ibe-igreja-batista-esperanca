const APP_VERSION = "2026.07.16";
const CACHE_NAME = `ibe-pwa-${APP_VERSION}`;
const STATIC_ASSETS = [
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-72x72.png",
  "/icons/icon-96x96.png",
  "/icons/icon-128x128.png",
  "/icons/icon-144x144.png",
  "/icons/icon-152x152.png",
  "/icons/icon-192x192.png",
  "/icons/icon-384x384.png",
  "/icons/icon-512x512.png",
  "/icons/maskable-icon-192x192.png",
  "/icons/maskable-icon-512x512.png"
];
const PUBLIC_NAVIGATION_PATHS = new Set(["/", "/login", "/solicitar-acesso", "/offline"]);
const PROTECTED_NAVIGATION_PREFIXES = [
  "/dashboard",
  "/membros",
  "/usuarios",
  "/perfis-acesso",
  "/ministerios",
  "/membros-ministerios",
  "/escalas",
  "/eventos",
  "/comunicados",
  "/financeiro",
  "/relatorios",
  "/portal",
  "/solicitacoes-acesso",
  "/contribuicoes"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS).then(() => warmPublicShell(cache)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.map((cacheName) => (cacheName === CACHE_NAME ? undefined : caches.delete(cacheName))))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.slice(0, 80) : "Igreja Batista Esperança";
  const body = typeof payload.body === "string" && payload.body.trim() ? payload.body.slice(0, 180) : "Você tem uma nova atualização no IBE.";
  const url = safeNotificationUrl(payload.url || payload.data?.url) || "/portal";

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: typeof payload.icon === "string" ? payload.icon : "/icons/icon-192x192.png",
    badge: typeof payload.badge === "string" ? payload.badge : "/icons/icon-72x72.png",
    tag: typeof payload.tag === "string" ? payload.tag.slice(0, 80) : "ibe-notification",
    data: { url }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeNotificationUrl(event.notification.data?.url) || "/portal";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const current = clients.find((client) => "focus" in client);
      if (current) {
        return current.focus().then(() => current.navigate(target));
      }
      return self.clients.openWindow(target);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/auth/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, url));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  }
});

async function handleNavigation(request, url) {
  try {
    const response = await fetch(request);

    if (canCacheNavigation(url, response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const offline = await caches.match("/offline");
    const cached = isProtectedNavigation(url) ? undefined : await caches.match(request);

    return cached || offline || new Response("Voce esta offline.", { status: 503 });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)
  );
}

function safeNotificationUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function canCacheNavigation(url, response) {
  return response.ok && !response.redirected && PUBLIC_NAVIGATION_PATHS.has(url.pathname) && !isProtectedNavigation(url);
}

function isProtectedNavigation(url) {
  return PROTECTED_NAVIGATION_PREFIXES.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`));
}

async function warmPublicShell(cache) {
  await Promise.all(
    [...PUBLIC_NAVIGATION_PATHS].map(async (path) => {
      try {
        const request = new Request(path, {
          cache: "reload",
          credentials: "omit",
          redirect: "follow"
        });
        const response = await fetch(request);

        if (canCacheNavigation(new URL(path, self.location.origin), response)) {
          await cache.put(path, response);
        }
      } catch {
        // O cache de paginas publicas e uma melhoria progressiva.
      }
    })
  );
}
