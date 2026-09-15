import json
import re
import struct
import time
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np


class Handler(BaseHTTPRequestHandler):
    model = None
    synthesis_lock = threading.Lock()

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, *_):
        pass

    def do_GET(self):
        self.send_response(200 if self.path == '/health' and self.model else 404)
        self.end_headers()

    def do_POST(self):
        if self.path != '/synthesize':
            self.send_error(404)
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8192:
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            text = data.get('text') if isinstance(data, dict) else None
            if not isinstance(text, str) or not text.strip() or len(text) > 600:
                raise ValueError()
        except (ValueError, UnicodeError):
            self.send_error(400)
            return
        if not self.synthesis_lock.acquire(blocking=False):
            self.send_error(503)
            return
        try:
            started = time.monotonic()
            total = 0
            sent_headers = False
            for section in sections(text):
                if time.monotonic() - started > 55:
                    return
                samples, rate = self.model.create(section, voice='am_puck', speed=0.95, lang='en-us')
                total += len(samples)
                if rate != 24000 or not len(samples) or total > 90 * rate or not np.isfinite(samples).all():
                    raise ValueError()
                audio = (np.clip(samples, -1, 1) * 32767).astype('<i2').tobytes()
                if not sent_headers:
                    self.send_response(200)
                    self.send_header('Content-Type', 'application/x-soba-pcm-frames')
                    self.end_headers()
                    sent_headers = True
                self.wfile.write(struct.pack('>I', len(audio)) + audio)
                self.wfile.flush()
            self.wfile.write(struct.pack('>I', 0))
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            pass
        except Exception:
            if not sent_headers:
                self.send_error(500)
        finally:
            self.synthesis_lock.release()


def sections(text):
    for sentence in re.split(r'(?<=[.!?;])\s+', text.strip()):
        while len(sentence) > 120:
            boundary = sentence.rfind(' ', 0, 120)
            if boundary < 1:
                boundary = 120
            yield sentence[:boundary]
            sentence = sentence[boundary:].lstrip()
        if sentence:
            yield sentence


def main():
    import onnxruntime as ort
    from kokoro_onnx import Kokoro

    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    session = ort.InferenceSession('/models/kokoro-v1.0.onnx', sess_options=options, providers=['CPUExecutionProvider'])
    Handler.model = Kokoro.from_session(session, '/models/voices-v1.0.bin')
    Handler.model.create('Hello, I am Soba.', voice='am_puck', speed=0.95, lang='en-us')
    ThreadingHTTPServer(('0.0.0.0', 8000), Handler).serve_forever()


if __name__ == '__main__':
    main()
