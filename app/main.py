import json
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from aiogram.types import Update

from app.api.app import app as fastapi_app
from app.bot.bot import create_bot, create_dispatcher
from app.config import get_settings

settings = get_settings()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    bot = create_bot()
    dp = create_dispatcher()

    await bot.set_webhook(settings.webhook_url)
    logger.info(f"Webhook set to {settings.webhook_url}")

    app.state.bot = bot
    app.state.dp = dp

    yield

    await bot.delete_webhook()
    await bot.session.close()


async def webhook_handler(request: Request) -> Response:
    body = await request.body()
    update = Update.model_validate(json.loads(body))
    bot = request.app.state.bot
    dp = request.app.state.dp
    await dp.feed_update(bot, update)
    return Response()


# Attach lifespan to the existing FastAPI instance
fastapi_app.router.lifespan_context = lifespan

# Add webhook route
fastapi_app.add_api_route("/webhook", webhook_handler, methods=["POST"])

# CORS middleware (Mini App needs this)
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    uvicorn.run("main:fastapi_app", host="0.0.0.0", port=8000, reload=settings.debug)
