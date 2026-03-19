from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    bot_token: str
    ilya_tg_id: int
    alena_tg_id: int
    webhook_url: str

    database_url: str
    redis_url: str

    secret_key: str
    debug: bool = False
    debug_trigger_scheduler: str = ""

    @property
    def allowed_user_ids(self) -> set[int]:
        return {self.ilya_tg_id, self.alena_tg_id}

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
