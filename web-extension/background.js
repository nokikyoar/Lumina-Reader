const MENU_QUOTE = 'lumina-quote-to-chat';
const MENU_HIGHLIGHT = 'lumina-highlight-create';
const MENU_NOTE = 'lumina-note-create';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_QUOTE,
    title: 'Lumina: Quote to Chat',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: MENU_HIGHLIGHT,
    title: 'Lumina: Create Highlight',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: MENU_NOTE,
    title: 'Lumina: Create Note Highlight',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const text = (info.selectionText || '').trim();
  if (!text) return;
  const frameId = typeof info.frameId === 'number' ? info.frameId : undefined;

  if (info.menuItemId === MENU_QUOTE) {
    const msg = { type: 'bridge-action', action: 'quote.toChat', text };
    if (frameId != null) chrome.tabs.sendMessage(tab.id, msg, { frameId });
    else chrome.tabs.sendMessage(tab.id, msg);
    return;
  }

  if (info.menuItemId === MENU_HIGHLIGHT) {
    const msg = { type: 'bridge-action', action: 'highlight.create', text };
    if (frameId != null) chrome.tabs.sendMessage(tab.id, msg, { frameId });
    else chrome.tabs.sendMessage(tab.id, msg);
    return;
  }

  if (info.menuItemId === MENU_NOTE) {
    const msg = { type: 'bridge-action', action: 'note.create', text, note: '' };
    if (frameId != null) chrome.tabs.sendMessage(tab.id, msg, { frameId });
    else chrome.tabs.sendMessage(tab.id, msg);
  }
});