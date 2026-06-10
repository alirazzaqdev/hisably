"""Money helpers — integer minor units (fils), mirrors packages/shared/src/money.ts.

Keeping this logic identical between the TS and Python implementations is
critical: both are validated against the shared fixtures in
packages/shared/test-fixtures/.
"""

import math


def round_half_away_from_zero(value: float) -> int:
    """Round-half-away-from-zero to the nearest integer (UAE FTA rounding).

    Python's built-in round() uses banker's rounding (round-half-to-even),
    which would make 49.5 -> 50 but 48.5 -> 48. FTA rounding always rounds
    .5 away from zero, regardless of parity.
    """
    if value >= 0:
        return math.floor(value + 0.5)
    return -math.floor(-value + 0.5)


def to_minor_units(amount_major: float) -> int:
    """Convert a major-unit amount (e.g. 12.34 AED) to integer fils."""
    return round_half_away_from_zero(amount_major * 100)


def to_major_units(amount_minor: int) -> float:
    return amount_minor / 100


def format_minor_units(amount_minor: int) -> str:
    sign = "-" if amount_minor < 0 else ""
    abs_amount = abs(amount_minor)
    major, minor = divmod(abs_amount, 100)
    return f"{sign}{major}.{minor:02d}"
