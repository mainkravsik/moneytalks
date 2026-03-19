# MoneyTalks — Семейный финансовый бот

**Дата:** 2026-03-19
**Статус:** Draft

---

## Контекст

Илья и Алёна ведут семейный бюджет вручную — это неудобно и нет единого инструмента. Нужен Telegram-бот с мини-апп, который позволяет в пару кликов вносить траты, следить за остатком по категориям, вести копилки и отслеживать кредиты с рекомендациями по выгодному погашению. Проект — личный инструмент для двух человек.

---

## Пользователи

- **Илья** — один из двух пользователей общего бота
- **Алёна** — второй пользователь
- Оба пишут в один общий Telegram-бот, разделяются по `telegram_user_id`
- Общий семейный бюджет: один набор категорий, копилок и кредитов на двоих

---

## Архитектура

**Подход: Монолит на одном VPS**

```
┌─────────────────────────────────────┐
│            VPS (Docker)             │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  Python-сервис               │   │
│  │  aiogram 3.x (бот)           │   │
│  │  FastAPI (REST API)          │   │
│  │  SQLAlchemy async            │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌─────────────┐ ┌───────────────┐  │
│  │ PostgreSQL  │ │ Redis (cache) │  │
│  └─────────────┘ └───────────────┘  │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  React + Vite (Mini App)     │   │
│  │  Nginx (статика + прокси)    │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Стек:**
- Bot: Python 3.12, aiogram 3.x
- API: FastAPI, SQLAlchemy (async), asyncpg
- DB: PostgreSQL 16, Redis 7
- Frontend: React 18, Vite, @telegram-apps/sdk, TelegramUI
- Auth: Telegram initData (HMAC-SHA256) — без паролей
- Infra: Docker Compose, Nginx

---

## Модули

### 1. Бот (aiogram)

**Команды:**
- `/start` — приветствие, привязка пользователя
- `/add` — добавить трату (текстом: `/add 500 пиво` или интерактивно через кнопки)
- `/budget` — показать остаток по категориям
- `/report` — краткий отчёт за текущий месяц
- `/piggy` — быстрое пополнение копилки
- `/debt` — статус кредитов

**Inline-ввод траты (кнопки):**
1. Нажал «Добавить трату» → бот показывает список категорий кнопками
2. Выбрал категорию → ввёл сумму числом
3. Бот подтверждает: «✅ Записал: ₽500 · Пиво · Илья»

**Уведомления (APScheduler):**
- Превышение лимита категории — мгновенно при записи
- Напоминание об оплате кредита — за 3 дня до даты платежа
- Еженедельный отчёт — каждый понедельник 10:00
- Ежемесячный сброс бюджета — 10-го числа, бот предлагает задать бюджет на месяц

### 2. Мини-апп (React)

**Навигация (5 вкладок снизу):**

```
🏠 Главная | 📊 Бюджет | 🐷 Копилки | 💳 Кредиты | 📋 История
```

**Главный экран:**
- Большое число «Можно потратить» (бюджет − потрачено − обязательные платежи)
- Цвет: зелёный > 30%, жёлтый 10–30%, красный < 10%
- Топ-3 категории с прогресс-барами (зелёный/жёлтый/красный по % использования)
- Карточки внизу: суммарный баланс копилок + суммарный остаток долга

**Экран «Бюджет»:**
- Список категорий — каждая карточка:
  - Emoji + название
  - Прогресс-бар (зелёный → жёлтый → красный)
  - «₽X потрачено / ₽Y лимит»
  - Подпись «Осталось ₽Z · N дней» или «⚠️ Лимит превышен»
- Кнопка «+ Добавить трату» → модальное окно (категория + сумма + комментарий)
- Тап на категорию → список транзакций этой категории за месяц
- Кнопка «⚙️ Настроить бюджет» → задать лимиты на месяц, добавить/удалить категории

**Экран «Копилки»:**
- Карточки копилок: название, прогресс-бар, сумма / цель, ожидаемая дата достижения
- «+ Пополнить» → ввод суммы
- «+ Новая копилка» → имя, цель (опционально), срок (опционально)
- Удаление копилки с подтверждением
- Типы: с целью (отпуск ₽50 000 к июлю), без цели (подушка безопасности)

**Экран «Кредиты»:**
- Список до 5 кредитов: имя кредита, банк, остаток, ставка %, дата платежа, мин. платёж
- Прогресс-бар погашения (от исходной суммы)
- «Записать платёж» → ввод суммы, дата
- Блок рекомендаций:
  - Автоматически считает Snowball и Avalanche
  - Показывает: «Avalanche сэкономит ₽18 400 и закроет долги на 3 мес раньше»
  - Калькулятор доплаты: слайдер «Что если доплачивать +₽X/мес?» → новая дата закрытия
- Следующие платежи: список ближайших дат по всем кредитам

**Экран «История»:**
- Транзакции за текущий месяц (список, сортировка по дате)
- Фильтр по категории, по автору (Илья / Алёна)
- Переключатель периода (< 10 фев – 9 мар | 10 мар – 9 апр >)
- Редактировать / удалить транзакцию (свайп или кнопка)

---

## База данных

```sql
-- Пользователи
users (id, telegram_id, name, created_at)

