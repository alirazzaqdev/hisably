"""Internal endpoint called by the daily cron job.

Protected by X-Cron-Secret header. Set CRON_SECRET in Vercel env to a random
string and use the same value in the Vercel Cron job configuration.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.email import (
    send_invoice_overdue_email,
    send_quotation_expired_email,
    send_quotation_expiring_soon_email,
)
from app.db.session import get_db
from app.models.enums import InvoiceType
from app.repositories import customers as customers_repo
from app.repositories import invoices as invoices_repo
from app.repositories import notifications as notif_repo
from app.repositories import users as users_repo
from app.repositories.payments import get_paid_amount
from sqlalchemy import select
from app.models.tenant import Tenant

logger = logging.getLogger("hisably.cron")
router = APIRouter(prefix="/internal", tags=["internal"])


def _verify_secret(x_cron_secret: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if settings.cron_secret and x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid cron secret")


@router.post("/daily-jobs", dependencies=[Depends(_verify_secret)])
async def run_daily_jobs(db: AsyncSession = Depends(get_db)) -> dict:
    """
    Runs all daily checks for every tenant:
    1. Flip past-due PENDING quotations to EXPIRED.
    2. Send 2-days-before quotation reminder.
    3. Send on-expiry quotation notification.
    4. Send overdue invoice notifications.

    Idempotent: timestamp fields prevent double-sending on same day.
    """
    settings = get_settings()
    results: dict = {"tenants": 0, "quot_flipped": 0, "quot_soon": 0, "quot_expired": 0, "inv_overdue": 0}

    all_tenants = list((await db.execute(select(Tenant))).scalars().all())
    results["tenants"] = len(all_tenants)

    for tenant in all_tenants:
        owner = await users_repo.get_owner(db, tenant.id)
        currency = tenant.currency or "AED"

        # 1. Flip past-due PENDING quotations to EXPIRED
        flipped = await invoices_repo.flip_expired_quotations(db, tenant.id)
        results["quot_flipped"] += len(flipped)

        # 2. 2-days-before reminder
        expiring_soon = await invoices_repo.list_expiring_soon_quotations(db, tenant.id)
        for inv in expiring_soon:
            customer = await customers_repo.get_by_id(db, tenant.id, inv.customer_id) if inv.customer_id else None
            cname = customer.name if customer else "—"
            number = inv.invoice_number or inv.draft_number
            due_str = inv.due_date.isoformat() if inv.due_date else "—"

            # Create in-app notification
            if not await notif_repo.already_created_today(db, tenant.id, "quotation_expiring_soon", inv.id):
                await notif_repo.create(
                    db, tenant.id,
                    type="quotation_expiring_soon",
                    title=f"Quotation {number} expires in 2 days",
                    message=f"{cname} — expires {due_str}. Follow up or it auto-expires.",
                    link=f"/quotations",
                    related_id=inv.id,
                )
            # Email
            if owner:
                try:
                    send_quotation_expiring_soon_email(owner.email, number, cname, due_str)
                except Exception:
                    logger.exception("Failed to send expiring-soon email for %s", number)
            await invoices_repo.mark_expiry_soon_notified(db, inv)
            results["quot_soon"] += 1

        # 3. On-expiry notification for newly-flipped quotations
        for inv in flipped:
            if inv.expiry_notified_at is not None:
                continue  # already notified
            customer = await customers_repo.get_by_id(db, tenant.id, inv.customer_id) if inv.customer_id else None
            cname = customer.name if customer else "—"
            number = inv.invoice_number or inv.draft_number
            due_str = inv.due_date.isoformat() if inv.due_date else "—"

            if not await notif_repo.already_created_today(db, tenant.id, "quotation_expired", inv.id):
                await notif_repo.create(
                    db, tenant.id,
                    type="quotation_expired",
                    title=f"Quotation {number} expired",
                    message=f"{cname} — expired on {due_str} without a response.",
                    link=f"/quotations",
                    related_id=inv.id,
                )
            if owner:
                try:
                    send_quotation_expired_email(owner.email, number, cname, due_str)
                except Exception:
                    logger.exception("Failed to send expiry email for %s", number)
            await invoices_repo.mark_expiry_notified(db, inv)
            results["quot_expired"] += 1

        # 4. Overdue invoices
        overdue = await invoices_repo.list_overdue_invoices(db, tenant.id)
        for inv in overdue:
            if await notif_repo.already_created_today(db, tenant.id, "invoice_overdue", inv.id):
                continue
            customer = await customers_repo.get_by_id(db, tenant.id, inv.customer_id) if inv.customer_id else None
            cname = customer.name if customer else "—"
            number = inv.invoice_number or inv.draft_number
            due_str = inv.due_date.isoformat() if inv.due_date else "—"
            paid = await get_paid_amount(db, inv.id)
            balance = inv.grand_total - paid
            balance_str = f"{balance:.2f}"

            await notif_repo.create(
                db, tenant.id,
                type="invoice_overdue",
                title=f"{number} overdue — {currency} {balance_str} outstanding",
                message=f"{cname} — due {due_str}, balance {currency} {balance_str}.",
                link=f"/invoices/{inv.id}",
                related_id=inv.id,
            )
            if owner:
                try:
                    send_invoice_overdue_email(owner.email, number, cname, due_str, balance_str, currency)
                except Exception:
                    logger.exception("Failed to send overdue email for %s", number)
            results["inv_overdue"] += 1

    await db.commit()
    logger.info("Daily job complete: %s", results)
    return {"ok": True, "ran_at": datetime.now(timezone.utc).isoformat(), **results}
