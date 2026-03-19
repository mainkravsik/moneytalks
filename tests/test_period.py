from datetime import date
import pytest
from app.services.period import get_period_bounds, find_period_for_date

def test_period_bounds_march():
    """Period starting March 10 ends April 9."""
    start, end = get_period_bounds(2026, 3)
    assert start == date(2026, 3, 10)
    assert end == date(2026, 4, 9)

def test_period_bounds_december():
    """Period starting December 10 ends January 9 next year."""
    start, end = get_period_bounds(2026, 12)
    assert start == date(2026, 12, 10)
    assert end == date(2027, 1, 9)

def test_find_period_before_10th():
    """Date of March 5 belongs to February period (10 Feb – 9 Mar)."""
    year, month = find_period_for_date(date(2026, 3, 5))
    assert (year, month) == (2026, 2)

def test_find_period_on_10th():
    """Date of March 10 starts a new period — belongs to March."""
    year, month = find_period_for_date(date(2026, 3, 10))
    assert (year, month) == (2026, 3)

def test_find_period_after_10th():
    """Date of March 20 belongs to March period."""
    year, month = find_period_for_date(date(2026, 3, 20))
    assert (year, month) == (2026, 3)

def test_find_period_january_before_10th():
    """Jan 5 belongs to December period of previous year."""
    year, month = find_period_for_date(date(2026, 1, 5))
    assert (year, month) == (2025, 12)
