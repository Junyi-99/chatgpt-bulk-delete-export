import { TOGGLE_PANEL } from '@/lib/messages';

export default defineBackground(() => {
  // Fires only because there is no default_popup — the icon is a button, not a menu.
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id && tab.url?.startsWith('https://chatgpt.com/')) {
      // A tab that was already open when the extension loaded has no content
      // script to talk to. Nothing to do but say so — swallowing this silently
      // makes a dead toolbar icon indistinguishable from a broken panel.
      await browser.tabs.sendMessage(tab.id, TOGGLE_PANEL).catch((e) => {
        console.warn('[bulk] no content script in this tab — reload chatgpt.com', e);
      });
    } else {
      await browser.tabs.create({ url: 'https://chatgpt.com/' });
    }
  });
});
