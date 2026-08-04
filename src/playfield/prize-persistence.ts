import type { PrizeState } from './prize-manifest'

export interface PrizePersistenceSnapshot {
  readonly manifestRevision: string
  readonly prizes: readonly PrizeState[]
}

export interface PrizePersistenceStore {
  readonly load: (manifestRevision: string) => PrizePersistenceSnapshot | null
  readonly save: (snapshot: PrizePersistenceSnapshot) => void
  readonly clear: (manifestRevision: string) => void
}

const memoryStore = new Map<string, string>()
const PLAYER_NAMESPACE = 'claw-app:player:prizes:'

function storage(): Storage | null {
  if (typeof globalThis.localStorage === 'undefined') return null
  return globalThis.localStorage
}

function key(revision: string): string {
  return `${PLAYER_NAMESPACE}${revision}`
}

function read(keyValue: string): string | null {
  return storage()?.getItem(keyValue) ?? memoryStore.get(keyValue) ?? null
}

function write(keyValue: string, value: string): void {
  const target = storage()
  if (target) target.setItem(keyValue, value)
  memoryStore.set(keyValue, value)
}

function remove(keyValue: string): void {
  storage()?.removeItem(keyValue)
  memoryStore.delete(keyValue)
}

export function createPrizePersistenceStore(): PrizePersistenceStore {
  return {
    load: (manifestRevision) => {
      const raw = read(key(manifestRevision))
      if (!raw) return null
      try {
        const parsed = JSON.parse(raw) as PrizePersistenceSnapshot
        if (
          parsed.manifestRevision !== manifestRevision ||
          !Array.isArray(parsed.prizes)
        ) {
          return null
        }
        return {
          manifestRevision,
          prizes: parsed.prizes.map((prize) => ({
            ...prize,
            position: [...prize.position] as unknown as PrizeState['position'],
            orientation: {
              quaternion: [...prize.orientation.quaternion] as unknown as PrizeState['orientation']['quaternion'],
            },
          })),
        }
      } catch {
        return null
      }
    },
    save: (snapshot) => {
      write(key(snapshot.manifestRevision), JSON.stringify(snapshot))
    },
    clear: (manifestRevision) => remove(key(manifestRevision)),
  }
}

/** Test/dev helper; player data remains in its own namespace. */
export function clearPrizePersistence(manifestRevision: string): void {
  remove(key(manifestRevision))
}
