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

/** Same-origin session endpoint — never hardcode a Bearer token, it expires and it's a credential. */
export async function getAccessToken(): Promise<string> {
  const res = await fetch('/api/auth/session', { credentials: 'include' });
  if (!res.ok) throw new Error(`session ${res.status}`);
  const { accessToken } = await res.json();
  if (!accessToken) throw new Error('Not logged in to ChatGPT');
  return accessToken;
}

function accountId(): string | undefined {
  const raw = document.cookie.match(/(?:^|;\s*)_account=([^;]+)/)?.[1];
  return raw && decodeURIComponent(raw);
}

export function createPageFetcher(token: string): PageFetcher {
  return async (offset, limit) => {
    const res = await fetch(
      `/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated&is_archived=false&is_starred=false`,
      {
        credentials: 'include',
        headers: {
          accept: '*/*',
          authorization: `Bearer ${token}`,
          ...(accountId() ? { 'chatgpt-account-id': accountId()! } : {}),
        },
      },
    );
    if (!res.ok) throw new Error(`conversations ${res.status}`);
    return res.json();
  };
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
