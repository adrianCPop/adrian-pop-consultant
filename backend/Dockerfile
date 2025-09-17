# backend/Dockerfile

# 1) Base
FROM python:3.11-slim

# 2) Env
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# 3) Workdir
WORKDIR /app

# 4) System deps (only what's needed to build wheels)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
  && rm -rf /var/lib/apt/lists/*

# 5) Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir -r requirements.txt

# 6) App code
COPY . .

# 7) Non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 8) Port
EXPOSE 8000

# 9) Healthcheck (Python; no curl needed)
# Make sure server.py exposes GET /health returning 200
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health', timeout=5).status==200 else 1)"

# 10) Entrypoint
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
