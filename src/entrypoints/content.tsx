import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Rnd } from 'react-rnd';
import { ConversationList } from '@/components/ConversationList';
import { TrashList } from '@/components/TrashList';
import { addToTrash, loadTrash, saveTrash, type TrashEntry } from '@/lib/trash';

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  main(ctx) {
    const ui = createIntegratedUi(ctx, {
      position: 'inline',
      // The "Recents" header button group. Anchored off the Organize-chats button
      // because the group's own classes are generated and change between builds.
      anchor: () =>
        document.querySelector('[aria-label="Organize chats"]')?.parentElement ??
        document.querySelector('a[aria-label="New chat"]')?.parentElement,
      append: 'first',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<Toolbar />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    ui.autoMount();
  },
});

function Toolbar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Bulk delete & export"
        title="Bulk delete & export"
        className="__menu-item-trailing-btn __menu-item-trailing-icon-action interactive-label-secondary text-inherit transition-opacity focus-visible:opacity-100"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="icon-sm"
          >
            <path d="M4 6h12M8 6V4.5h4V6M6.5 6l.6 9a1 1 0 0 0 1 1h3.8a1 1 0 0 0 1-1l.6-9" />
          </svg>
        </div>
      </button>
      {open && createPortal(<Panel onClose={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'chats' | 'trash'>('chats');
  const [trash, setTrash] = useState<TrashEntry[]>(loadTrash);

  return (
    <Rnd
      default={{ x: 320, y: 96, width: 520, height: 400 }}
      minWidth={320}
      minHeight={220}
      bounds="window"
      dragHandleClassName="cbde-drag"
      style={{ zIndex: 2147483000, position: 'fixed' }}
      className="bg-token-main-surface-primary text-token-text-primary border-token-border-default flex flex-col overflow-hidden rounded-2xl border shadow-lg"
    >
      <div className="cbde-drag border-token-border-default flex cursor-move items-center gap-1 border-b px-3 py-2 text-sm select-none">
        <Tab active={tab === 'chats'} onClick={() => setTab('chats')}>
          Conversations
        </Tab>
        <Tab active={tab === 'trash'} onClick={() => setTab('trash')}>
          Trash{trash.length > 0 && ` (${trash.length})`}
        </Tab>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-token-text-tertiary hover:text-token-text-primary ms-auto cursor-pointer px-1 leading-none"
        >
          ✕
        </button>
      </div>
      {tab === 'chats' ? (
        <ConversationList
          onDeleted={(deleted) =>
            setTrash((prev) => saveTrash(addToTrash(prev, deleted, new Date().toISOString())))
          }
        />
      ) : (
        <TrashList entries={trash} onChange={(next) => setTrash(saveTrash(next))} />
      )}
    </Rnd>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full px-3 py-0.5 ${
        active
          ? 'bg-token-main-surface-secondary font-semibold'
          : 'text-token-text-tertiary hover:text-token-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

