const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('late tab queries, metadata and images cannot overwrite the current context', async () => {
  const queries = [], messages = [], images = [];
  let activate;
  const image = { style: {}, removeAttribute() { delete this.src; } };
  const title = { textContent: '' };
  const document = {
    addEventListener(event, callback) { this.ready = callback; },
    querySelectorAll: () => [], querySelector: () => null,
    getElementById: id => id === 'itemDetailsImage' ? image : id === 'productTitleText' ? title : null,
  };
  const window = { addEventListener() {}, EnvatoImageCache: {
    cacheImage: () => new Promise(resolve => images.push(resolve)),
    getImage: async () => null,
  }};
  const chrome = { runtime: {}, storage: { sync: { get: (_, cb) => cb({}) } }, tabs: {
    query: (_, cb) => queries.push(cb), sendMessage: (id, message, cb) => messages.push(cb),
    onActivated: { addListener: cb => { activate = cb; } }, onUpdated: { addListener() {} },
  }};
  const ctx = {window, document, chrome, URL, Blob, console};
  vm.runInNewContext(fs.readFileSync('envato-shared.js', 'utf8'), ctx);
  vm.runInNewContext(fs.readFileSync('sidepanel.js', 'utf8'), ctx); document.ready();
  const tab = id => [{id, url: `https://themeforest.net/item/test/${id}`}];
  activate(); queries[1](tab(2)); queries[0](tab(1));
  assert.equal(messages.length, 1);
  messages[0]({ title: 'Second', itemId: '2', isHighResImage: true, imageUrl: 'second.png' });
  activate(); queries[2](tab(3));
  images[0]({blob: 'stale.png'}); await new Promise(setImmediate);
  assert.equal(image.src, undefined);
  activate(); queries[3](tab(4));
  messages[1]({ title: 'Stale metadata' }); assert.notEqual(title.textContent, 'Stale metadata');
  messages[2]({ title: 'Fourth', itemId: '4', isHighResImage: true, imageUrl: 'fourth.png' });
  images[1]({blob: 'fourth.png'}); await new Promise(setImmediate);
  assert.equal(image.src, 'fourth.png'); assert.equal(title.textContent, 'Fourth');
});