-- Бюджетный период: с 10-го числа текущего месяца по 9-е следующего (в день зарплаты)
-- Идентифицируется по (year, month) где month = месяц, в котором начался период (т.е. период начат 10 марта → year=2026, month=3)
budget_periods (id, year, month, start_date, end_date, created_at)
-- start_date = 10-е число месяца (year, month)
-- end_date   = 9-е число следующего месяца

-- Категории (глобальные, общие для обоих)
categories (id, name, emoji, is_active, created_at)
-- is_active=false = мягкое удаление; исторические budget_limits и transactions сохраняются

-- Лимиты категорий по периоду
budget_limits (id, period_id, category_id, limit_amount)

-- Транзакции (траты)
-- period определяется через budget_periods.start_date/end_date: транзакция принадлежит периоду где start_date <= created_at < next_start_date
-- Все timestamps хранятся в UTC
transactions (id, user_id, category_id, amount, comment, is_deleted, created_at, updated_at)
-- is_deleted для мягкого удаления; оба пользователя могут редактировать любую транзакцию

-- Копилки
-- current_amount — materialized cache, обновляется при каждом piggy_contribution
-- при расхождении — пересчитывается через SUM(piggy_contributions)
piggy_banks (id, name, target_amount, current_amount, target_date, is_active, created_at)

-- Пополнения копилок
piggy_contributions (id, piggy_bank_id, user_id, amount, created_at)

-- Кредиты
-- remaining_amount — materialized cache; обновляется при каждом loan_payment
-- payment_type: 'annuity' (аннуитет) | 'differentiated' (дифференцированный)
-- Для расчёта Snowball/Avalanche используются: remaining_amount, interest_rate, monthly_payment
-- next_payment_date автоматически сдвигается на +1 месяц при записи платежа
loans (id, name, bank, original_amount, remaining_amount, interest_rate,
        monthly_payment, next_payment_date, payment_type, start_date, is_active, created_at)

-- Платежи по кредитам
loan_payments (id, loan_id, user_id, amount, paid_at)
```

---

## Аутентификация

**Mini App (FastAPI):**
- Telegram Mini App передаёт `initData` в каждом запросе к API (заголовок `X-Telegram-Init-Data`)
- FastAPI middleware валидирует HMAC-SHA256 подпись, извлекает `user.id`
- Принимаем initData не старше **1 часа** (проверяем `auth_date`)
- Проверяет что `user.id` ∈ `[ILYA_TG_ID, ALENA_TG_ID]` (из переменных окружения `.env`)

**Bot (aiogram):**
- Middleware проверяет `message.from_user.id` / `callback_query.from_user.id`
- Если ID не в whitelist → бот отвечает «Нет доступа» и игнорирует команду
- Whitelist берётся из тех же переменных `.env` (`ILYA_TG_ID`, `ALENA_TG_ID`)

---

## Redis — использование

- **APScheduler backend** — хранит состояние задач планировщика
- **Rate limiting** — защита от спама в bot handlers (1 трата/сек на пользователя)
- **Cache** — текущий safe_to_spend (TTL 60 сек), инвалидируется при записи транзакции

---

## Алгоритм «Можно потратить»

```
current_period = get_current_period()  # период 10-го по 9-е

