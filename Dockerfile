# Stage 1: build the Next.js site to static HTML (web/out)
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
RUN npm run build

# Stage 2: the API, which serves the API, the widget, the site (/site) and the Savanna demo
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 WWM_ROOT=/app DB_PATH=/app/var/walkwithme.db
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api ./api
COPY data ./data
COPY scripts ./scripts
COPY widget ./widget
COPY savanna ./savanna
COPY --from=web /web/out ./web/out
RUN useradd --create-home --uid 10001 wwm && mkdir -p /app/var && chown -R wwm /app/var
USER wwm
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8000/healthz')"
CMD ["uvicorn", "app.main:app", "--app-dir", "api", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
