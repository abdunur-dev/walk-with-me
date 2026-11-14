FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 WWM_ROOT=/app DB_PATH=/app/var/walkwithme.db
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api ./api
COPY data ./data
COPY scripts ./scripts
COPY widget ./widget
COPY site ./site
COPY savanna ./savanna
RUN useradd --create-home --uid 10001 wwm && mkdir -p /app/var && chown -R wwm /app/var
USER wwm
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/healthz')"
CMD ["uvicorn", "app.main:app", "--app-dir", "api", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
