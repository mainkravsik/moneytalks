from fastapi import FastAPI
from app.api.routers.health import router as health_router
from app.api.routers.categories import router as categories_router


def create_app(lifespan=None) -> FastAPI:
    """Factory function — creates the FastAPI instance with optional lifespan."""
    application = FastAPI(title="MoneyTalks API", lifespan=lifespan)
    application.include_router(health_router, prefix="/api")
    application.include_router(categories_router, prefix="/api")
    return application


# Default instance (no lifespan) — used by tests and direct imports
app = create_app()
