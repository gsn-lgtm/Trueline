self.addEventListener("install", (e) => {
  e.waitUntil(caches.open("trueline-v2").then((c) => c.addAll(["./", "./index.html", "./manifest.json", "./app.js"])));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== "trueline-v2").map(k => caches.delete(k)))));
});
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
