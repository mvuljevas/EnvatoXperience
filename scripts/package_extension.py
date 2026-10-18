"""Build a store ZIP from an explicit runtime allowlist; never archive the checkout."""
import json
from pathlib import Path
import re
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
RUNTIME_FILES = (
    'manifest.json', 'background.js', 'envato-shared.js', 'marketplace-init.js',
    'marketplace-overrides.css', 'image-cache.js', 'removed-items.js', 'content.js',
    'content.css', 'sidepanel.html', 'sidepanel.css', 'sidepanel.js', 'LICENSE',
    'THIRD_PARTY_NOTICES.md', 'assets/fonts/OFL.txt',
    'icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png',
    'assets/fonts/Oswald-Light.ttf', 'assets/fonts/Oswald-Regular.ttf',
    'assets/fonts/Oswald-Medium.ttf', 'assets/fonts/Oswald-SemiBold.ttf',
    'assets/icons/icon-sponsor.svg', 'assets/icons/icon-kofi.svg',
    'assets/icons/icon-paypal.svg', 'assets/images/envato-logo-dark.svg',
    'assets/images/envato-logo-light.svg', 'assets/images/not_envato.png',
)


def validate(root):
    root = Path(root).resolve()
    allowed = set(RUNTIME_FILES)
    for name in allowed:
        source = root / name
        if not source.is_file() or source.is_symlink():
            raise ValueError(f'Missing or unsafe runtime file: {name}')
        if any(parent.is_symlink() for parent in source.parents if parent != root and root in parent.parents):
            raise ValueError(f'Symlinked runtime directory: {name}')
        if not source.resolve().is_relative_to(root):
            raise ValueError(f'Runtime file outside project: {name}')
    manifest = json.loads((root / 'manifest.json').read_text())
    if manifest.get('manifest_version') != 3:
        raise ValueError('The package must use Manifest V3.')
    if len(manifest['description']) > 132:
        raise ValueError('Manifest description exceeds the store limit.')
    required = [manifest['background']['service_worker'], *manifest['icons'].values()]
    for script in manifest['content_scripts']:
        required.extend(script.get('js', []) + script.get('css', []))
    for resource in manifest['web_accessible_resources']:
        required.extend(name for name in resource['resources'] if '*' not in name)
    for name in required:
        if name not in allowed:
            raise ValueError(f'Manifest resource missing from allowlist: {name}')
    for name in allowed:
        if Path(name).suffix not in ('.html', '.css'):
            continue
        text = (root / name).read_text()
        references = re.findall(r'(?:src|href)=["\']([^"\']+)', text) if name.endswith('.html') else re.findall(r'url\(["\']?([^"\')]+)', text)
        for reference in references:
            if reference.startswith(('#', 'https:', 'http:', 'data:', 'mailto:')):
                continue
            target = (Path(name).parent / reference).as_posix()
            if target not in allowed:
                raise ValueError(f'Local resource missing from package: {target}')
    return manifest


def build(root, output):
    root, output = Path(root), Path(output)
    validate(root)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Atomic output avoids leaving a partially built release artifact.
    with tempfile.NamedTemporaryFile(dir=output.parent, suffix='.zip', delete=False) as temp:
        temporary = Path(temp.name)
    try:
        with zipfile.ZipFile(temporary, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for name in sorted(RUNTIME_FILES):
                info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, (root / name).read_bytes())
        temporary.replace(output)
    finally:
        temporary.unlink(missing_ok=True)
    return output


if __name__ == '__main__':
    manifest = validate(ROOT)
    output = ROOT / 'dist' / f'envato-xperience-{manifest["version"]}.zip'
    print(build(ROOT, output))
