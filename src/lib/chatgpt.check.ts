// ponytail: self-check for the pagination loop, run with `bun run src/lib/chatgpt.check.ts`
import { fetchAllConversations, type Conversation, type PageFetcher } from './chatgpt';

const ok = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
};

const conv = (id: string): Conversation => ({
  id,
  title: id,
  create_time: '',
  update_time: '',
});

/** Serves `ids` in pages of `limit`, echoing the real API's offset/total contract. */
const server = (ids: string[], calls: number[] = []): PageFetcher => {
  return async (offset, limit) => {
    calls.push(offset);
    return { items: ids.slice(offset, offset + limit).map(conv), total: ids.length };
  };
};

const paged = await fetchAllConversations(server(['a', 'b', 'c', 'd', 'e']), undefined, 2);
ok(paged.length === 5, `expected 5 conversations, got ${paged.length}`);
ok(paged.map((c) => c.id).join() === 'a,b,c,d,e', 'order not preserved');

// Overlapping pages (a chat moves while paging) must not produce duplicates,
// and the offset must still advance by items returned, not by unique items.
const calls: number[] = [];
const dupes = await fetchAllConversations(server(['a', 'a', 'b', 'b'], calls), undefined, 2);
ok(dupes.length === 2, `expected 2 unique, got ${dupes.length}`);
ok(calls.join() === '0,2', `expected offsets 0,2 — got ${calls.join()}`);

// A server that reports a total it can't fill must terminate, not spin.
const short: PageFetcher = async (offset) => ({
  items: offset === 0 ? [conv('a')] : [],
  total: 999,
});
ok((await fetchAllConversations(short)).length === 1, 'did not stop on empty page');

console.log('ok');
