"""Notification message builders — pure functions, no I/O."""
from datetime import date


def weekly_report_text(
    period_start: date,
    period_end: date,
    total_spent: float,
    total_limit: float,
    top_categories: list[dict],  # [{"emoji": "🛒", "name": "...", "spent": 100}]
) -> str:
    lines = [
        f"📊 <b>Недельный отчёт</b>",
        f"Период: {period_start} – {period_end}",
        f"Потрачено: <b>₽{total_spent:.0f}</b> из ₽{total_limit:.0f}",
        "",
        "Топ трат:",
    ]
    for cat in top_categories[:5]:
        lines.append(f"  {cat['emoji']} {cat['name']}: ₽{cat['spent']:.0f}")
    return "\n".join(lines)


def monthly_reset_text(new_start: date, new_end: date) -> str:
    return (
        f"💰 <b>Зарплата!</b> Новый бюджетный период начался.\n"
        f"{new_start} – {new_end}\n\n"
        f"Бюджет скопирован с прошлого месяца — хочешь изменить лимиты? Открой мини-апп."
    )


def loan_reminder_text(loan_name: str, amount: float, days_left: int) -> str:
    return (
        f"⏰ <b>Напоминание о платеже</b>\n"
        f"Кредит: {loan_name}\n"
        f"Сумма: ₽{amount:.0f}\n"
        f"Осталось дней: {days_left}"
    )


def limit_exceeded_text(category_emoji: str, category_name: str, spent: float, limit: float) -> str:
    over = spent - limit
    return (
        f"⚠️ <b>Лимит превышен!</b>\n"
        f"{category_emoji} {category_name}: потрачено ₽{spent:.0f} из ₽{limit:.0f}\n"
        f"Перерасход: ₽{over:.0f}"
    )
