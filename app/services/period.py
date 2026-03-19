from datetime import date


def get_period_bounds(year: int, month: int) -> tuple[date, date]:
    """Return (start_date, end_date) for salary-aligned period starting on 10th."""
    start = date(year, month, 10)
    # end = 9th of next month
    if month == 12:
        end = date(year + 1, 1, 9)
    else:
        end = date(year, month + 1, 9)
    return start, end


def find_period_for_date(d: date) -> tuple[int, int]:
    """Return (year, month) of the budget period that contains date d.
    Period starts on 10th: dates 1-9 belong to previous month's period.
    """
    if d.day >= 10:
        return d.year, d.month
    else:
        # belongs to previous month's period
        if d.month == 1:
            return d.year - 1, 12
        else:
            return d.year, d.month - 1
