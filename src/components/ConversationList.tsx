import { useMemo, useRef, useState } from 'react';
import {
  createPageFetcher,
  createPatcher,
  fetchAllConversations,
  getAccessToken,
  patchEach,
  rangeBetween,
  type Conversation,
  type ConversationPatch,
} from '@/lib/chatgpt';

export function ConversationList() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const anchor = useRef<number | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((c) => (c.title ?? '').toLowerCase().includes(q)) : items;
  }, [items, query]);

  const selectedCount = selected.size;
  const allVisibleSelected =
    visible.length > 0 && visible.every((c) => selected.has(c.id));

  function setMany(ids: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function onRowToggle(index: number, shiftKey: boolean) {
    const clicked = visible[index];
    const on = !selected.has(clicked.id);
    const rows =
      shiftKey && anchor.current !== null
        ? rangeBetween(visible, anchor.current, index)
        : [clicked];
    setMany(
      rows.map((c) => c.id),
      on,
    );
    if (!shiftKey) anchor.current = index;
  }

  function toggleAllVisible() {
    setMany(
      visible.map((c) => c.id),
      !allVisibleSelected,
    );
    anchor.current = null;
  }

  async function fetchAll() {
    setBusy(true);
    setStatus('Fetching…');
    try {
      const fetchPage = createPageFetcher(await getAccessToken());
      const all = await fetchAllConversations(fetchPage, (loaded, total) =>
        setStatus(`${loaded} / ${total}`),
      );
      setItems(all);
      setSelected(new Set());
      setStatus(`${all.length} conversations`);
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function apply(label: string, patch: ConversationPatch) {
    const ids = items.filter((c) => selected.has(c.id)).map((c) => c.id);
    if (ids.length === 0) return;
    if (
      'is_visible' in patch &&
      !confirm(`Delete ${ids.length} conversation${ids.length > 1 ? 's' : ''}? This cannot be undone.`)
    ) {
      return;
    }

    setBusy(true);
    try {
      const patchOne = createPatcher(await getAccessToken());
      const { ok, failed } = await patchEach(ids, patch, patchOne, (done, total) =>
        setStatus(`${label} ${done} / ${total}`),
      );
      const gone = new Set(ok);
      setItems((prev) => prev.filter((c) => !gone.has(c.id)));
      setSelected((prev) => new Set([...prev].filter((id) => !gone.has(id))));
      setStatus(
        failed.length
          ? `${label}: ${ok.length} done, ${failed.length} failed (${failed[0].error})`
          : `${label}: ${ok.length} done`,
      );
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
          e.preventDefault();
          setMany(
            visible.map((c) => c.id),
            true,
          );
        }
      }}
    >
      <div className="border-token-border-default flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={fetchAll}
          disabled={busy}
          className="btn btn-primary relative cursor-pointer rounded-full px-3 py-1 text-sm disabled:opacity-50"
        >
          Fetch all
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            anchor.current = null;
          }}
          placeholder="Search titles"
          className="border-token-border-default min-w-0 flex-1 rounded-full border bg-transparent px-3 py-1 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => apply('Archive', { is_archived: true })}
          disabled={busy || selectedCount === 0}
          className="border-token-border-default cursor-pointer rounded-full border px-3 py-1 text-sm disabled:opacity-40"
        >
          Archive
        </button>
        <button
          type="button"
          onClick={() => apply('Delete', { is_visible: false })}
          disabled={busy || selectedCount === 0}
          className="cursor-pointer rounded-full border border-red-500/50 px-3 py-1 text-sm text-red-500 disabled:opacity-40"
        >
          Delete
        </button>
      </div>

      <div className="border-token-border-default text-token-text-tertiary flex items-center gap-2 border-b px-3 py-1 text-xs">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            disabled={visible.length === 0}
          />
          All {visible.length !== items.length && `(${visible.length} shown)`}
        </label>
        <span className="ms-auto">
          {selectedCount > 0 && `${selectedCount} selected · `}
          {status}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1 text-sm">
        {visible.map((c, i) => (
          <label
            key={c.id}
            className="hover:bg-token-main-surface-secondary flex cursor-pointer items-baseline gap-2 rounded-lg px-2 py-1"
          >
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              // Shift-click only reaches onClick with the modifier intact; onChange loses it.
              onClick={(e) => {
                e.preventDefault();
                onRowToggle(i, e.shiftKey);
              }}
              onChange={() => {}}
            />
            <span className="truncate">{c.title || '(untitled)'}</span>
            <a
              href={`/c/${c.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-token-text-tertiary hover:text-token-text-primary ms-auto shrink-0 text-xs"
            >
              {c.update_time?.slice(0, 10)} ↗
            </a>
          </label>
        ))}
      </div>
    </div>
  );
}
