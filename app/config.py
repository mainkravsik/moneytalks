from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from functools import lru_cache


class Settings(BaseSettings):
    bot_token: str
    ilya_tg_id: int
    alena_tg_id: int
    webhook_url: str
    webhook_secret: str = Field(min_length=16)

    database_url: str
    redis_url: str

    secret_key: str = Field(min_length=32)
    debug: bool = False
    debug_trigger_scheduler: str = ""
    cors_origins: list[str] = ["https://web.telegram.org"]

    @property
    def allowed_user_ids(self) -> set[int]:
        return {self.ilya_tg_id, self.alena_tg_id}

    model_config = SettingsConfigDict(env_file=".env")


@lru_cache
def get_settings() -> Settings:
    return Settings()
