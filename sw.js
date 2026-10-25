// Service worker: funciona sem internet, pega a versão nova sozinho e avisa das tarefas pendentes.
importScripts("dados.js", "agenda.js", "db.js");

const CACHE = "zelador-" + CONFIG.versao;
const ARQUIVOS = ["./", "index.html", "app.js", "dados.js", "agenda.js", "db.js", "manifest.webmanifest",
  "logo-maison-lafitte.svg", "icone-192.png", "icone-512.png",
  ...REGA.flatMap(g => g.fotos.map(f => f.src))];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", ev => {
  ev.waitUntil(caches.keys()
    .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

// Primeiro tenta a internet (versão mais nova); sem internet, usa a cópia guardada
self.addEventListener("fetch", ev => {
  if (ev.request.method !== "GET" || new URL(ev.request.url).origin !== location.origin) return;
  ev.respondWith(fetch(ev.request, { cache: "no-cache" })
    .then(resp => {
      const copia = resp.clone();
      caches.open(CACHE).then(c => c.put(ev.request, copia));
      return resp;
    })
    .catch(() => caches.match(ev.request, { ignoreSearch: true })));
});

async function avisarPendentes() {
  const estado = (await DB.ler("estado")) || {};
  estado.inicio = estado.inicio || CONFIG.inicio;
  const pend = Agenda.pendentesTodas(TAREFAS, estado, new Date());
  if (self.navigator.setAppBadge) pend.length ? self.navigator.setAppBadge(pend.length) : self.navigator.clearAppBadge();
  if (!pend.length) return;
  const hora = new Date().getHours();
  if (hora < 7 || hora > 20) return;
  await self.registration.showNotification("Maison Lafitte · tarefa pendente", {
    body: pend.map(t => t.titulo).join(", ") + ". Toque para abrir.",
    icon: "icone-192.png", badge: "icone-192.png", tag: "pendentes", renotify: true, requireInteraction: true,
  });
}

self.addEventListener("periodicsync", ev => {
  if (ev.tag === "tarefas") ev.waitUntil(avisarPendentes());
});

self.addEventListener("notificationclick", ev => {
  ev.notification.close();
  ev.waitUntil(self.clients.matchAll({ type: "window" }).then(abertas => {
    if (abertas.length) return abertas[0].focus();
    return self.clients.openWindow("./");
  }));
});
