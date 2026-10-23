// Clic sur une notification de rappel : ferme la notification, puis met l'application au premier plan sur la rubrique 9 (ou l'ouvre si elle n'est plus ouverte).
// Chargé par le service worker généré (workbox.importScripts, vite.config.ts). Aucune donnée n'est envoyée nulle part.
const HOME = '/#/9'
/** Adresse à ouvrir : celle de la notification si elle reste sur le site de l'application, sinon la rubrique 9 (jamais une adresse extérieure ni un schéma inattendu). */
const target = data => {
  try {
    const u = new URL(data && typeof data.url === 'string' ? data.url : HOME, self.location.origin)
    if (u.origin === self.location.origin) return u.href
  } catch { /* adresse illisible : rubrique 9 */ }
  return new URL(HOME, self.location.origin).href
}
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = target(event.notification.data)
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const mine = all.find(c => new URL(c.url).origin === self.location.origin)
    if (mine) {
      try { if ('navigate' in mine) await mine.navigate(url) } catch { /* navigation refusée : on se contente de la mettre au premier plan */ }
      return mine.focus()
    }
    return self.clients.openWindow(url)
  })())
})
