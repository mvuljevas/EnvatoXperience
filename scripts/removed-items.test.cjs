const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('disabling stops list and pending observers; queued callbacks cannot transform items', () => {
  const observers = [];
  let scans = 0;
  let list = {};
  const root = { dataset: { envatoHideDeprecated: 'true' } };
  const window = { location: { pathname: '/downloads' } }; window.top = window;
  const document = { documentElement: root, body: {}, querySelector: () => list,
    querySelectorAll: () => { scans++; return []; } };
  class MutationObserver {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; this.connected = true; }
    disconnect() { this.connected = false; }
  }
  vm.runInNewContext(fs.readFileSync('removed-items.js', 'utf8'), {window, document, MutationObserver});
  window.EnvatoRemovedItems.initialize();
  const listObserver = observers.find(o => o.target === list);
  const rootObserver = observers.find(o => o.target === root);
  root.dataset.envatoHideDeprecated = 'false'; rootObserver.callback();
  assert.equal(listObserver.connected, false);
  const before = scans; listObserver.callback(); assert.equal(scans, before);
  list = null; root.dataset.envatoHideDeprecated = 'true'; rootObserver.callback();
  const pending = observers.find(o => o.target === document.body);
  assert.equal(pending.connected, true);
  root.dataset.envatoHideDeprecated = 'false'; rootObserver.callback();
  assert.equal(pending.connected, false);
  list = {}; root.dataset.envatoHideDeprecated = 'true'; rootObserver.callback();
  assert.ok(observers.some(o => o.target === list && o.connected));
});
