import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // Store title comes from here, not package.json. Chrome's branding policy wants
    // another product's name in a "for X" suffix, never leading.
    name: 'Bulk Chat Manager for ChatGPT',
    // No default_popup: the icon toggles the in-page panel via action.onClicked.
    action: { default_title: 'Bulk Chat Manager' },
    // No `permissions` block: the panel needs nothing beyond host access, and every
    // declared permission is a justification you owe the Web Store reviewer.
    host_permissions: ['https://chatgpt.com/*'],
  },
  // ponytail: Google blocks OAuth in automation-launched Chrome, so don't launch one.
  // Run `bun run dev`, then load .output/chrome-mv3 unpacked in your normal Chrome — it still hot-reloads.
  webExt: { disabled: true },
});
