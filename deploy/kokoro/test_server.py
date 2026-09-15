import http.client
import json
import struct
import threading
import unittest
from http.server import ThreadingHTTPServer
from types import SimpleNamespace

import numpy as np
from server import Handler, sections


class ServerTest(unittest.TestCase):
    def setUp(self):
        def create(text, **kwargs):
            self.assertEqual(kwargs, dict(voice='am_puck', speed=0.95, lang='en-us'))
            return np.array([0.5, -0.5]), 24000
        Handler.model = SimpleNamespace(create=create)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()

    def request(self, payload):
        conn = http.client.HTTPConnection(*self.server.server_address, timeout=3)
        conn.request('POST', '/synthesize', json.dumps(payload), {'Content-Type': 'application/json'})
        response = conn.getresponse()
        result = response.status, response.read()
        conn.close()
        return result

    def test_sections(self):
        text = "A quiet night. " + "soft " * 50
        parts = list(sections(text))
        self.assertTrue(all(0 < len(p) <= 120 for p in parts))
        self.assertEqual(" ".join(parts), text.strip())

    def test_pcm(self):
        status, body = self.request({'text': 'Hello'})
        self.assertEqual(status, 200)
        self.assertEqual(body, struct.pack('>I', 4) + np.array([16383, -16383], dtype='<i2').tobytes() + struct.pack('>I', 0))

    def test_invalid_input(self):
        for payload in [{}, {'text': ''}, {'text': 'x'*601}, [], {'text': 3}]:
            self.assertEqual(self.request(payload)[0], 400)

    def test_busy(self):
        Handler.synthesis_lock.acquire()
        try:
            self.assertEqual(self.request({'text': 'Hello'})[0], 503)
        finally:
            Handler.synthesis_lock.release()

    def test_invalid_audio(self):
        Handler.model = SimpleNamespace(create=lambda *a, **kw: (np.array([float('nan')]), 24000))
        self.assertEqual(self.request({'text': 'Hello'})[0], 500)


if __name__ == '__main__':
    unittest.main()
