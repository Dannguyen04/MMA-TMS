from functools import partial
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from threading import Thread

import pytest

from serve_coach_review_dataset import ReviewHandler, byte_range


@pytest.mark.parametrize("header,expected", [
    ("bytes=0-0", (0, 0)), ("bytes=3-", (3, 9)),
    ("bytes=-3", (7, 9)), ("bytes=8-99", (8, 9)), ("bytes=-99", (0, 9)),
])
def test_media_byte_ranges(header, expected):
    assert byte_range(header, 10) == expected


@pytest.mark.parametrize("header", ["bytes=-", "bytes=-0", "bytes=10-", "bytes=4-2", "bytes=0-1,4-5"])
def test_invalid_ranges(header):
    with pytest.raises(ValueError):
        byte_range(header, 10)


def test_server_returns_exact_range_and_head(tmp_path):
    (tmp_path / "clip.mp4").write_bytes(b"0123456789")
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(ReviewHandler, directory=str(tmp_path)))
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    connection = HTTPConnection(*server.server_address, timeout=5)
    try:
        connection.request("GET", "/clip.mp4", headers={"Range": "bytes=3-6"})
        response = connection.getresponse()
        assert response.status == 206 and response.read() == b"3456"
        assert response.getheader("Content-Range") == "bytes 3-6/10"
        connection.request("HEAD", "/clip.mp4", headers={"Range": "bytes=-2"})
        response = connection.getresponse()
        assert response.status == 206 and response.read() == b""
        assert response.getheader("Content-Length") == "2"
        connection.request("GET", "/clip.mp4", headers={"Range": "bytes=30-"})
        response = connection.getresponse()
        assert response.status == 416 and response.read() == b""
    finally:
        connection.close()
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
