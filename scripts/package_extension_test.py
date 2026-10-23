import shutil
import tempfile
import unittest
from pathlib import Path
import zipfile
from package_extension import ROOT, RUNTIME_FILES, build


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name) / 'source'
        for name in RUNTIME_FILES:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.output = Path(self.temp.name) / 'release.zip'

    def tearDown(self):
        self.temp.cleanup()

    def test_zip_contains_only_runtime_files_even_when_private_files_exist(self):
        for name in ['.env.local', '.git/config', '.playwright/profile/Cookies', 'scripts/private.log', 'node_modules/example.js']:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text('synthetic-private-data')
        build(self.root, self.output)
        with zipfile.ZipFile(self.output) as archive:
            self.assertEqual(set(archive.namelist()), set(RUNTIME_FILES))
            self.assertIn('manifest.json', archive.namelist())
            self.assertFalse(any(b'synthetic-private-data' in archive.read(name) for name in archive.namelist()))
        first = self.output.read_bytes()
        build(self.root, self.output)
        self.assertEqual(first, self.output.read_bytes())

    def test_symlink_cannot_include_a_private_file(self):
        file = self.root / 'sidepanel.js'
        file.unlink()
        secret = Path(self.temp.name) / 'private'
        secret.write_text('synthetic-private-data')
        try:
            file.symlink_to(secret)
        except OSError as error:
            if getattr(error, 'winerror', None) == 1314:
                self.skipTest('Windows does not grant this user symbolic-link creation privileges; Linux CI exercises this check.')
            raise
        with self.assertRaises(ValueError):
            build(self.root, self.output)
        self.assertFalse(self.output.exists())

    def test_missing_stylesheet_fails_before_publishing_a_zip(self):
        (self.root / 'sidepanel.css').unlink()
        with self.assertRaises(ValueError):
            build(self.root, self.output)
        self.assertFalse(self.output.exists())
