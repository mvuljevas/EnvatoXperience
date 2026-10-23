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
  window.top = window;
  const document = {
    documentElement: {},
    addEventListener() {},
    querySelector: () => iframe,
  };
  const context = vm.createContext({
    window, document, URL, console,
    chrome: {
      runtime: { onMessage: { addListener() {} } },
      storage: { sync: { get() {} } },
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

test('widget context requires exact destination and a valid fresh timestamp', () => {
  const runtime = contentRuntime();
  let injected = 0;
  runtime.context.injectWidget = () => injected++;
  for (const [hostname, timestamp, expected] of [
    ['demo.example', Date.now(), 1],
    ['demo.example.evil.test', Date.now(), 0],
    ['notdemo.example', Date.now(), 0],
    ['demo.example', Date.now() - 3 * 60 * 60 * 1000, 0],
    ['demo.example', Date.now() + 60000, 0],
  ]) {
    injected = 0;
    runtime.destination.hostname = hostname;
    runtime.context.chrome.storage.local = { get: (_, callback) => callback({ activeEnvatoPreview: { targetDomain: 'demo.example', timestamp } }) };
    vm.runInContext('checkAndInjectWidget()', runtime.context);
    assert.equal(injected, expected);
  }
});
