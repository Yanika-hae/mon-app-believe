// Doublures partagées par les tests d'interface qui touchent au micro et à IndexedDB (dictaphone, auto-écoute de l'académie).
import { vi } from 'vitest'

/** Nombre d'éléments d'un magasin IndexedDB, lu directement (-1 si la base ou le magasin n'existe pas). */
export const idbCount = (store: string) => new Promise<number>((res, rej) => {
  const r = indexedDB.open('BelieveAudioDB')
  r.onsuccess = () => {
    const db = r.result
    if (!db.objectStoreNames.contains(store)) { db.close(); return res(-1) }
    const q = db.transaction(store).objectStore(store).count()
    q.onsuccess = () => { db.close(); res(q.result) }; q.onerror = () => rej(q.error)
  }
  r.onerror = () => rej(r.error)
})
export const wipeDb = () => new Promise<void>(res => { const q = indexedDB.deleteDatabase('BelieveAudioDB'); q.onsuccess = q.onerror = q.onblocked = () => res() })

export class FakeMR {
  static last: FakeMR | null = null
  static isTypeSupported = (t: string) => t === 'audio/webm;codecs=opus'
  state = 'inactive'; mimeType: string
  ondataavailable: ((e: { data: Blob }) => void) | null = null; onstop: (() => void) | null = null; onerror: (() => void) | null = null
  constructor(public stream: unknown, o?: { mimeType?: string }) { this.mimeType = o?.mimeType ?? ''; FakeMR.last = this }
  start() { this.state = 'recording' }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob([new Uint8Array(1200)]) }); this.onstop?.() }
}
/** Faux micro : compte les demandes d'accès et les arrêts de piste ; `reject` simule un refus. */
export function micStub(reject?: string) {
  const tracks = [{ stop: vi.fn(), onended: null as null | (() => void) }]
  const gum = vi.fn(async () => { if (reject) { const e = new Error(reject); e.name = reject; throw e } return { getTracks: () => tracks, getAudioTracks: () => tracks } })
  vi.stubGlobal('MediaRecorder', FakeMR)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: gum } })
  return { gum, tracks }
}
