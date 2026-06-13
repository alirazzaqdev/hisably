from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.db.base import Base
from app.models import Invoice, Item, Tenant, User
from scripts import seed_demo_data


async def test_seed_demo_data_creates_realistic_tenant(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    session_local = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    monkeypatch.setattr(seed_demo_data, "AsyncSessionLocal", session_local)

    await seed_demo_data.main()

    async with session_local() as session:
        tenant = (await session.execute(select(Tenant))).scalar_one()
        assert tenant.business_name == seed_demo_data.DEMO_BUSINESS_NAME
        assert tenant.industry_profile == "glass_aluminium"

        owner = (await session.execute(select(User))).scalar_one()
        assert owner.email == seed_demo_data.DEMO_EMAIL
        assert owner.email_verified_at is not None

        items = (await session.execute(select(Item))).scalars().all()
        assert len(items) == 6

        invoices = (await session.execute(select(Invoice))).scalars().all()
        assert len(invoices) == 5
        assert all(invoice.grand_total > 0 for invoice in invoices)

    # Re-running against the same database is a no-op (idempotency guard).
    await seed_demo_data.main()
    async with session_local() as session:
        users = (await session.execute(select(User))).scalars().all()
        assert len(users) == 1

    await engine.dispose()
