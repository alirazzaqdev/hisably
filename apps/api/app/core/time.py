from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC datetime — stored consistently across dialects (SQLite drops
    tzinfo on round-trip, which would otherwise break naive/aware comparisons
    in tests vs. Postgres)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
