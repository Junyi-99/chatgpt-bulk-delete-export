# Privacy Policy — Bulk Chat Manager for ChatGPT

_Last updated: 31 July 2026_

## Summary

This extension collects nothing, stores nothing, and transmits nothing to
anybody. There is no server, no analytics, and no third party involved.

## What the extension accesses

It runs only on `https://chatgpt.com/*`. When you click **Fetch all**, it reads
your conversation list from ChatGPT's own API — the same API the ChatGPT web app
uses, with your existing browser session. When you click **Archive** or
**Delete**, it applies that change to the conversations you selected.

Conversation titles and dates are held in the page's memory to draw the list, and
are gone the moment you close the panel or reload the tab. Message contents are
never requested.

## Authentication

The access token is read from ChatGPT's `/api/auth/session` endpoint at the
moment of use and kept in memory only. It is never written to disk, never
persisted in extension storage, and never sent anywhere other than
`chatgpt.com`.

## Data sharing

None. No data leaves your browser, except the requests to `chatgpt.com` that you
explicitly trigger.

## Permissions

- `host_permissions: https://chatgpt.com/*` — required to read and modify your
  conversation list on your behalf. This is the extension's only permission.

## Deletion

Deleting a conversation through this extension is the same operation as deleting
it in ChatGPT's own interface, and is subject to OpenAI's data retention. This
extension keeps no copy and cannot restore anything.

## Contact

Open an issue at
https://github.com/Junyi-99/chatgpt-bulk-delete-export/issues
