import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Rnd } from 'react-rnd';
import { ConversationList } from '@/components/ConversationList';
import { TOGGLE_PANEL, TOGGLE_PANEL_EVENT } from '@/lib/messages';

export default defineContentScript({
  matches: ['https://chatgpt.com/*'],
  main(ctx) {
    // The toolbar icon and the sidebar button drive the same panel. Bridging
    // through a DOM event keeps the listener alive across sidebar re-mounts.
    const toggle = () => window.dispatchEvent(new Event(TOGGLE_PANEL_EVENT));
    browser.runtime.onMessage.addListener((message) => {
      if (message === TOGGLE_PANEL) toggle();
    });

    // The panel hangs off <body>, not off the sidebar. ChatGPT unmounts that
    // subtree when you collapse it or navigate, which used to take an open
    // panel down mid-batch and leave the toolbar icon with nothing listening.
    const panelUi = createIntegratedUi(ctx, {
      position: 'inline',
      anchor: 'body',
      onMount: (container) => {
        const root = createRoot(container);
        root.render(<PanelHost />);
        return root;
      },
      onRemove: (root) => root?.unmount(),
    });
    // WXT drops the wrapper at the end of <body> and leaves it unstyled, which
    // puts its static position below ChatGPT's full-height app root — and a
    // `fixed` child with no top/left renders from there, i.e. off-screen. Pin
    // the wrapper to the viewport origin; zero-sized, so it blocks nothing.
    Object.assign(panelUi.wrapper.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '0',
      height: '0',
    });
    panelUi.mount();

    // The sidebar button is a shortcut, not the owner of anything: if this
    // anchor ever stops existing, the toolbar icon still opens the panel.
    try {
      createIntegratedUi(ctx, {
        position: 'inline',
        // The "Recents" header button group. Anchored off the Organize-chats button
        // because the group's own classes are generated and change between builds.
        // XPath, not `.parentElement`: autoMount throws outright on an anchor
        // function that returns an Element, which it does as soon as the sidebar
        // is already rendered when we start — every SPA navigation and reload.
        anchor: () =>
          document.querySelector('[aria-label="Organize chats"]')
            ? '//*[@aria-label="Organize chats"]/..'
            : '//a[@aria-label="New chat"]/..',
        append: 'first',
        onMount: (container) => {
          const root = createRoot(container);
          root.render(<SidebarButton onClick={toggle} />);
          return root;
        },
        onRemove: (root) => root?.unmount(),
      }).autoMount();
    } catch (e) {
      // Never let the decoration take the panel down with it.
      console.warn('[bulk] sidebar button not mounted', e);
    }
  },
});

function PanelHost() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen((v) => !v);
    window.addEventListener(TOGGLE_PANEL_EVENT, toggle);
    return () => window.removeEventListener(TOGGLE_PANEL_EVENT, toggle);
  }, []);

  return open ? <Panel onClose={() => setOpen(false)} /> : null;
}

function SidebarButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Bulk delete & export"
      title="Bulk delete & export"
      className="__menu-item-trailing-btn __menu-item-trailing-icon-action interactive-label-secondary text-inherit transition-opacity focus-visible:opacity-100"
      onClick={onClick}
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
  );
}

function Panel({ onClose }: { onClose: () => void }) {
  return (
    <Rnd
      // `bounds` only constrains dragging, so the initial x has to fit the
      // window itself — a narrow one used to open the panel half off-screen.
      default={{
        x: Math.max(8, Math.min(320, window.innerWidth - 540)),
        y: 96,
        width: 520,
        height: 400,
      }}
      minWidth={320}
      minHeight={220}
      bounds="window"
      dragHandleClassName="cbde-drag"
      // Layout inline rather than via classes: we borrow ChatGPT's stylesheet, so
      // any utility their build didn't generate (min-h-0, notably) silently no-ops.
      style={{
        zIndex: 2147483000,
        position: 'fixed',
        // Without these, `fixed` starts from wherever the element would have
        // landed in normal flow, and react-rnd's translate goes from there.
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // ChatGPT's modals (Radix) park `pointer-events: none` on <body> and
        // re-enable it only inside the dialog. We live in body, so without this
        // every click passes through to whatever is behind us.
        pointerEvents: 'auto',
      }}
      className="bg-token-main-surface-primary text-token-text-primary border-token-border-default rounded-2xl border shadow-lg"
    >
      <div className="cbde-drag border-token-border-default flex cursor-move items-center gap-1 border-b px-3 py-2 text-sm font-semibold select-none">
        <span>Bulk delete &amp; export</span>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="text-token-text-tertiary hover:text-token-text-primary ms-auto cursor-pointer px-1 leading-none"
        >
          ✕
        </button>
      </div>
      <ConversationList />
    </Rnd>
  );
}