paid_this_period = сумма loan_payments где paid_at >= current_period.start_date
unpaid_loans = sum(monthly_payment) для кредитов без платежа в текущем периоде

safe_to_spend =
    sum(budget_limits текущего периода)
    − sum(transactions где created_at in [current_period.start_date, next_period.start_date), is_deleted=false)
    − unpaid_loans
```
Таким образом, если платёж по кредиту уже записан — он не вычитается повторно.

---

## Ежемесячный сброс бюджета

**10-го числа каждого месяца** APScheduler запускает задачу (совпадает с приходом зарплаты):
1. Создаёт новый `budget_period`: `start_date = текущее 10-е`, `end_date = следующее 9-е`
2. Копирует все `budget_limits` из предыдущего периода в новый (как стартовые значения)
3. Бот отправляет обоим пользователям: «💰 Зарплата! Новый бюджетный период начался. Бюджет скопирован с прошлого — хочешь изменить лимиты?» + кнопка «Настроить»

**Определение текущего периода:** `current_period` = `budget_periods` где `start_date <= NOW() < start_date следующего периода`. Вспомогательная функция `get_current_period()` используется везде в коде.

**Get-or-create guard:** при любой записи транзакции вызывается `get_or_create_period()` — если период за текущий диапазон дат ещё не создан (APScheduler не успел), он создаётся здесь с копированием лимитов. Это устраняет гонку.

---

## Алгоритмы погашения кредитов

**Модель расчёта:** для обеих стратегий используем упрощённый расчёт на основе:
- `remaining_amount` — текущий остаток
- `interest_rate` — годовая ставка (в % годовых)
- `monthly_payment` — минимальный ежемесячный платёж
- Ежемесячный процент = `remaining_amount × (interest_rate / 12 / 100)`
- Ежемесячное погашение тела = `monthly_payment − проценты_месяца`

**Snowball:** сортировка по `remaining_amount` ASC → платим минималку на все, остаток бросаем на первый
**Avalanche:** сортировка по `interest_rate` DESC → платим минималку на все, остаток бросаем на первый

Для каждой стратегии рассчитываем:
- Итоговая переплата (сумма всех процентов за весь срок)
- Дата полного погашения
- Порядок закрытия кредитов

**Калькулятор доплаты:** принимает `extra_amount` (₽0–50 000, шаг ₽500), пересчитывает обе стратегии, возвращает дельту в месяцах и рублях.

**Автосдвиг next_payment_date:** при записи `loan_payment` — `next_payment_date += 1 месяц`.

**Защита от бесконечного цикла:** перед расчётом валидируем `monthly_payment > remaining_amount × (interest_rate / 12 / 100)`. Если нет — API возвращает ошибку 400 с сообщением «Ежемесячный платёж меньше или равен процентам — кредит не погасится». Показываем пользователю предупреждение при вводе кредита.

---

## REST API (ключевые эндпоинты)

```
POST   /api/transactions          — добавить трату
GET    /api/transactions          — список (фильтр: month, year, category_id, user_id)
PATCH  /api/transactions/{id}     — редактировать (инвалидирует кеш safe_to_spend)
DELETE /api/transactions/{id}     — мягкое удаление (is_deleted=true)

GET    /api/budget/current        — текущий период: лимиты + потрачено + safe_to_spend
PATCH  /api/budget/limits         — обновить лимиты: body=[{category_id, limit_amount}, ...]

GET    /api/categories            — список активных категорий
POST   /api/categories            — создать категорию: {name, emoji}
DELETE /api/categories/{id}       — деактивировать (is_active=false)

GET    /api/piggy                 — список активных копилок
POST   /api/piggy                 — создать копилку: {name, target_amount?, target_date?}
PATCH  /api/piggy/{id}            — редактировать: {name?, target_amount?, target_date?}
POST   /api/piggy/{id}/contribute — пополнить: {amount}
DELETE /api/piggy/{id}            — деактивировать (is_active=false)

