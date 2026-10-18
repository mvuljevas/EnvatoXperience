const fs = require('node:fs');
const path = require('node:path');

function validateVersion(version) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Version must use stable SemVer X.Y.Z without prefixes or suffixes.');
  }
  if (version.split('.').some(part => Number(part) > 65535) || version === '0.0.0') {
    throw new Error('Chrome requires components between 0 and 65535 and a nonzero version.');
  }
  return version;
}

function synchronize(root, check = false) {
  const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  const version = validateVersion(read('package.json').version);
  const manifest = read('manifest.json');
  if (check) {
    const lock = read('package-lock.json');
    if (manifest.version !== version || lock.version !== version || lock.packages[''].version !== version) {
      throw new Error('Versions differ. Use npm run release:patch, release:minor or release:major.');
    }
  } else {
    manifest.version = version;
    const file = path.join(root, 'manifest.json');
    const source = fs.readFileSync(file, 'utf8');
    fs.writeFileSync(file, source.replace(/("version"\s*:\s*)"[^"]*"/, (_, prefix) => prefix + JSON.stringify(version)));
  }
  return version;
}

if (require.main === module) {
  console.log(`Extension version: ${synchronize(path.resolve(__dirname, '..'), process.argv.includes('--check'))}`);
}
module.exports = { validateVersion, synchronize };
