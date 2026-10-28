/**
 * Envato XPerience - Background Script
 * Handles initial context and message relaying for the floating panel
 */

// Toggle the floating panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;

  chrome.tabs.sendMessage(tab.id, { action: "toggle_floating_panel" }).catch(() => {
    console.warn("[Envato XPerience] Content script not ready on this page yet.");
  });
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('[Envato XPerience] Extension installed and ready.');
});

// Widget context belongs to a tab, lives only in browser-session storage, and is never exposed to page scripts.
importScripts('envato-shared.js');
const widgetShared = globalThis.EnvatoXperienceShared;
const SOURCE_PREFIX = 'envatoWidgetSource:';
const CONTEXT_PREFIX = 'envatoWidgetContext:';
const WIDGET_TTL = 2 * 60 * 60 * 1000;
const sourceKey = id => `${SOURCE_PREFIX}${id}`;
const contextKey = id => `${CONTEXT_PREFIX}${id}`;
const fresh = entry => entry && Date.now() - entry.savedAt >= 0 && Date.now() - entry.savedAt < WIDGET_TTL;
const isWidgetKey = key => key.startsWith(SOURCE_PREFIX) || key.startsWith(CONTEXT_PREFIX);
// Discard only legacy widget metadata; preferences and the introduction state are preserved.
chrome.storage.local.remove(['activeEnvatoPreview', 'envatoWidgetProducts']).catch(() => {});

async function widgetMessage(request, sender) {
  const tabId = sender.tab?.id;
  if (tabId == null || sender.frameId !== 0) return null;
  const sourceUrl = new URL(sender.url);
  const canonical = widgetShared.getCanonicalItemUrl(sourceUrl.href);
  const itemId = widgetShared.extractItemIdFromUrl(canonical);
  const preview = widgetShared.isEnvatoPreviewSite(sourceUrl.hostname) || sourceUrl.pathname.includes('/full_screen_preview/');
  if (request.action === 'remember_widget_product') {
    if (!canonical || preview || request.product?.itemId !== itemId) return null;
    const currentTab = await chrome.tabs.get(tabId);
    if (currentTab.url && widgetShared.getCanonicalItemUrl(currentTab.url) !== canonical) return null;
    const key = sourceKey(tabId);
    const previous = (await chrome.storage.session.get(key))[key];
    const product = {};
    for (const field of ['itemId','title','description','imageUrl','author','authorUrl','avatarUrl','rating','ratingCount','createdAt','lastUpdate']) {
      if (typeof request.product[field] === 'string' && request.product[field]) product[field] = request.product[field].slice(0, 2000);
    }
    const entry = {...(fresh(previous) && previous.itemId === itemId ? previous : {}), ...product, itemUrl:canonical, savedAt:Date.now()};
    await chrome.storage.session.set({[key]:entry});
    return entry;
  }
  if (request.action === 'get_widget_product') {
    if (!canonical || !preview || request.itemId !== itemId) return null;
    const tab = await chrome.tabs.get(tabId);
    const keys = [sourceKey(tabId), ...(tab.openerTabId != null ? [sourceKey(tab.openerTabId)] : [])];
    const entries = await chrome.storage.session.get(keys);
    for (const key of keys) {
      const entry = entries[key];
      if (fresh(entry) && entry.itemUrl === canonical && entry.itemId === itemId) return entry;
      if (entry && !fresh(entry)) await chrome.storage.session.remove(key);
    }
    return null;
  }
  if (request.action === 'get_widget_item_page') {
    if (!preview || !canonical || widgetShared.getCanonicalItemUrl(request.url) !== canonical) return null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(canonical, {credentials:'omit', redirect:'error', signal:controller.signal});
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
      const html = await response.text();
      return {html:html.length <= 2_000_000 ? html : null};
    } finally { clearTimeout(timeout); }
  }
  if (request.action === 'set_widget_context') {
    if (!preview || !canonical || request.info?.itemId !== itemId || request.info.itemUrl !== canonical) return null;
    const target = new URL(request.targetUrl);
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) return null;
    const info = {...request.info, targetDomain:target.hostname, savedAt:Date.now(), timestamp:Date.now()};
    await chrome.storage.session.set({[contextKey(tabId)]:info});
    return info;
  }
  if (request.action === 'get_widget_context') {
    const key = contextKey(tabId);
    const info = (await chrome.storage.session.get(key))[key];
    if (fresh(info) && sourceUrl.hostname === info.targetDomain) return info;
    if (info) await chrome.storage.session.remove(key);
  }
  return null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!['remember_widget_product','get_widget_product','get_widget_item_page','set_widget_context','get_widget_context'].includes(request.action)) return;
  widgetMessage(request, sender).then(sendResponse).catch(() => sendResponse(null));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => {
  chrome.storage.session.remove([sourceKey(tabId), contextKey(tabId)]).catch(() => {});
});
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change.url) return;
  (async () => {
    const keys = [sourceKey(tabId), contextKey(tabId)];
    const entries = await chrome.storage.session.get(keys);
    const canonical = widgetShared.getCanonicalItemUrl(change.url);
    const hostname = new URL(change.url).hostname;
    const remove = [];
    if (entries[keys[0]] && (!fresh(entries[keys[0]]) || entries[keys[0]].itemUrl !== canonical)) remove.push(keys[0]);
    if (entries[keys[1]] && (!fresh(entries[keys[1]]) || entries[keys[1]].targetDomain !== hostname)) remove.push(keys[1]);
    if (remove.length) await chrome.storage.session.remove(remove);
  })().catch(() => {});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || changes.widgetMode?.newValue !== false) return;
  chrome.storage.session.get(null).then(entries => {
    const keys = Object.keys(entries).filter(isWidgetKey);
    return keys.length ? chrome.storage.session.remove(keys) : undefined;
  }).catch(() => {});
});
