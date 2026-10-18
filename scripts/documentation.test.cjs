const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('user and contributor guides link to existing local documents and assets', () => {
  for (const file of ['README.md','CONTRIBUTING.md','PRIVACY.md','THIRD_PARTY_NOTICES.md','docs/DEVELOPMENT.md']) {
    const source=fs.readFileSync(file,'utf8');
    for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
      const target=match[1];
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      assert.ok(fs.existsSync(path.resolve(path.dirname(file),target.split('#')[0])),`${file}: ${target}`);
    }
  }
});
