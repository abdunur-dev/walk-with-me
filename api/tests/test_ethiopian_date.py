from datetime import date

from app.jobs.ethiopian_date import label, to_ethiopian, to_gregorian


def test_known_new_years():
    assert to_ethiopian(date(2023, 9, 12)) == (2016, 1, 1)   # Enkutatash 2016 E.C.
    assert to_ethiopian(date(2026, 9, 11)) == (2019, 1, 1)   # Enkutatash 2019 E.C.


def test_pagume_6_in_leap_year():
    assert to_ethiopian(date(2023, 9, 11)) == (2015, 13, 6)


def test_round_trip():
    d = date(2025, 1, 1)
    while d < date(2029, 1, 1):
        assert to_gregorian(*to_ethiopian(d)) == d
        d = date.fromordinal(d.toordinal() + 7)


def test_label():
    assert label(date(2026, 9, 11)) == "Meskerem 1, 2019"
