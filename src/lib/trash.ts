import type { Conversation } from './chatgpt';

const KEY = 'cbde:trash';

// ponytail: newest 2000 entries, metadata only (~200 bytes each). localStorage is
// per-origin and dies with "clear site data" — move to chrome.storage.local if
// the trash ever needs to outlive that.
const MAX = 2000;

export interface TrashEntry extends Conversation {
  deleted_at: string;
}

export function loadTrash(): TrashEntry[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? (raw as TrashEntry[]) : [];
  } catch {
    return []; // corrupt or blocked storage shouldn't take the panel down
  }
}

export function saveTrash(entries: TrashEntry[]): TrashEntry[] {
  const capped = entries.slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(capped));
  return capped;
}

/** Newest first; re-deleting a conversation refreshes its entry rather than duplicating it. */
export function addToTrash(
  existing: TrashEntry[],
  deleted: Conversation[],
  deletedAt: string,
): TrashEntry[] {
  const fresh = deleted.map((c) => ({ ...c, deleted_at: deletedAt }));
  const ids = new Set(fresh.map((c) => c.id));
  return [...fresh, ...existing.filter((e) => !ids.has(e.id))];
}

export function removeFromTrash(existing: TrashEntry[], ids: Iterable<string>): TrashEntry[] {
  const drop = new Set(ids);
  return existing.filter((e) => !drop.has(e.id));
}