GET    /api/loans/payoff?extra=0  — расчёт Snowball/Avalanche (ОБЪЯВЛЯТЬ ПЕРВЫМ в роутере!)
GET    /api/loans                 — список активных кредитов
POST   /api/loans                 — добавить кредит
PATCH  /api/loans/{id}            — редактировать: {name?, bank?, interest_rate?, monthly_payment?, ...}
POST   /api/loans/{id}/payment    — записать платёж: {amount, paid_at?}
DELETE /api/loans/{id}            — деактивировать (is_active=false)
```

**Примечание по транзакциям:** `updated_at` добавляется в таблицу `transactions` для аудита. Инвалидация кеша `safe_to_spend` в Redis происходит при любом POST/PATCH/DELETE в `/api/transactions`.

---

## Структура проекта

```
moneytalks/
├── bot/                    # aiogram бот
│   ├── handlers/           # команды и колбэки
│   ├── keyboards/          # inline- и reply-клавиатуры
│   ├── middlewares/        # auth, logging
│   └── scheduler.py        # APScheduler задачи
├── api/                    # FastAPI
│   ├── routers/            # budget, piggy, loans, history
│   ├── schemas/            # Pydantic модели
│   ├── auth.py             # initData валидация
│   └── deps.py             # зависимости
├── db/                     # SQLAlchemy модели и миграции
│   ├── models.py
│   └── migrations/         # Alembic
├── frontend/               # React мини-апп
│   ├── src/
│   │   ├── pages/          # Dashboard, Budget, Piggy, Loans, History
│   │   ├── components/     # CategoryCard, LoanCard, PiggyCard, ...
│   │   ├── api/            # axios клиент
│   │   └── store/          # Zustand state management
│   └── vite.config.ts
├── docker-compose.yml
├── nginx.conf
└── .env.example
```

---

## Деплой

```yaml
# docker-compose.yml — 4 сервиса
services:
  app:       # Python: бот + API (единый процесс)
  postgres:  # PostgreSQL 16
  redis:     # Redis 7
  nginx:     # Nginx: раздаёт фронт, проксирует /api → app:8000
```

- HTTPS через Certbot / Let's Encrypt (обязателен для Telegram Mini App)
- Nginx routing:
  - `GET /` → React статика (dist/)
  - `POST /webhook` → app:8000/webhook (Telegram bot webhook)
  - `/api/*` → app:8000/api/*
- Telegram Webhook на `/webhook` endpoint
- Mini App URL в BotFather: `https://yourdomain.com/`
- Сборка фронта: multi-stage Dockerfile (node:20 build → nginx:alpine serve)
- Certbot интеграция: отдельный `certbot` контейнер в docker-compose, volume `/etc/letsencrypt` монтируется в nginx, cron `/etc/periodic/monthly` для авторенью. HTTP challenge на порту 80 через location `/.well-known/acme-challenge/`.

**Форс-запуск уведомлений для тестирования:** `DEBUG_TRIGGER_SCHEDULER=weekly|monthly` в `.env` запускает соответствующую задачу при старте бота. Используется только в dev-окружении.

---

## Категории по умолчанию

| Emoji | Название |
|-------|----------|
| 🛒 | Продукты |
| ☕ | Кафе / рестораны |
| 🚗 | Транспорт |
| 🎭 | Развлечения |
| 🍺 | Пиво |
| 💊 | Здоровье |
| 👗 | Одежда |
| 🏠 | Дом / ЖКХ |
| 📱 | Связь / подписки |
| 🎁 | Подарки |

Можно добавлять / удалять / переименовывать.

---

## Верификация (как проверить что всё работает)

1. `docker-compose up` — все 4 контейнера поднялись
2. `/start` в боте → бот отвечает, пользователь создан в БД
3. `/add 500 продукты` → транзакция записана, бот подтвердил
4. Открыть Mini App → главный экран показывает правильный остаток
5. Экран «Бюджет» → прогресс-бары обновились
6. Добавить копилку, пополнить → баланс обновился
7. Добавить кредит → расчёт Snowball/Avalanche показывает цифры
8. Слайдер доплаты → дата меняется корректно
9. Превысить лимит категории → бот присылает уведомление
10. Дождаться понедельника или форсировать scheduler → еженедельный отчёт пришёл
