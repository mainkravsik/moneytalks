from fastapi import APIRouter, Depends
from app.api.auth import get_tg_user

router = APIRouter()


@router.get("/health")
async def health(user: dict = Depends(get_tg_user)):
    return {"status": "ok", "user_id": user["id"]}
