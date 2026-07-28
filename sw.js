/* نورِ صبا — service worker
   ایپ شیل کو کیش کرتا ہے تاکہ انٹرنیٹ کے بغیر بھی چلے۔
   موسم کی API کبھی کیش نہیں ہوتی (ہمیشہ تازہ ڈیٹا)۔ */

/* ⚠️ ہر بار جب index.html میں کوئی تبدیلی کر کے دوبارہ اپلوڈ کریں،
   یہ نمبر بڑھائیں (v1 → v2 → v3 …) — یہی وہ چیز ہے جو صارفین کے
   فون پر "نیا نسخہ دستیاب ہے" کا بینر دکھانے کا باعث بنتی ہے۔
   اگر یہ نمبر نہ بدلا تو براؤزر سمجھے گا کچھ نہیں بدلا، اور
   صارفین کو پرانا نسخہ ہی ملتا رہے گا۔ */
const CACHE = "noor-saba-v6";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./favicon-64.png",
  "./announcements.json",
  "./azan-kazemzadeh.opus"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // ہر فائل الگ الگ — ایک ناکام ہو تو باقی پھر بھی کیش ہو جائیں
    await Promise.all(ASSETS.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow("./");
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // موسم: صرف نیٹ ورک (ایپ خود localStorage میں کیش کرتی ہے)
  if (url.hostname === "api.open-meteo.com") return;

  // اعلانات: نیٹ ورک پہلے (تازہ ترین اعلانات فوراً نظر آئیں)، ناکامی پر کیش
  if (url.pathname.endsWith("/announcements.json")) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: "no-store" });
        const c = await caches.open(CACHE);
        c.put(req, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        const cached = await caches.match(req);
        return cached || Response.error();
      }
    })());
    return;
  }

  // نیویگیشن: پہلے کیش، پھر نیٹ ورک
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      const cached = await caches.match("./index.html");
      if (cached) return cached;
      try { return await fetch(req); }
      catch (err) { return new Response("آف لائن", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }); }
    })());
    return;
  }

  // باقی سب: cache-first، پھر نیٹ ورک سے لا کر کیش میں رکھ لیں (فونٹس بھی)
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === "opaque")) {
        const c = await caches.open(CACHE);
        c.put(req, res.clone()).catch(() => {});
      }
      return res;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});
