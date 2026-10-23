// IndexedDB : enregistrements audio (base BelieveAudioDB, magasin « audios ») et images de plats (« dishes »).
// Les données binaires sont stockées en ArrayBuffer (compatible avec tous les navigateurs, y compris Safari).
export const DB_NAME = 'BelieveAudioDB'
const VER = 3
/** Description d'un enregistrement : légère, lue à chaque affichage de la liste (les données audio, elles, sont lues à la demande). */
export interface AudioMeta { id: string; title: string; cat: string; t: number; ms: number; type: string; size: number }
export interface AudioRec extends AudioMeta { data: ArrayBuffer }
export interface DishRec { id: string; t: number; type: string; data: ArrayBuffer }

let dbp: Promise<IDBDatabase> | null = null
export const hasIDB = () => typeof indexedDB !== 'undefined'
const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
const fin = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('abort')) })

function open(): Promise<IDBDatabase> {
  if (!hasIDB()) return Promise.reject(new Error('unsupported'))
  if (dbp) return dbp
  dbp = new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB_NAME, VER)
    r.onupgradeneeded = () => {
      const db = r.result, tx = r.transaction!
      if (!db.objectStoreNames.contains('audios')) db.createObjectStore('audios', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('dishes')) db.createObjectStore('dishes', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('audioMeta')) { // version 3 : descriptions séparées des données, reconstruites depuis les enregistrements existants
        const m = db.createObjectStore('audioMeta', { keyPath: 'id' })
        tx.objectStore('audios').openCursor().onsuccess = ev => {
          const c = (ev.target as IDBRequest<IDBCursorWithValue | null>).result
          if (!c) return
          const { data, ...meta } = c.value as AudioRec
          m.put({ ...meta, size: data?.byteLength ?? 0 }); c.continue()
        }
      }
    }
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); dbp = null }; res(db) }
    r.onerror = () => { dbp = null; rej(r.error) }
    r.onblocked = () => { dbp = null; rej(new Error('blocked')) }
  })
  return dbp
}
type Name = 'audios' | 'dishes' | 'audioMeta'
const store = async (name: Name, mode: IDBTransactionMode) => { const tx = (await open()).transaction(name, mode); return { tx, os: tx.objectStore(name) } }
const both = async (mode: IDBTransactionMode) => { const tx = (await open()).transaction(['audios', 'audioMeta'], mode); return { tx, a: tx.objectStore('audios'), m: tx.objectStore('audioMeta') } }
const metaOf = (a: Omit<AudioRec, 'size'>): AudioMeta => ({ id: a.id, title: a.title, cat: a.cat, t: a.t, ms: a.ms, type: a.type, size: a.data.byteLength })

/** Enregistre un audio (données et description dans une seule transaction) ; la promesse n'est tenue qu'une fois la transaction terminée. */
export async function putAudio(a: Omit<AudioRec, 'size'>): Promise<void> { const { tx, a: os, m } = await both('readwrite'); const meta = metaOf(a); os.put({ ...a, size: meta.size }); m.put(meta); await fin(tx) }
/** Descriptions de tous les audios, du plus récent au plus ancien (sans les données). */
export async function listAudios(): Promise<AudioMeta[]> { const { os } = await store('audioMeta', 'readonly'); return ((await req(os.getAll())) as AudioMeta[]).sort((a, b) => b.t - a.t) }
/** Un audio complet, ou undefined s'il n'existe pas. */
export async function getAudio(id: string): Promise<AudioRec | undefined> { const { os } = await store('audios', 'readonly'); return (await req(os.get(id))) as AudioRec | undefined }
/** Change le titre d'un audio ; renvoie true seulement si la modification est écrite. */
export async function renameAudio(id: string, title: string): Promise<boolean> {
  const { tx, a, m } = await both('readwrite')
  const rec = (await req(a.get(id))) as AudioRec | undefined
  if (!rec) { tx.abort(); return false }
  const n = { ...rec, title }; a.put(n); m.put(metaOf(n))
  try { await fin(tx); return true } catch { return false }
}
/** Supprime un audio et vérifie qu'il n'existe plus nulle part ; renvoie true seulement si la suppression est confirmée. */
export async function delAudio(id: string): Promise<boolean> {
  const w = await both('readwrite'); w.a.delete(id); w.m.delete(id); await fin(w.tx)
  const r = await both('readonly'); return (await req(r.a.get(id))) === undefined && (await req(r.m.get(id))) === undefined
}
export async function putDish(d: DishRec): Promise<void> { const { tx, os } = await store('dishes', 'readwrite'); os.put(d); await fin(tx) }
export async function getDish(id: string): Promise<DishRec | undefined> { const { os } = await store('dishes', 'readonly'); return (await req(os.get(id))) as DishRec | undefined }
export async function delDish(id: string): Promise<boolean> {
  const w = await store('dishes', 'readwrite'); w.os.delete(id); await fin(w.tx)
  const r = await store('dishes', 'readonly'); return (await req(r.os.get(id))) === undefined
}
/** Nombre d'éléments par magasin (pour l'aperçu de la suppression et les tests). */
export async function countIDB(): Promise<{ audios: number; dishes: number }> {
  if (!hasIDB()) return { audios: 0, dishes: 0 }
  const a = await store('audios', 'readonly'), d = await store('dishes', 'readonly')
  return { audios: await req(a.os.count()), dishes: await req(d.os.count()) }
}

/** Droit à l'oubli : ferme la connexion puis supprime toute la base ; vrai seulement si la suppression est confirmée. */
export async function wipeIDB(): Promise<boolean> {
  if (!hasIDB()) return true
  try {
    if (dbp) { try { (await dbp).close() } catch { /* déjà fermée */ } dbp = null }
    const ok = await new Promise<boolean>(res => {
      const r = indexedDB.deleteDatabase(DB_NAME), t = setTimeout(() => res(false), 4000) // bloquée par un autre onglet ouvert
      r.onsuccess = () => { clearTimeout(t); res(true) }
      r.onerror = () => { clearTimeout(t); res(false) }
    })
    if (!ok) return false
    const l: { name?: string }[] | null = (indexedDB as unknown as { databases?: () => Promise<{ name?: string }[]> }).databases ? await (indexedDB as unknown as { databases: () => Promise<{ name?: string }[]> }).databases() : null
    return !l || !l.some(d => d.name === DB_NAME)
  } catch { return false }
}
/** Convertit un Blob en ArrayBuffer (FileReader si Blob.arrayBuffer est absent). */
export const toBuf = (b: Blob): Promise<ArrayBuffer> =>
  typeof b.arrayBuffer === 'function' ? b.arrayBuffer() : new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(f.result as ArrayBuffer); f.onerror = () => rej(f.error); f.readAsArrayBuffer(b) })
