const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {validateVersion, synchronize} = require('./version.cjs');
test('stable SemVer follows Chrome version constraints', () => {
  for (const v of ['1.0.0','0.1.0','65535.65535.65535']) assert.equal(validateVersion(v),v);
  for (const v of ['01.0.0','1.0','1.0.0.1','v1.0.0','1.0.0-beta','1.0.0+build','65536.0.0','0.0.0']) assert.throws(() => validateVersion(v));
});
test('npm release commands synchronize package, lockfile and manifest for each increment', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'envato-version-'));
  try {
    for (const file of ['package.json','package-lock.json','manifest.json']) fs.copyFileSync(file,path.join(dir,file));
    fs.mkdirSync(path.join(dir,'scripts')); fs.copyFileSync('scripts/version.cjs',path.join(dir,'scripts/version.cjs'));
    let [major,minor,patch] = require('../package.json').version.split('.').map(Number);
    for (const kind of ['patch','minor','major']) {
      if (kind === 'patch') patch++; else if (kind === 'minor') {minor++;patch=0;} else {major++;minor=0;patch=0;}
      execFileSync('npm',['run',`release:${kind}`],{cwd:dir,stdio:'pipe'});
      assert.equal(synchronize(dir,true),`${major}.${minor}.${patch}`);
    }
    const file=path.join(dir,'manifest.json'); const m=JSON.parse(fs.readFileSync(file));m.version='0.1.0';fs.writeFileSync(file,JSON.stringify(m));
    assert.throws(() => synchronize(dir,true));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
