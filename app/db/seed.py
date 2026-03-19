"""Run once after first migration to populate default categories."""
import asyncio
from app.db.base import AsyncSessionLocal
from app.db.models import Category

DEFAULT_CATEGORIES = [
    ("🛒", "Продукты"),
    ("☕", "Кафе / рестораны"),
    ("🚗", "Транспорт"),
    ("🎭", "Развлечения"),
    ("🍺", "Пиво"),
    ("💊", "Здоровье"),
    ("👗", "Одежда"),
    ("🏠", "Дом / ЖКХ"),
    ("📱", "Связь / подписки"),
    ("🎁", "Подарки"),
]


async def seed():
    async with AsyncSessionLocal() as session:
        for emoji, name in DEFAULT_CATEGORIES:
            session.add(Category(name=name, emoji=emoji))
        await session.commit()
    print(f"Seeded {len(DEFAULT_CATEGORIES)} categories.")


if __name__ == "__main__":
    asyncio.run(seed())
