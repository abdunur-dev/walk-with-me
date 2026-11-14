"""Walk With Me API. Serves the REST API, the widget, the site pages and the Savanna demo pages."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import db, retrieval
from .common import ApiError, ensure_env_staff, error_response
from .config import ROOT, settings
from .routers import channels, handoff, jobs, public

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("wwm")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    log.info("seeded %s", db.seed())
    retrieval.rebuild()
    ensure_env_staff()
    if not settings.staff_token:
        log.warning("STAFF_TOKEN is not set: the staff console and teacher view are locked")
    tasks = []
    if settings.run_background:
        from .jobs import scheduler
        from .telegram import bot
        tasks = scheduler.start()
        await bot.start()
    yield
    for t in tasks:
        t.cancel()
    if settings.run_background:
        from .telegram import bot
        await bot.stop()


app = FastAPI(
    title="Walk With Me API",
    version="1.0.0",
    description="Help widget for Savanna pages: grounded answers in Amharic and English, human help, jobs and alerts. "
                "Errors always use {\"error\": {\"code\", \"message\", \"fix\"}}.",
    lifespan=lifespan,
)


@app.middleware("http")
async def cors_and_headers(request: Request, call_next):
    """Public endpoints allow any origin (the widget runs on other sites and on file://) and use no cookies.
    Staff and teacher endpoints get no CORS headers, so browsers block cross-origin access."""
    path = request.url.path
    private = path.startswith("/v1/staff") or path.startswith("/v1/teacher")
    if request.method == "OPTIONS" and path.startswith("/v1/") and not private:
        resp = JSONResponse({}, status_code=204)
    else:
        resp = await call_next(request)
    if path.startswith("/v1/") and not private:
        resp.headers["Access-Control-Allow-Origin"] = "*"
        resp.headers["Access-Control-Allow-Methods"] = "GET, POST, DELETE, OPTIONS"
        resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
        resp.headers["Access-Control-Max-Age"] = "600"
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return resp


@app.exception_handler(ApiError)
async def api_error(_: Request, e: ApiError):
    return error_response(e.status, e.code, e.message, e.fix)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, e: RequestValidationError):
    first = e.errors()[0] if e.errors() else {}
    field = ".".join(str(x) for x in first.get("loc", [])[1:]) or "request"
    return error_response(422, "invalid_input", f"The {field} field is not valid: {first.get('msg', 'check it')}.",
                          "Check that field and try again.")


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, e: StarletteHTTPException):
    page = ROOT / "site" / "404.html"
    if e.status_code == 404 and not request.url.path.startswith("/v1/") and page.exists():
        return FileResponse(page, status_code=404)
    return error_response(e.status_code, "http_error", str(e.detail), "Check the address and try again.")


@app.exception_handler(Exception)
async def server_error(request: Request, e: Exception):
    log.exception("unhandled error on %s", request.url.path)
    page = ROOT / "site" / "500.html"
    if not request.url.path.startswith("/v1/") and page.exists():
        return FileResponse(page, status_code=500)
    return error_response(500, "server_error", "Something went wrong on the server.", "Try again in a minute.")


for r in (public.router, handoff.router, jobs.router, channels.router):
    app.include_router(r)


@app.get("/healthz", tags=["meta"])
def healthz():
    with db.tx() as c:
        c.execute("SELECT 1")
    return {"ok": True}


@app.get("/", include_in_schema=False)
def home():
    return RedirectResponse("/site/index.html")


for name in ("site", "widget", "savanna"):
    app.mount(f"/{name}", StaticFiles(directory=ROOT / name, html=True), name=name)
