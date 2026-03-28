# MoneyTalks

Семейный бюджет-трекер для двоих (Илья и Алёна). Telegram Mini App + бот.

## Стек

- **Backend:** Python 3.12, FastAPI, aiogram 3, SQLAlchemy 2.0 (async), Alembic, APScheduler, Pydantic
- **Frontend:** React 18, TypeScript, Vite, Zustand, Axios, @telegram-apps/sdk + telegram-ui
- **БД:** PostgreSQL 16 (prod), SQLite in-memory (тесты)
- **Деплой:** Docker Compose, nginx (reverse proxy + SSL), certbot (Let's Encrypt)
- **Сервер:** VPS 79.110.227.22, путь `/root/moneytalks`

## Структура проекта

```
app/                    # Backend
  main.py               # Entrypoint: FastAPI + webhook + scheduler
  config.py             # Pydantic Settings из .env
  Dockerfile            # python:3.12-slim, PYTHONPATH=/
  requirements.txt
  api/
    app.py              # FastAPI factory
    auth.py             # Валидация Telegram initData
    deps.py             # get_db dependency
    routers/            # health, transactions, categories, budget, piggy, loans
    schemas/            # Pydantic request/response модели
  bot/
    bot.py              # Bot + Dispatcher (MemoryStorage для FSM)
    scheduler.py        # APScheduler (MemoryJobStore)
    handlers/           # start, add, budget_cmd, piggy_cmd, debt_cmd
    middlewares/auth.py # WhitelistMiddleware
  db/
    base.py             # async engine + sessionmaker
    models.py           # User, Transaction, Category, BudgetPeriod, BudgetLimit, PiggyBank, PiggyContribution, Loan
    seed.py             # Сидинг категорий
    migrations/         # Alembic
  services/             # budget, cache, notifications, payoff, period, period_db
frontend/               # React SPA (Telegram Mini App)
  src/
    App.tsx             # Навигация по табам
    pages/              # Dashboard, Budget, History, Piggy, Loans
    components/         # AddTransactionModal, CategoryCard, PiggyCard, и др.
    store/budget.ts     # Zustand store
    api/                # Axios клиенты (client.ts, budget.ts, loans.ts, piggy.ts)
tests/                  # pytest + pytest-asyncio
nginx.conf              # Reverse proxy: статика + /api/ + /webhook
docker-compose.yml      # app, postgres, nginx, certbot
```

## Команды разработки

### Backend
```bash
# Запуск локально
cd app && python -m main

# Тесты
pytest tests/ -v

# Новая миграция
cd app && alembic revision --autogenerate -m "description"

# Применить миграции (на сервере, внутри контейнера)
docker-compose exec app python -m alembic -c app/alembic.ini upgrade head
```

### Frontend
```bash
cd frontend
npm install
npm run dev          # Dev server (прокси на localhost:8000)
npm run build        # Сборка в frontend/dist/
```

### Деплой на сервер
```bash
# С локальной машины: пуш в master
git push

# На сервере (ssh root@79.110.227.22):
cd /root/moneytalks && git pull && docker-compose up -d --build app

# Если менялся nginx.conf или docker-compose.yml:
docker-compose up -d --build

# Если менялся фронт, собрать локально и пушнуть dist:
cd frontend && npm run build
# затем на сервере git pull && docker-compose restart nginx
```

## Важные ограничения

- **APScheduler:** только MemoryJobStore, НЕ Redis (uvloop pickle crash)
- **FSM Storage:** только MemoryStorage (aiogram), Redis убран
- **Redis:** сервис убран из docker-compose; cache.py gracefully деградирует (try/except → cache miss)
- **Порт 443** занят mtg (MTProto proxy) → nginx маппится на **8443** (`8443:443`)
- **SSL-сертификат:** Let's Encrypt для `79.110.227.22.sslip.io`, лежит на хосте в `/etc/letsencrypt`, монтируется в nginx напрямую (не через docker volume)
- **Webhook URL:** `https://79.110.227.22.sslip.io:8443/webhook`
- **Mini App URL:** `https://79.110.227.22.sslip.io:8443/`
- **requirements.txt:** psycopg2-binary и python-dateutil обязательны

## Переменные окружения (.env)

| Переменная | Описание |
|---|---|
| `BOT_TOKEN` | Telegram bot token |
| `ILYA_TG_ID` | Telegram ID Ильи |
| `ALENA_TG_ID` | Telegram ID Алёны |
| `WEBHOOK_URL` | URL вебхука (`https://...sslip.io:8443/webhook`) |
| `WEBHOOK_SECRET` | Секрет для валидации вебхука (min 16 символов) |
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@postgres:5432/db` |
| `REDIS_URL` | URL Redis (используется только cache.py, graceful fallback) |
| `SECRET_KEY` | Секрет для auth (min 32 символа) |
| `DEBUG` | `true`/`false` |
| `DEBUG_TRIGGER_SCHEDULER` | Если непусто — джобы запускаются сразу |
| `CORS_ORIGINS` | По умолчанию `["https://web.telegram.org"]` |

## Стиль кода

### Python
- 4 пробела, двойные кавычки
- Type hints везде (PEP 484)
- snake_case для функций/переменных, PascalCase для классов
- async/await для всего I/O
- Pydantic для валидации входных данных

### TypeScript/React
- 2 пробела, одинарные кавычки
- Функциональные компоненты с хуками
- camelCase для переменных, PascalCase для компонентов
- Inline styles (без отдельных CSS файлов)

## Архитектура

- **Бот** работает через webhook (не polling) — Telegram POST → nginx → FastAPI `/webhook`
- **nginx** фильтрует `/webhook` по IP Telegram (149.154.160.0/20, 91.108.4.0/22)
- **Auth фронта:** Telegram Mini App initData → HMAC валидация в `auth.py`
- **Auth бота:** WhitelistMiddleware — только `ILYA_TG_ID` и `ALENA_TG_ID`
- **Scheduled jobs:** weekly report, monthly reset, loan reminders (APScheduler, MemoryJobStore)

## Git

- Основная ветка: `master`
- Feature-ветки: `feature/plan-*`
- CI/CD нет — деплой ручной через `git pull && docker-compose up -d --build`
