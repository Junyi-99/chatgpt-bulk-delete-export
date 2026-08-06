# ChatGPT bulk delete & export

A Chrome extension that adds a panel to chatgpt.com for triaging conversations in
bulk. ChatGPT's own UI deletes one chat at a time, three clicks each; this lists
every conversation in your account, lets you select across them, and archives or
deletes the selection in one pass.

## What it does

**Fetch all conversations.** Pages `/backend-api/conversations` until the account
is exhausted, deduping by conversation id. The first response carries the total,
so the counter reads `100 / 2847` from the first tick rather than only making
sense at the end.

**Select across the whole list.** Click a row to toggle it, shift-click to extend
the range in either direction, `⌘/Ctrl+A` for everything visible. The select-all
checkbox is scoped to the current search, so `search "draft"` → select all →
Delete works as a single gesture. Selection survives changing the search.

**Search** filters titles as you type.

**Archived** switches the list to the archive and refetches, where the same
button unarchives instead of archiving. Deleting works there too.

**Archive** and **Delete** apply to the selection. Delete is behind a confirm and
cannot be undone. Both run five requests at a time and isolate failures — a 403
on one conversation doesn't abort the batch. A 429 or 5xx is retried with a
backoff (honoring `Retry-After`), and a 401 refetches the access token, since a
batch of a few thousand outlives both the rate-limit window and the token. The
running button shows a filling ring and a live count, the list is inert while it
runs, succeeded rows disappear, and anything that failed stays selected with the
error in the status line (`Delete: 38 done, 2 failed (403)`) — pressing the
button again retries exactly those.

## Install

[**Bulk Chat Manager for ChatGPT**](https://chromewebstore.google.com/detail/bulk-chat-manager-for-cha/lgbnjnejlebkcipdgomeildmeikgejhd)
on the Chrome Web Store.

To run from source:

```sh
bun install
bun run dev
```

Then in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** →
`.output/chrome-mv3-dev`. Leave `bun run dev` running; the extension hot-reloads.

`bun run build` produces a standalone `.output/chrome-mv3` for normal use. Don't
run it while the dev extension is loaded — it rewrites the directory underneath
Chrome, which errors the extension out.

Open the panel from the trash icon in the sidebar's **Recents** header, or from
the extension's toolbar icon. It's draggable and resizable.

## How it works

Everything runs in a content script on chatgpt.com, which buys two things: the
API calls are same-origin so the session cookie rides along, and the UI inherits
ChatGPT's own stylesheet and looks native in both themes.

The access token is read from `/api/auth/session` at runtime. Nothing is
persisted — no token, no conversation data, no storage of any kind.

Two consequences of living in the host page, both of which have bitten and are
commented at their call sites:

- We only get the Tailwind utilities ChatGPT's build generated. `min-h-0` isn't
  among them, so anything load-bearing for layout is an inline style.
- ChatGPT's modals (Radix) set `pointer-events: none` on `<body>`. The panel
  declares `pointer-events: auto` or clicks fall through to the page behind it.

The toolbar icon has no `default_popup` — that's what makes `action.onClicked`
fire, which messages the content script to toggle the panel. A popup-rendered
panel wouldn't work: an extension-origin page has none of ChatGPT's stylesheet,
and its cross-site requests wouldn't carry the `SameSite` session cookie.

The panel is mounted on `<body>` and the sidebar button only dispatches a toggle
event, so the two are independent. Collapsing the sidebar or navigating unmounts
that subtree; when the panel lived inside it, an open panel died with it — mid
batch, taking the progress and the final tally with it.

## Layout

```
src/lib/chatgpt.ts          API: auth, pagination, the batch pool
src/lib/chatgpt.check.ts    self-check — bun run src/lib/chatgpt.check.ts
src/components/             ConversationList, Check
src/entrypoints/content.tsx panel on <body>, sidebar button as a trigger
src/entrypoints/background.ts  toolbar icon → toggle message
```

`chatgpt.check.ts` covers the parts that break quietly: pagination against a
server whose totals shift mid-crawl, the worker pool's in-flight ceiling,
exactly-once handling and failure isolation, and which HTTP statuses are worth a
retry. Plain asserts, no test framework.

## Caveats

Built against ChatGPT's private API and its DOM. Both change without notice —
the sidebar anchor and the `/backend-api` shapes are the first things to check
when something stops working.
