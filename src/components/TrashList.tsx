import { useState } from 'react';
import { createPatcher, getAccessToken, patchEach } from '@/lib/chatgpt';
import { removeFromTrash, type TrashEntry } from '@/lib/trash';

export interface TrashListProps {
  entries: TrashEntry[];
  onChange: (entries: TrashEntry[]) => void;
}

export function TrashList({ entries, onChange }: TrashListProps) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  /** Delete is a server-side soft delete, so flipping is_visible back usually restores it. */
  async function restore(ids: string[]) {
    setBusy(true);
    try {
      const patchOne = createPatcher(await getAccessToken());
      const { ok, failed } = await patchEach(ids, { is_visible: true }, patchOne, (done, total) =>
        setStatus(`Restoring ${done} / ${total}`),
      );
      onChange(removeFromTrash(entries, ok));
      setStatus(
        failed.length
          ? `Restored ${ok.length}, ${failed.length} failed (${failed[0].error})`
          : `Restored ${ok.length} — reload ChatGPT to see them`,
      );
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-token-border-default text-token-text-tertiary flex items-center gap-2 border-b px-3 py-2 text-xs">
        <button
          type="button"
          onClick={() => restore(entries.map((e) => e.id))}
          disabled={busy || entries.length === 0}
          className="border-token-border-default cursor-pointer rounded-full border px-3 py-1 disabled:opacity-40"
        >
          Restore all
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm('Forget every entry? The conversations stay deleted on ChatGPT.')) {
              onChange([]);
              setStatus('');
            }
          }}
          disabled={busy || entries.length === 0}
          className="border-token-border-default cursor-pointer rounded-full border px-3 py-1 disabled:opacity-40"
        >
          Empty
        </button>
        <span className="ms-auto">{status || `${entries.length} in trash`}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-1 text-sm">
        {entries.length === 0 && (
          <p className="text-token-text-tertiary px-2 py-3 text-xs">
            Conversations you delete here are recorded so you keep a record of what went.
          </p>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            className="hover:bg-token-main-surface-secondary group/trash flex items-center gap-2 rounded-lg px-2 py-1"
          >
            <span className="truncate">{e.title || '(untitled)'}</span>
            <span className="text-token-text-tertiary ms-auto shrink-0 text-xs">
              {e.deleted_at.slice(0, 10)}
            </span>
            <button
              type="button"
              onClick={() => restore([e.id])}
              disabled={busy}
              className="text-token-text-tertiary hover:text-token-text-primary shrink-0 cursor-pointer text-xs disabled:opacity-40"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={() => onChange(removeFromTrash(entries, [e.id]))}
              disabled={busy}
              aria-label="Forget"
              className="text-token-text-tertiary hover:text-token-text-primary shrink-0 cursor-pointer text-xs disabled:opacity-40"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
