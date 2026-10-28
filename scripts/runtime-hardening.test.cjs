const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

function shared() {
  const context = vm.createContext({ window: {}, URL });
  vm.runInContext(readFileSync('envato-shared.js', 'utf8'), context);
  return context.window.EnvatoXperienceShared;
}

test('early styles are registered only for marketplace hosts', () => {
  const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
  for (const script of manifest.content_scripts.filter((entry) => entry.css?.length)) {
    assert.ok(!script.matches.includes('<all_urls>'));
    for (const pattern of script.matches) {
      assert.ok(shared().MARKETPLACE_HOSTS.includes(pattern.replace('*://*.', '').replace('/*', '')));
    }
  }
  assert.ok(manifest.content_scripts.some((entry) => entry.matches.includes('<all_urls>') && !entry.css));
});

test('early bootstrap leaves unrelated sites untouched even if invoked directly', () => {
  const window = { EnvatoXperienceShared: { isEnvatoMarketplaceSite: () => false } };
  window.top = window;
  // No document or chrome APIs are supplied: accessing either would fail this test.
  vm.runInNewContext(readFileSync('marketplace-init.js', 'utf8'), { window });
});

function contentRuntime() {
  let observerCallback;
  let iframe = null;
  let disconnected = false;
  const destination = { hostname: 'demo.example', href: '' };
  const window = { location: destination, addEventListener() {} };
  window.EnvatoFloatingWidget = { mount() {} };
  window.top = window;
  const document = {
    documentElement: {},
    addEventListener() {},
    querySelector: () => iframe,
  };
  const context = vm.createContext({
    window, document, URL, console,
    chrome: {
      runtime: { onMessage: { addListener() {} }, sendMessage: () => Promise.resolve(null) },
      storage: { onChanged: { addListener() {} }, sync: { get() {} } },
    },
    MutationObserver: class {
      constructor(callback) { observerCallback = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
    setTimeout: () => 1, clearTimeout() {},
  });
  vm.runInContext(readFileSync('content.js', 'utf8'), context);
  return { context, destination, setIframe(value) { iframe = value; }, mutate() { observerCallback(); }, disconnected: () => disconnected };
}

test('auto remove waits for a late iframe and its src, then disconnects', () => {
  const runtime = contentRuntime();
  vm.runInContext('openLivePreview(false)', runtime.context);
  runtime.setIframe({ getAttribute: () => null });
  runtime.mutate();
  assert.equal(runtime.destination.href, '');
  runtime.setIframe({ getAttribute: () => 'https://demo.example/live', src: 'https://demo.example/live' });
  runtime.mutate();
  assert.equal(runtime.destination.href, 'https://demo.example/live');
  assert.equal(runtime.disconnected(), true);
});

test('widget injection requests tab-scoped context from the trusted worker', async () => {
  const runtime = contentRuntime();
  const requests = [];
  let mounted = 0;
  runtime.context.window.EnvatoFloatingWidget.mount = () => mounted++;
  runtime.context.chrome.runtime.sendMessage = (message) => {
    requests.push(message.action);
    return Promise.resolve({itemId:'123'});
  };
  vm.runInContext('checkAndInjectWidget()', runtime.context);
  await Promise.resolve();
  assert.deepEqual(requests, ['get_widget_context']);
  assert.equal(mounted, 1);
  runtime.context.chrome.runtime.sendMessage = () => Promise.resolve(null);
  mounted = 0;
  vm.runInContext('checkAndInjectWidget()', runtime.context);
  await Promise.resolve();
  assert.equal(mounted, 0);
});
