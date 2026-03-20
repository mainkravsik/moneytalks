import json
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from aiogram.types import Update

from app.api.app import create_app
from app.bot.bot import create_bot, create_dispatcher
from app.config import get_settings

settings = get_settings()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

TELEGRAM_SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token"


@asynccontextmanager
async def lifespan(app: FastAPI):
    bot = create_bot()
    dp = create_dispatcher()

    try:
        await bot.set_webhook(settings.webhook_url, secret_token=settings.webhook_secret)
        logger.info(f"Webhook set to {settings.webhook_url}")
    except Exception:
        logger.exception("Failed to set webhook — check BOT_TOKEN and WEBHOOK_URL")
        raise

    app.state.bot = bot
    app.state.dp = dp

    from app.bot.scheduler import create_scheduler
    scheduler = create_scheduler(bot)
    scheduler.start()
    app.state.scheduler = scheduler

    yield

    scheduler.shutdown(wait=False)

    try:
        await bot.delete_webhook()
    finally:
        await bot.session.close()


async def webhook_handler(request: Request) -> Response:
    # Validate Telegram secret token before processing
    token = request.headers.get(TELEGRAM_SECRET_HEADER)
    if token != settings.webhook_secret:
        return Response(status_code=403)

    body = await request.body()
    update = Update.model_validate(json.loads(body))
    bot = request.app.state.bot
    dp = request.app.state.dp
    await dp.feed_update(bot, update)
    return Response()


# Build the production app with lifespan
fastapi_app = create_app(lifespan=lifespan)

# Add webhook route
fastapi_app.add_api_route("/webhook", webhook_handler, methods=["POST"])

# CORS middleware — restrict to Telegram Mini App origins
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run(fastapi_app, host="0.0.0.0", port=8000, reload=settings.debug)
