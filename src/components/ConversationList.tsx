import { useMemo, useRef, useState } from 'react';
import { Check } from '@/components/Check';
import {
  createPageFetcher,
  createPatcher,
  fetchAllConversations,
  patchEach,
  rangeBetween,
  type Conversation,
  type ConversationPatch,
} from '@/lib/chatgpt';

interface Progress {
  verb: string;
  done: number;
  total: number;
}

// Inline, like the rest of the layout: gap-*/inline-flex may not exist in the
// stylesheet we borrow from ChatGPT.
const actionStyle = (running: boolean) =>
  ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    // The running action is disabled too, but it shouldn't look dimmed out —
    // it's the one thing on screen the user is watching.
    opacity: running ? 1 : undefined,
  }) as const;

/** Swaps to "Deleting 12 / 40" with a filling ring while this action is the one running. */
function ActionLabel({
  idle,
  verb,
  progress,
}: {
  idle: string;
  verb: string;
  progress: Progress | null;
}) {
  if (progress?.verb !== verb) return <>{idle}</>;
  return (
    <>
      <Ring fraction={progress.total ? progress.done / progress.total : 0} />
      {verb} {progress.done} / {progress.total}
    </>
  );
}

function Ring({ fraction }: { fraction: number }) {
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="8" cy="8" r={radius} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <circle
        cx="8"
        cy="8"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        style={{ transition: 'stroke-dashoffset 120ms linear' }}
      />
    </svg>
  );
}

export function ConversationList() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [archived, setArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const anchor = useRef<number | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((c) => (c.title ?? '').toLowerCase().includes(q)) : items;
  }, [items, query]);

  // In the archive, the same button unarchives — nothing else about it changes.
  const archiveLabel = archived ? 'Unarchive' : 'Archive';
  const archiveVerb = archived ? 'Unarchiving' : 'Archiving';

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
    if (busy) return;
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

  /** Switching scope refetches: an archive list with Active's buttons is a trap. */
  function toggleArchived() {
    if (busy) return;
    const next = !archived;
    setArchived(next);
    setItems([]);
    setSelected(new Set());
    anchor.current = null;
    void fetchAll(next);
  }

  function toggleAllVisible() {
    if (busy) return;
    setMany(
      visible.map((c) => c.id),
      !allVisibleSelected,
    );
    anchor.current = null;
  }

  // `showArchived` is passed rather than read from state: the toggle fetches
  // immediately, before React has re-rendered with the new value.
  async function fetchAll(showArchived = archived) {
    setBusy(true);
    setStatus('Fetching…');
    try {
      const fetchPage = createPageFetcher(showArchived);
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

  async function apply(label: string, verb: string, patch: ConversationPatch) {
    const ids = items.filter((c) => selected.has(c.id)).map((c) => c.id);
    if (ids.length === 0) return;
    if (
      'is_visible' in patch &&
      !confirm(`Delete ${ids.length} conversation${ids.length > 1 ? 's' : ''}? This cannot be undone.`)
    ) {
      return;
    }

    setBusy(true);
    setStatus('');
    setProgress({ verb, done: 0, total: ids.length });
    try {
      const patchOne = createPatcher();
      const { ok, failed } = await patchEach(ids, patch, patchOne, (done, total) =>
        setProgress({ verb, done, total }),
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
      setProgress(null);
      setBusy(false);
    }
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      onKeyDown={(e) => {
        if (busy) return;
        // ⌘A inside the search box selects the text you just typed, not the list.
        if (e.target instanceof HTMLInputElement) return;
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
          onClick={() => fetchAll()}
          disabled={busy}
          className="btn btn-primary relative cursor-pointer rounded-full px-3 py-1 text-sm disabled:opacity-50"
        >
          Fetch all
        </button>
        <button
          type="button"
          role="checkbox"
          aria-checked={archived}
          onClick={toggleArchived}
          disabled={busy}
          style={actionStyle(false)}
          className="border-token-border-default cursor-pointer rounded-full border px-3 py-1 text-sm disabled:opacity-40"
        >
          <Check checked={archived} />
          Archived
        </button>
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            anchor.current = null;
          }}
          placeholder="Search titles"
          disabled={busy}
          className="border-token-border-default min-w-0 flex-1 rounded-full border bg-transparent px-3 py-1 text-sm outline-none"
        />
        <button
          type="button"
          onClick={() => apply(archiveLabel, archiveVerb, { is_archived: !archived })}
          disabled={busy || selectedCount === 0}
          style={actionStyle(progress?.verb === archiveVerb)}
          className="border-token-border-default cursor-pointer rounded-full border px-3 py-1 text-sm disabled:opacity-40"
        >
          <ActionLabel idle={archiveLabel} verb={archiveVerb} progress={progress} />
        </button>
        <button
          type="button"
          onClick={() => apply('Delete', 'Deleting', { is_visible: false })}
          disabled={busy || selectedCount === 0}
          style={actionStyle(progress?.verb === 'Deleting')}
          className="cursor-pointer rounded-full border border-red-500/50 px-3 py-1 text-sm text-red-500 disabled:opacity-40"
        >
          <ActionLabel idle="Delete" verb="Deleting" progress={progress} />
        </button>
      </div>

      <div className="border-token-border-default text-token-text-tertiary flex items-center gap-2 border-b px-3 py-1 text-xs">
        <button
          type="button"
          role="checkbox"
          aria-checked={allVisibleSelected}
          onClick={toggleAllVisible}
          disabled={busy || visible.length === 0}
          className="flex cursor-pointer items-center gap-2 disabled:opacity-40"
        >
          <Check checked={allVisibleSelected} />
          All {visible.length !== items.length && `(${visible.length} shown)`}
        </button>
        <span className="ms-auto">
          {selectedCount > 0 && `${selectedCount} selected · `}
          {status}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          // A running batch mutates items out from under the rows — don't let
          // clicks land on a list that's about to reshuffle.
          pointerEvents: busy ? 'none' : undefined,
          opacity: busy ? 0.5 : undefined,
        }}
        className="p-1 text-sm"
      >
        {visible.map((c, i) => (
          <div
            key={c.id}
            role="checkbox"
            aria-checked={selected.has(c.id)}
            tabIndex={0}
            onClick={(e) => onRowToggle(i, e.shiftKey)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                onRowToggle(i, e.shiftKey);
              }
            }}
            className="hover:bg-token-main-surface-secondary flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 select-none"
          >
            <Check checked={selected.has(c.id)} />
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
          </div>
        ))}
      </div>
    </div>
  );
}
