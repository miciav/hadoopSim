"""Serve the built site locally, including parallel stylesheet requests."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class PreviewServer(ThreadingHTTPServer):
    # Browsers request the page, modules and skin stylesheets concurrently.
    request_queue_size = 128


if __name__ == "__main__":
    handler = partial(SimpleHTTPRequestHandler, directory="dist")
    with PreviewServer(("127.0.0.1", 5173), handler) as server:
        server.serve_forever()
