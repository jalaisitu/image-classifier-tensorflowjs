#!/usr/bin/env python3
"""Start this project's local preview with Python 3.9 or newer."""

import argparse
import errno
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import webbrowser


PROJECT_DIRECTORY = Path(__file__).resolve().parent
HOST = "127.0.0.1"
REQUIRED_FILES = (
    "index.html", "css/style.css", "js/script.js",
    "js/classifier.js", "js/model.js",
)


class ProjectHandler(SimpleHTTPRequestHandler):
    """Serve the project folder regardless of the terminal's current folder."""

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".css": "text/css",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_DIRECTORY), **kwargs)

    def list_directory(self, path):
        self.send_error(404, "Open /index.html to view the application.")
        return None

    def send_head(self):
        target = Path(self.translate_path(self.path)).resolve()
        try:
            relative_path = target.relative_to(PROJECT_DIRECTORY)
        except ValueError:
            self.send_error(404)
            return None

        if any(part.startswith(".") for part in relative_path.parts):
            self.send_error(404)
            return None

        return super().send_head()

    def end_headers(self):
        # Always reload edited files during local development.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def parse_port(value):
    try:
        port = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError("The port must be an integer.")
    if not 0 <= port <= 65535:
        raise argparse.ArgumentTypeError("Choose a port between 0 and 65535.")
    return port


def create_server(preferred_port):
    try:
        return ThreadingHTTPServer((HOST, preferred_port), ProjectHandler)
    except OSError as error:
        if error.errno != errno.EADDRINUSE:
            raise
        print(
            "El puerto {} esta ocupado. Se elegira otro puerto libre.".format(preferred_port),
            flush=True,
        )
        # The OS reserves a free port atomically; other servers keep running.
        return ThreadingHTTPServer((HOST, 0), ProjectHandler)


def open_browser(url):
    try:
        opened = webbrowser.open(url, new=2)
    except webbrowser.Error:
        opened = False
    if not opened:
        print("Abre el enlace de arriba en tu navegador.", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=parse_port, default=8001)
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()

    missing = [name for name in REQUIRED_FILES if not (PROJECT_DIRECTORY / name).is_file()]
    if missing:
        print("Faltan archivos: {}".format(", ".join(missing)), file=sys.stderr)
        print("Descomprime el proyecto completo antes de arrancarlo.", file=sys.stderr)
        return 1

    try:
        server = create_server(args.port)
    except OSError as error:
        print("No se ha podido abrir el servidor: {}".format(error), file=sys.stderr)
        return 1

    with server:
        url = "http://{}:{}/index.html".format(HOST, server.server_port)
        print("\nImage Classifier", flush=True)
        print("Carpeta: {}".format(PROJECT_DIRECTORY), flush=True)
        print("Abre: {}".format(url), flush=True)
        print("Deja esta terminal abierta. Para parar: Ctrl+C.\n", flush=True)
        if not args.no_browser:
            threading.Thread(target=open_browser, args=(url,), daemon=True).start()
        try:
            server.serve_forever(poll_interval=0.2)
        except KeyboardInterrupt:
            print("\nServidor detenido.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
