const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = { window: {}, URL };
vm.runInNewContext(fs.readFileSync('envato-shared.js', 'utf8'), context);
const shared = context.window.EnvatoXperienceShared;
test('marketplace matching accepts real hosts and rejects lookalikes and URL bait', () => {
  for (const value of ['themeforest.net', 'preview.themeforest.net', 'https://THEMEFOREST.NET/item/test/123']) assert.equal(shared.isEnvatoMarketplaceSite(value), true, value);
  for (const value of ['themeforest.net.example.org', 'not-themeforest.net', 'https://example.org/themeforest.net', 'https://themeforest.net@example.org', 'javascript:alert(1)', '']) assert.equal(shared.isEnvatoMarketplaceSite(value), false, value);
  assert.equal(shared.isEnvatoPreviewSite('https://themeforest.net/preview.themeforest.net'), false);
  assert.equal(shared.isEnvatoPreviewSite('https://preview.themeforest.net/item/test/123'), true);
});

test('canonical item URLs survive real preview routes without relying on header classes', () => {
  const preview='https://preview.themeforest.net/item/atomik/full_screen_preview/65057834?ref=test';
  assert.equal(shared.extractItemIdFromUrl(preview),'65057834');
  assert.equal(shared.getCanonicalItemUrl(preview),'https://themeforest.net/item/atomik/65057834');
  assert.equal(shared.getCanonicalItemUrl('https://themeforest.net/item/atomik/65057834/reviews'),'https://themeforest.net/item/atomik/65057834');
  assert.equal(shared.getCanonicalItemUrl('https://themeforest.net.attacker.test/item/test/123'),'');
});
