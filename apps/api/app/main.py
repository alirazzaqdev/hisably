import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings

settings = get_settings()

# Until a real email/SMS provider is configured, OTPs are only delivered via
# this logger — make sure they actually reach stdout (and therefore the
# Vercel runtime logs) instead of being swallowed by the default WARNING
# root logger level (and the default "no handlers" setup in serverless).
_email_logger = logging.getLogger("hisably")
_email_logger.setLevel(logging.INFO)
if not _email_logger.handlers:
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    _email_logger.addHandler(_handler)

app = FastAPI(title=settings.app_name, debug=settings.debug)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}
