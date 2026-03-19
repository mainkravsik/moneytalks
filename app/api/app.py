from fastapi import FastAPI
from app.api.routers.health import router as health_router

app = FastAPI(title="MoneyTalks API")
app.include_router(health_router, prefix="/api")
