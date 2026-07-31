import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['storage'],
    host_permissions: ['https://chatgpt.com/*'],
  },
  // ponytail: Google blocks OAuth in automation-launched Chrome, so don't launch one.
  // Run `bun run dev`, then load .output/chrome-mv3 unpacked in your normal Chrome — it still hot-reloads.
  webExt: { disabled: true },
});
