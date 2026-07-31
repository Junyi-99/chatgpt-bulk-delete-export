import { TOGGLE_PANEL } from '@/lib/messages';

export default defineBackground(() => {
  // Fires only because there is no default_popup — the icon is a button, not a menu.
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id && tab.url?.startsWith('https://chatgpt.com/')) {
      await browser.tabs.sendMessage(tab.id, TOGGLE_PANEL);
    } else {
      await browser.tabs.create({ url: 'https://chatgpt.com/' });
    }
  });
});
