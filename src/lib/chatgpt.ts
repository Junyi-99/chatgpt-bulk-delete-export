export interface Conversation {
  id: string;
  title: string;
  create_time: string;
  update_time: string;
}

export interface ConversationPage {
  items: Conversation[];
  total: number;
}

export type PageFetcher = (offset: number, limit: number) => Promise<ConversationPage>;

/** Hands out the access token, and re-reads it on demand when one ages out. */
export type TokenSource = (refresh?: boolean) => Promise<string>;

let cachedToken: string | null = null;

/**
 * Same-origin session endpoint — never hardcode a Bearer token, it expires and
 * it's a credential. Cached in memory only: a 500-conversation batch shouldn't
 * hit /api/auth/session 500 times.
 * ponytail: concurrent 401s each refresh separately, bounded by the pool size.
 */
export const getAccessToken: TokenSource = async (refresh = false) => {
  if (cachedToken && !refresh) return cachedToken;
  const res = await fetch('/api/auth/session', { credentials: 'include' });
  if (!res.ok) throw new Error(`session ${res.status}`);
  const { accessToken } = await res.json();
  if (!accessToken) throw new Error('Not logged in to ChatGPT');
  return (cachedToken = accessToken);
};

function accountId(): string | undefined {
  const raw = document.cookie.match(/(?:^|;\s*)_account=([^;]+)/)?.[1];
  return raw && decodeURIComponent(raw);
}

function authHeaders(token: string): Record<string, string> {
  const account = accountId();
  return {
    accept: '*/*',
    authorization: `Bearer ${token}`,
    ...(account ? { 'chatgpt-account-id': account } : {}),
  };
}

/** The only part of Response `retrying` looks at, so the self-check can fake it. */
export interface Sent {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Seconds per RFC 9110; ChatGPT sends a plain number. Capped — we're not waiting an hour. */
export function retryAfterMs(res: Sent): number | null {
  const seconds = Number(res.headers.get('retry-after'));
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 30) * 1000 : null;
}

/**
 * 429 and 5xx get a backoff, 401 gets a fresh token: a batch big enough to be
 * worth doing outlives both the rate-limit window and the access token.
 * Anything else (403, 404) won't answer differently on a second ask, so it's
 * returned as-is rather than retried three times for show.
 */
export async function retrying<T extends Sent>(
  send: (token: string) => Promise<T>,
  token: TokenSource,
  { tries = 3, baseDelay = 500 } = {},
): Promise<T> {
  let current = await token();
  for (let attempt = 1; ; attempt++) {
    const res = await send(current);
    if (res.ok || attempt >= tries) return res;
    if (res.status === 401) current = await token(true);
    else if (res.status === 429 || res.status >= 500) {
      await sleep(retryAfterMs(res) ?? baseDelay * 2 ** (attempt - 1));
    } else return res;
  }
}

/**
 * `archived: true` lists the archive instead of the active chats — the same
 * switch ChatGPT's own "Archived chats" dialog flips.
 * ponytail: no `is_starred` filter, since passing it false is a plausible way
 * to hide starred chats and omitting it is what the web app does.
 */
export function createPageFetcher(
  archived = false,
  token: TokenSource = getAccessToken,
): PageFetcher {
  return async (offset, limit) => {
    const res = await retrying(
      (t) =>
        fetch(
          `/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated&is_archived=${archived}`,
          { credentials: 'include', headers: authHeaders(t) },
        ),
      token,
    );
    if (!res.ok) throw new Error(`conversations ${res.status}`);
    return res.json();
  };
}

/** Archive keeps the chat, `is_visible: false` is what the UI calls Delete. */
export type ConversationPatch = { is_archived: boolean } | { is_visible: boolean };
export type Patcher = (id: string, patch: ConversationPatch) => Promise<void>;

export function createPatcher(token: TokenSource = getAccessToken): Patcher {
  return async (id, patch) => {
    const res = await retrying(
      (t) =>
        fetch(`/backend-api/conversation/${id}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { ...authHeaders(t), 'content-type': 'application/json' },
          body: JSON.stringify(patch),
        }),
      token,
    );
    if (!res.ok) throw new Error(`${res.status}`);
  };
}

export interface BatchResult {
  ok: string[];
  failed: { id: string; error: string }[];
}

/**
 * Runs `concurrency` requests at a time, never all at once: 500 parallel PATCHes
 * is a good way to collect 500 429s. One failure never aborts the rest.
 * ponytail: shared-cursor pool. Raise the default if ChatGPT tolerates more.
 */
export async function patchEach(
  ids: string[],
  patch: ConversationPatch,
  patchOne: Patcher,
  onProgress?: (done: number, total: number) => void,
  concurrency = 5,
): Promise<BatchResult> {
  const result: BatchResult = { ok: [], failed: [] };
  let cursor = 0;

  const worker = async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++]; // sync read-and-advance: no two workers get the same id
      try {
        await patchOne(id, patch);
        result.ok.push(id);
      } catch (e) {
        result.failed.push({ id, error: e instanceof Error ? e.message : String(e) });
      }
      onProgress?.(result.ok.length + result.failed.length, ids.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, worker),
  );
  return result;
}

/** Inclusive slice between two row indices, in either drag direction. */
export function rangeBetween<T>(rows: T[], anchor: number, index: number): T[] {
  const [from, to] = anchor <= index ? [anchor, index] : [index, anchor];
  return rows.slice(from, to + 1);
}

/** Pages until the server's `total` is reached, deduped by conversation id. */
export async function fetchAllConversations(
  fetchPage: PageFetcher,
  onProgress?: (loaded: number, total: number) => void,
  limit = 100,
): Promise<Conversation[]> {
  const byId = new Map<string, Conversation>();
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const page = await fetchPage(offset, limit);
    total = page.total;
    if (page.items.length === 0) break; // server disagrees with its own total
    for (const c of page.items) byId.set(c.id, c);
    offset += page.items.length; // server-side offset, not the deduped count
    onProgress?.(byId.size, total);
  }

  return [...byId.values()];
}
