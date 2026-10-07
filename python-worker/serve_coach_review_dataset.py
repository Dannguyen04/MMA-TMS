"""Serve one local review pack with byte ranges for seeking fragmented MP4s."""
import argparse
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re


def byte_range(header, size):
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", header)
    if not match or size <= 0 or not any(match.groups()):
        raise ValueError("Invalid range")
    left, right = match.groups()
    if left:
        start, end = int(left), min(int(right), size - 1) if right else size - 1
    else:
        length = int(right)
        if length <= 0:
            raise ValueError("Invalid suffix")
        start, end = max(0, size - length), size - 1
    if start >= size or start > end:
        raise ValueError("Unsatisfiable range")
    return start, end


class ReviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.remaining = None
        path = Path(self.translate_path(self.path))
        if not path.is_file() or not self.headers.get("Range"):
            return super().send_head()
        size = path.stat().st_size
        try:
            start, end = byte_range(self.headers["Range"], size)
        except ValueError:
            self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        stream = path.open("rb")
        stream.seek(start)
        self.remaining = end - start + 1
        self.send_response(HTTPStatus.PARTIAL_CONTENT)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self.remaining))
        self.end_headers()
        return stream

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def copyfile(self, source, outputfile):
        if self.remaining is None:
            return super().copyfile(source, outputfile)
        while self.remaining > 0:
            chunk = source.read(min(65536, self.remaining))
            if not chunk:
                break
            outputfile.write(chunk)
            self.remaining -= len(chunk)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--port", type=int, default=8768)
    args = parser.parse_args()
    directory = args.directory.resolve(strict=True)
    if not (directory / "review_index.json").is_file():
        parser.error("Directory must contain a generated review pack")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(ReviewHandler, directory=str(directory)))
    print(f"http://127.0.0.1:{args.port}/review.html", flush=True)
    server.serve_forever()
