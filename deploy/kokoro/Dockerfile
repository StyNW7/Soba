FROM python:3.12-slim-bookworm
WORKDIR /app
RUN pip install --no-cache-dir kokoro-onnx==0.6.1 onnxruntime==1.30.0 numpy==2.5.3 espeakng-loader==0.2.4
COPY server.py /app/server.py
USER 65532:65532
ENV PYTHONDONTWRITEBYTECODE=1 OMP_NUM_THREADS=2
CMD ["python", "/app/server.py"]
