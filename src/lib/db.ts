import type { Match, Player, Team } from '../types.ts'

const DB_NAME = 'directball'
const VERSION = 1

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of ['teams', 'players', 'matches']) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function all<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll()
    request.onsuccess = () => resolve(request.result as T[])
    request.onerror = () => reject(request.error)
  })
}

function put(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).put(value)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function remove(db: IDBDatabase, store: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readwrite').objectStore(store).delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function loadLibrary(): Promise<{ teams: Team[]; players: Player[]; matches: Match[] }> {
  const db = await open()
  const [teams, players, matches] = await Promise.all([
    all<Team>(db, 'teams'),
    all<Player>(db, 'players'),
    all<Match>(db, 'matches'),
  ])
  db.close()
  return { teams, players, matches }
}

export async function persist(store: 'teams' | 'players' | 'matches', value: Team | Player | Match) {
  const db = await open()
  await put(db, store, value)
  db.close()
}

export async function erase(store: 'teams' | 'players' | 'matches', id: string) {
  const db = await open()
  await remove(db, store, id)
  db.close()
}

export async function wipe() {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['teams', 'players', 'matches'], 'readwrite')
    tx.objectStore('teams').clear()
    tx.objectStore('players').clear()
    tx.objectStore('matches').clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
