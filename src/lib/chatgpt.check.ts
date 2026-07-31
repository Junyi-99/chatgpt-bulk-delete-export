// ponytail: self-check for the pagination loop, run with `bun run src/lib/chatgpt.check.ts`
import {
  fetchAllConversations,
  patchEach,
  rangeBetween,
  type Conversation,
  type PageFetcher,
  type Patcher,
} from './chatgpt';

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

// One bad id must not take the rest of the batch down with it.
const seen: string[] = [];
const flaky: Patcher = async (id) => {
  seen.push(id);
  if (id === 'b') throw new Error('403');
};
const batch = await patchEach(['a', 'b', 'c'], { is_visible: false }, flaky);
ok(seen.toSorted().join() === 'a,b,c', `every id must be attempted, got ${seen.join()}`);
ok(batch.ok.toSorted().join() === 'a,c', `expected a,c to succeed — got ${batch.ok.join()}`);
ok(batch.failed.length === 1 && batch.failed[0].error === '403', 'failure not reported');

// The pool must keep exactly `concurrency` requests in flight — no more (rate
// limits) and no accidental serialization, and every id handled exactly once.
let inFlight = 0;
let peak = 0;
const handled: string[] = [];
const slow: Patcher = async (id) => {
  inFlight++;
  peak = Math.max(peak, inFlight);
  await new Promise((r) => setTimeout(r, 1));
  handled.push(id);
  inFlight--;
};
const many = Array.from({ length: 20 }, (_, i) => `id${i}`);
const pooled = await patchEach(many, { is_archived: true }, slow, undefined, 4);
ok(peak === 4, `expected 4 in flight, peaked at ${peak}`);
ok(handled.length === 20, `expected 20 handled, got ${handled.length}`);
ok(new Set(handled).size === 20, 'an id was handled twice');
ok(pooled.ok.length === 20 && pooled.failed.length === 0, 'pooled results wrong');

// A pool of one is still sequential and in order.
const serial: string[] = [];
await patchEach(['a', 'b', 'c'], { is_archived: true }, async (id) => {
  serial.push(id);
}, undefined, 1);
ok(serial.join() === 'a,b,c', `concurrency 1 must stay ordered, got ${serial.join()}`);

// Fewer ids than workers must not spawn idle workers or hang.
ok((await patchEach(['solo'], { is_archived: true }, async () => {}, undefined, 8)).ok.length === 1,
  'short batch broke');

// Shift-range works in both directions and includes both endpoints.
const rows = ['a', 'b', 'c', 'd'];
ok(rangeBetween(rows, 1, 3).join() === 'b,c,d', 'forward range wrong');
ok(rangeBetween(rows, 3, 1).join() === 'b,c,d', 'backward range wrong');
ok(rangeBetween(rows, 2, 2).join() === 'c', 'single-row range wrong');

console.log('ok');
