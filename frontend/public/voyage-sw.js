/*
 * Service worker for the ship's log (/voyage/log) only: it is registered with
 * the scope /voyage/, so the rest of the site is untouched.
 *
 * Its one job is to let the log open with no connection. It keeps a copy of the
 * page and of the files the page is made of. It never caches or answers API
 * calls, and it leaves every other request to the browser.
 */
const CACHE = "voyage-log-v1";
const SHELL = "/index.html";
const SLOW_NETWORK_MS = 3000;

/** Built files have their content in their name, so a saved copy never goes stale. */
const isOurs = (pathname) => pathname.startsWith("/assets/") || pathname.startsWith("/voyage-");

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith("voyage-log-") && name !== CACHE) {
          await caches.delete(name);
        }
      }
      await self.clients.claim();
    })()
  );
});

const saveIfMissing = async (cache, url) => {
  if (await cache.match(url)) {
    return true;
  }
  try {
    await cache.add(url);
    return true;
  } catch {
    return false;
  }
};

/*
 * The page lists the files it loaded. They are saved first; the page itself is
 * saved only once everything it refers to is saved too, so the copy kept for
 * offline use is never a page whose scripts are missing.
 */
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "precache" || !Array.isArray(event.data.urls)) {
    return;
  }
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const listed = event.data.urls.filter(
        (url) => typeof url === "string" && isOurs(new URL(url, self.location.origin).pathname)
      );
      const saved = await Promise.all(listed.map((url) => saveIfMissing(cache, url)));

      const shell = await fetch(SHELL, { cache: "no-store" });
      if (!shell.ok) {
        return;
      }
      const html = await shell.clone().text();
      const referred = [...html.matchAll(/["'](\/assets\/[^"']+)["']/g)].map((match) => match[1]);
      const complete = await Promise.all(referred.map((url) => saveIfMissing(cache, url)));
      if (saved.every(Boolean) && complete.every(Boolean)) {
        await cache.put(SHELL, shell);
      }
    })().catch(() => undefined)
  );
});

const giveUpAfter = (ms) =>
  new Promise((_, reject) => setTimeout(() => reject(new Error("slow network")), ms));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  // The page itself: the live one when the network answers properly and quickly,
  // the saved one otherwise. An error page from a restarting server does not count.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const saved = await cache.match(SHELL);
        try {
          const fresh = await (saved
            ? Promise.race([fetch(request), giveUpAfter(SLOW_NETWORK_MS)])
            : fetch(request));
          return !fresh.ok && saved ? saved : fresh;
        } catch (error) {
          if (saved) {
            return saved;
          }
          throw error;
        }
      })()
    );
    return;
  }

  if (!isOurs(url.pathname)) {
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const saved = await cache.match(request);
      if (saved) {
        return saved;
      }
      const fresh = await fetch(request);
      if (fresh.ok && fresh.type === "basic") {
        cache.put(request, fresh.clone());
      }
      return fresh;
    })()
  );
});
