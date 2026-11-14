"""Gregorian <-> Ethiopian calendar conversion through the Julian Day Number.

Checked by unit tests against known dates (Ethiopian New Year 2019 = 11 Sep 2026; Ethiopian
Christmas, Tahsas 29 2016 = 7 Jan 2024). VERIFY with a native speaker before relying on the
Amharic month spelling.
"""
from __future__ import annotations

from datetime import date

ETHIOPIAN_EPOCH_OFFSET = 1723856  # JDN of the day before 1 Meskerem 1 (Amete Mihret) minus 365

MONTHS_EN = ["Meskerem", "Tikimt", "Hidar", "Tahsas", "Tir", "Yekatit", "Megabit", "Miyazya",
             "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"]
MONTHS_AM = ["መስከረም", "ጥቅምት", "ኅዳር", "ታኅሣሥ", "ጥር", "የካቲት", "መጋቢት", "ሚያዝያ",
             "ግንቦት", "ሰኔ", "ሐምሌ", "ነሐሴ", "ጳጉሜ"]


def to_ethiopian(g: date) -> tuple[int, int, int]:
    jdn = g.toordinal() + 1721425  # proleptic Gregorian ordinal -> JDN
    r = (jdn - ETHIOPIAN_EPOCH_OFFSET) % 1461
    n = r % 365 + 365 * (r // 1460)
    year = 4 * ((jdn - ETHIOPIAN_EPOCH_OFFSET) // 1461) + r // 365 - r // 1460
    return year, n // 30 + 1, n % 30 + 1


def to_gregorian(year: int, month: int, day: int) -> date:
    jdn = (ETHIOPIAN_EPOCH_OFFSET + 365) + 365 * (year - 1) + year // 4 + 30 * month + day - 31
    return date.fromordinal(jdn - 1721425)


def label(g: date, lang: str = "en") -> str:
    y, m, d = to_ethiopian(g)
    months = MONTHS_AM if lang == "am" else MONTHS_EN
    return f"{months[m - 1]} {d}, {y}"
