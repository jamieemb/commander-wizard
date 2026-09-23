"""Local dev server for Commander Wizard with caching disabled, so edits show on a normal refresh.
Usage: python serve.py [port]   (default 8080)
"""
import sys, http.server, socketserver, mimetypes

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/json", ".json")

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()
    def log_message(self, fmt, *args):
        pass  # keep the console quiet

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

if __name__ == "__main__":
    with Server(("127.0.0.1", PORT), NoCacheHandler) as httpd:
        print(f"Commander Wizard at http://127.0.0.1:{PORT}  (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
