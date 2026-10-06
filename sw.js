/* ════════════════════════════════════════════════════════════
 *  Nilda Stok · Service Worker
 *  GAS içinde:  /exec?sayfa=sw  adresinden JavaScript olarak servis edilir.
 *  PWA kabuğunda: pwa-kabuk/sw.js olarak bu dosyanın aynısı kullanılır.
 *
 *  Görevleri
 *   • Uygulama kabuğunu (HTML/ikon/manifest) önbelleğe almak → hızlı açılış
 *   • İnternet yokken açılırsa şık bir "Çevrimdışı" sayfası göstermek
 *   • Sayfadan gelen istekle sistem bildirimi göstermek (17:00 hatırlatması)
 *   • Bildirime tıklanınca uygulamayı öne getirmek
 *  Not: Stok verileri SW ile değil, sayfadaki LocalStorage kuyruğu ile korunur.
 * ════════════════════════════════════════════════════════════ */

const SURUM = 'nilda-stok-v1';
const KABUK = ['./', './index.html', './manifest.json'];

const CEVRIMDISI_SAYFA = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Çevrimdışı</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FAEDCD;color:#2C1A14;
font-family:system-ui,sans-serif;text-align:center;padding:24px}.k{background:#fff;border-radius:24px;padding:32px;
max-width:420px;box-shadow:0 10px 30px rgba(44,26,20,.15)}h1{font-size:28px}p{font-size:20px;line-height:1.5}
button{font-size:22px;padding:16px 28px;border:0;border-radius:16px;background:#2C1A14;color:#FAEDCD}</style></head>
<body><div class="k"><div style="font-size:72px">📶</div><h1>İnternet bağlantısı yok</h1>
<p>Bağlantı gelince uygulama açılacak. Telefonda bekleyen stok girişleriniz <b>kaybolmaz</b>.</p>
<button onclick="location.reload()">🔄 Tekrar Dene</button></div></body></html>`;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SURUM)
      .then((c) => Promise.all(KABUK.map((u) => c.add(u).catch(() => null)))) // eksik dosya kurulumu bozmasın
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((anahtarlar) => Promise.all(anahtarlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET') return;
  const url = new URL(istek.url);

  // Google Apps Script çağrıları ve dış kaynaklar her zaman ağdan gelir
  if (url.origin !== self.location.origin) return;

  // Sayfa açılışı: önce ağ, olmazsa önbellek, o da yoksa çevrimdışı sayfası
  if (istek.mode === 'navigate') {
    e.respondWith(
      fetch(istek)
        .then((yanit) => {
          const kopya = yanit.clone();
          caches.open(SURUM).then((c) => c.put(istek, kopya));
          return yanit;
        })
        .catch(() => caches.match(istek)
          .then((k) => k || caches.match('./index.html'))
          .then((k) => k || new Response(CEVRIMDISI_SAYFA, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
    );
    return;
  }

  // Statik dosyalar: önbellekten hemen ver, arkada güncelle (stale-while-revalidate)
  e.respondWith(
    caches.match(istek).then((onbellek) => {
      const ag = fetch(istek).then((yanit) => {
        if (yanit && yanit.ok) caches.open(SURUM).then((c) => c.put(istek, yanit.clone()));
        return yanit;
      }).catch(() => onbellek);
      return onbellek || ag;
    })
  );
});

// Sayfa → SW: { tip: 'BILDIRIM', baslik, metin }
self.addEventListener('message', (e) => {
  const v = e.data || {};
  if (v.tip === 'BILDIRIM') {
    self.registration.showNotification(v.baslik || 'Nilda Stok', {
      body: v.metin || '',
      icon: v.ikon || undefined,
      badge: v.ikon || undefined,
      tag: v.etiket || 'nilda-hatirlatma',
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 150, 300]
    });
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((pencereler) => {
      const acik = pencereler.find((p) => 'focus' in p);
      return acik ? acik.focus() : self.clients.openWindow('./');
    })
  );
});
