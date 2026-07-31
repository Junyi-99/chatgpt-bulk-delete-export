import { useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Rnd } from 'react-rnd';
import { ConversationList } from '@/components/ConversationList';

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
      <div className="cbde-drag border-token-border-default flex cursor-move items-center justify-between border-b px-3 py-2 text-sm font-semibold select-none">
        <span>Bulk delete &amp; export</span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-token-text-tertiary hover:text-token-text-primary cursor-pointer px-1 leading-none"
        >
          ✕
        </button>
      </div>
      <ConversationList />
    </Rnd>
  );
}

