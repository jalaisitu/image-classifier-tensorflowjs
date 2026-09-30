"""Regression tests for the wrong-folder and occupied-port startup failures."""

from pathlib import Path
import os
import re
import selectors
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from urllib.error import HTTPError
from urllib.request import urlopen


PROJECT = Path(__file__).resolve().parents[1]


class StartupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.temp.cleanup)
        cls.occupied = socket.socket()
        cls.addClassCleanup(cls.occupied.close)
        cls.occupied.bind(('127.0.0.1', 0))
        cls.occupied.listen()
        cls.busy_port = cls.occupied.getsockname()[1]
        cls.process = subprocess.Popen(
            [sys.executable, '-u', str(PROJECT / 'start.py'),
             '--port', str(cls.busy_port), '--no-browser'],
            cwd=cls.temp.name,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        cls.addClassCleanup(cls.stop_server)
        selector = selectors.DefaultSelector()
        selector.register(cls.process.stdout, selectors.EVENT_READ)
        output = ''
        deadline = time.monotonic() + 8
        try:
            while time.monotonic() < deadline:
                if not selector.select(timeout=0.2):
                    continue
                # Read the pipe directly so buffered lines cannot stall select().
                chunk = os.read(cls.process.stdout.fileno(), 4096).decode('utf-8')
                if not chunk:
                    break
                output += chunk
                match = re.search(r'http://127\.0\.0\.1:(\d+)/index\.html', output)
                if match:
                    cls.base = 'http://127.0.0.1:' + match.group(1)
                    cls.actual_port = int(match.group(1))
                    return
        finally:
            selector.close()
        raise AssertionError('Server did not print its URL: ' + output)

    @classmethod
    def stop_server(cls):
        if cls.process.poll() is None:
            cls.process.send_signal(signal.SIGINT)
            try:
                cls.process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                cls.process.kill()
                cls.process.communicate()
        else:
            cls.process.communicate()

    def test_wrong_working_directory_and_busy_port(self):
        self.assertNotEqual(self.actual_port, self.busy_port)
        with urlopen(self.base + '/', timeout=3) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), (PROJECT / 'index.html').read_bytes())

    def test_assets_have_correct_content_and_types(self):
        for path, mime in [('/css/style.css', 'text/css'),
                           ('/js/script.js', 'text/javascript'),
                           ('/js/model.js', 'text/javascript'),
                           ('/js/classifier.js', 'text/javascript')]:
            with self.subTest(path=path), urlopen(self.base + path, timeout=3) as response:
                self.assertIn(mime, response.headers['Content-Type'])
                self.assertEqual(response.headers['Cache-Control'], 'no-store')
                self.assertEqual(response.read(), (PROJECT / path.lstrip('/')).read_bytes())

    def test_directory_listing_and_hidden_files_are_not_served(self):
        for path in ['/docs/', '/.gitignore']:
            with self.subTest(path=path):
                with self.assertRaises(HTTPError) as error:
                    urlopen(self.base + path, timeout=3)
                self.assertEqual(error.exception.code, 404)
                error.exception.close()

    def test_incomplete_project_exits_with_instructions(self):
        with tempfile.TemporaryDirectory() as folder:
            script = Path(folder) / 'start.py'
            shutil.copy2(PROJECT / 'start.py', script)
            result = subprocess.run(
                [sys.executable, str(script), '--no-browser'],
                capture_output=True, text=True, timeout=5,
            )
            self.assertEqual(result.returncode, 1)
            self.assertIn('Faltan archivos:', result.stderr)
            self.assertIn('index.html', result.stderr)


if __name__ == '__main__':
    unittest.main()
