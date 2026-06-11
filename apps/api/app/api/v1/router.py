from fastapi import APIRouter

from app.api.v1.routes import (
    accounts,
    attachments,
    auth,
    customers,
    dashboard,
    expenses,
    invoices,
    items,
    onboarding,
    payments,
    recurring_invoices,
    reports,
    suppliers,
    sync,
    tenants,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(onboarding.router)
api_router.include_router(tenants.router)
api_router.include_router(users.router)
api_router.include_router(customers.router)
api_router.include_router(suppliers.router)
api_router.include_router(items.router)
api_router.include_router(invoices.router)
api_router.include_router(payments.router)
api_router.include_router(expenses.router)
api_router.include_router(reports.router)
api_router.include_router(dashboard.router)
api_router.include_router(sync.router)
api_router.include_router(attachments.router)
api_router.include_router(accounts.router)
api_router.include_router(recurring_invoices.router)
