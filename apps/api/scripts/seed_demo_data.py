"""Seeds a realistic demo UAE tenant for local development / sales demos.

Run from `apps/api` with the venv active:

    python -m scripts.seed_demo_data

Creates a glass & aluminium contracting tenant ("Al Manara Glass &
Aluminium LLC") with a verified owner login, customers, suppliers, items,
invoices across several document types, payments, expenses, and a Job
Register with receipts. Safe to re-run — exits early if the demo tenant
already exists.
"""

import asyncio
from datetime import date, timedelta
from decimal import Decimal

from app.core.security import hash_password
from app.core.time import utcnow
from app.db.session import AsyncSessionLocal
from app.models.account import Account
from app.models.enums import (
    AccountType,
    Country,
    InvoiceType,
    ItemUnit,
    JobPaymentStatus,
    JobTaxInvoiceStatus,
    JobWorkStatus,
    PaymentMethod,
    VatCategory,
)
from app.models.user import User
from app.models.enums import UserRole
from app.repositories import customers as customers_repo
from app.repositories import invoice_sequences as invoice_sequences_repo
from app.repositories import invoices as invoices_repo
from app.repositories import item_categories as item_categories_repo
from app.repositories import items as items_repo
from app.repositories import job_register as job_register_repo
from app.repositories import payments as payments_repo
from app.repositories import suppliers as suppliers_repo
from app.repositories import tenants as tenants_repo
from app.repositories import expenses as expenses_repo
from app.repositories import firm_memberships as firm_memberships_repo
from app.repositories.users import get_by_email
from app.models.enums import InvoiceStatus
from app.schemas.customer import CustomerCreate
from app.schemas.expense import ExpenseCreate
from app.schemas.invoice import InvoiceCreate, InvoiceLineItemInput
from app.schemas.item import ItemCreate
from app.schemas.item_category import ItemCategoryCreate
from app.schemas.job_register import JobReceiptCreate, JobRegisterRowCreate
from app.schemas.payment import PaymentAllocationInput, PaymentCreate
from app.schemas.supplier import SupplierCreate

DEMO_BUSINESS_NAME = "Al Manara Glass & Aluminium LLC"
DEMO_EMAIL = "demo@hisably.app"
DEMO_PASSWORD = "Demo@1234"

today = date.today()


async def main() -> None:
    async with AsyncSessionLocal() as db:
        existing_user = await get_by_email(db, DEMO_EMAIL)
        if existing_user is not None:
            print(f"Demo tenant already exists ({DEMO_EMAIL}) — nothing to do.")
            return

        # --- Tenant + owner user -----------------------------------------
        tenant = await tenants_repo.create(db, business_name=DEMO_BUSINESS_NAME, country=Country.AE)
        tenant.currency = "AED"
        tenant.trn = "100234567800003"
        tenant.vat_registered = True
        tenant.address = "Warehouse 14, Al Quoz Industrial Area 3, Dubai, UAE"
        tenant.invoice_prefix = "AMG-"
        tenant.industry_profile = "glass_aluminium"
        tenant.cheque_payee_name = "Al Manara Glass & Aluminium LLC"
        tenant.bank_name = "Abu Dhabi Commercial Bank"
        tenant.bank_account_number = "13456789012345"
        tenant.bank_iban = "AE070331234567890123456"
        tenant.contact_person = "Yusuf Al Mansoori"
        tenant.contact_phone = "+971 50 123 4567"

        owner = User(
            tenant_id=tenant.id,
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            role=UserRole.OWNER,
            email_verified_at=utcnow(),
        )
        db.add(owner)
        await db.flush()
        await firm_memberships_repo.create(db, owner.id, tenant.id)

        await invoice_sequences_repo.create_default_sequences(db, tenant.id, starting_number=1)

        db.add(Account(tenant_id=tenant.id, name="Cash", type=AccountType.CASH))
        db.add(
            Account(
                tenant_id=tenant.id,
                name="ADCB Current Account",
                type=AccountType.BANK,
                bank_name="Abu Dhabi Commercial Bank",
                account_number="13456789012345",
            )
        )

        # --- Item categories -----------------------------------------------
        await item_categories_repo.seed_defaults(db, tenant.id)
        glass_category = await item_categories_repo.create(db, tenant.id, ItemCategoryCreate(name="Glass"))
        aluminium_category = await item_categories_repo.create(db, tenant.id, ItemCategoryCreate(name="Aluminium"))

        # --- Items -----------------------------------------------------------
        tempered_glass = await items_repo.create(
            db,
            tenant.id,
            ItemCreate(
                name="10mm Tempered Glass",
                sku="GLS-TMP-10",
                unit=ItemUnit.SQM,
                is_area_based=True,
                sale_price=Decimal("180.00"),
                purchase_price=Decimal("120.00"),
                vat_category=VatCategory.STANDARD,
                category_id=glass_category.id,
            ),
        )
        float_glass = await items_repo.create(
            db,
            tenant.id,
            ItemCreate(
                name="6mm Clear Float Glass",
                sku="GLS-FLT-06",
                unit=ItemUnit.SQM,
                is_area_based=True,
                sale_price=Decimal("95.00"),
                purchase_price=Decimal("60.00"),
                vat_category=VatCategory.STANDARD,
                category_id=glass_category.id,
            ),
        )
        aluminium_mill = await items_repo.create(
            db,
            tenant.id,
            ItemCreate(
                name="Aluminium Frame Profile - Mill Finish",
                sku="ALU-MIL-01",
                unit=ItemUnit.LM,
                sale_price=Decimal("45.00"),
                purchase_price=Decimal("28.00"),
                vat_category=VatCategory.STANDARD,
                category_id=aluminium_category.id,
            ),
        )
        aluminium_powder = await items_repo.create(
            db,
            tenant.id,
            ItemCreate(
                name="Aluminium Frame Profile - Powder Coated",
                sku="ALU-PWD-01",
                unit=ItemUnit.LM,
                sale_price=Decimal("65.00"),
                purchase_price=Decimal("42.00"),
                vat_category=VatCategory.STANDARD,
                category_id=aluminium_category.id,
            ),
        )
        door_handle = await items_repo.create(
            db,
            tenant.id,
            ItemCreate(
                name="Door Handle Set - Stainless Steel",
                sku="HW-HDL-SS",
                unit=ItemUnit.PCS,
                sale_price=Decimal("85.00"),
                purchase_price=Decimal("50.00"),
                vat_category=VatCategory.STANDARD,
                track_inventory=True,
                current_stock=Decimal("40"),
                low_stock_threshold=Decimal("10"),
            ),
        )
        sealant = await items_repo.create(
            db,
            tenant.id,
            ItemCreate(
                name="Silicone Sealant (Clear)",
                sku="HW-SIL-CLR",
                unit=ItemUnit.PCS,
                sale_price=Decimal("22.00"),
                purchase_price=Decimal("14.00"),
                vat_category=VatCategory.STANDARD,
                track_inventory=True,
                current_stock=Decimal("60"),
                low_stock_threshold=Decimal("15"),
            ),
        )

        # --- Customers & suppliers -------------------------------------------
        burj_vista = await customers_repo.create(
            db,
            tenant.id,
            CustomerCreate(
                name="Burj Vista Properties LLC",
                trn="100345678900003",
                phone="+971 4 234 5678",
                email="accounts@burjvista.ae",
                billing_address="Office 1204, Burj Vista Tower 2, Downtown Dubai, UAE",
            ),
        )
        al_reem = await customers_repo.create(
            db,
            tenant.id,
            CustomerCreate(
                name="Al Reem Construction LLC",
                trn="100456789000003",
                phone="+971 2 345 6789",
                email="procurement@alreemconst.ae",
                billing_address="Plot 56, Al Reem Island, Abu Dhabi, UAE",
            ),
        )
        falcon_interiors = await customers_repo.create(
            db,
            tenant.id,
            CustomerCreate(
                name="Falcon Interiors",
                phone="+971 6 567 8901",
                email="info@falconinteriors.ae",
                billing_address="Showroom 8, Sharjah Industrial Area 6, Sharjah, UAE",
            ),
        )

        sharjah_glass = await suppliers_repo.create(
            db,
            tenant.id,
            SupplierCreate(
                name="Sharjah Glass Trading LLC",
                trn="100567890100003",
                phone="+971 6 678 9012",
                email="sales@sharjahglass.ae",
                billing_address="Industrial Area 12, Sharjah, UAE",
            ),
        )
        await suppliers_repo.create(
            db,
            tenant.id,
            SupplierCreate(
                name="Gulf Aluminium Extrusions",
                trn="100678901200003",
                phone="+971 4 789 0123",
                email="orders@gulfaluminium.ae",
                billing_address="Jebel Ali Industrial Area, Dubai, UAE",
            ),
        )

        await db.flush()

        # --- Invoices ----------------------------------------------------------
        # 1. Tax invoice — fully paid
        invoice_1 = await invoices_repo.create(
            db,
            tenant,
            InvoiceCreate(
                type=InvoiceType.TAX_INVOICE,
                customer_id=burj_vista.id,
                issue_date=today - timedelta(days=20),
                due_date=today - timedelta(days=5),
                lpo_no="LPO-2026-014",
                line_items=[
                    InvoiceLineItemInput(
                        item_id=tempered_glass.id,
                        description="10mm tempered glass partition - Lobby",
                        width_mm=Decimal("2000"),
                        height_mm=Decimal("2500"),
                        unit_price=Decimal("180.00"),
                        vat_category=VatCategory.STANDARD,
                    ),
                    InvoiceLineItemInput(
                        item_id=aluminium_powder.id,
                        description="Aluminium framing - powder coated",
                        length_mm=Decimal("12000"),
                        unit_price=Decimal("65.00"),
                        vat_category=VatCategory.STANDARD,
                    ),
                ],
            ),
        )
        await invoices_repo.set_status(db, invoice_1, InvoiceStatus.SENT, None)

        # 2. Tax invoice — partially paid
        invoice_2 = await invoices_repo.create(
            db,
            tenant,
            InvoiceCreate(
                type=InvoiceType.TAX_INVOICE,
                customer_id=al_reem.id,
                issue_date=today - timedelta(days=12),
                due_date=today + timedelta(days=18),
                lpo_no="LPO-2026-021",
                line_items=[
                    InvoiceLineItemInput(
                        item_id=float_glass.id,
                        description="6mm clear float glass - window panels",
                        width_mm=Decimal("1500"),
                        height_mm=Decimal("1000"),
                        unit_price=Decimal("95.00"),
                        vat_category=VatCategory.STANDARD,
                    ),
                    InvoiceLineItemInput(
                        item_id=door_handle.id,
                        description="Door handle set - stainless steel",
                        quantity=Decimal("10"),
                        unit_price=Decimal("85.00"),
                        vat_category=VatCategory.STANDARD,
                    ),
                ],
            ),
        )
        await invoices_repo.set_status(db, invoice_2, InvoiceStatus.SENT, None)

        # 3. Quotation — awaiting approval
        invoice_3 = await invoices_repo.create(
            db,
            tenant,
            InvoiceCreate(
                type=InvoiceType.QUOTATION,
                customer_id=falcon_interiors.id,
                issue_date=today - timedelta(days=2),
                lpo_no=None,
                line_items=[
                    InvoiceLineItemInput(
                        item_id=aluminium_mill.id,
                        description="Aluminium frame profile - shopfront",
                        length_mm=Decimal("20000"),
                        unit_price=Decimal("45.00"),
                        vat_category=VatCategory.STANDARD,
                    ),
                    InvoiceLineItemInput(
                        item_id=tempered_glass.id,
                        description="10mm tempered glass - shopfront glazing",
                        width_mm=Decimal("3000"),
                        height_mm=Decimal("1500"),
                        unit_price=Decimal("180.00"),
                        vat_category=VatCategory.STANDARD,
                    ),
                ],
            ),
        )

        # 4. Proforma — payment instructions before work starts
        await invoices_repo.create(
            db,
            tenant,
            InvoiceCreate(
                type=InvoiceType.PROFORMA,
                customer_id=burj_vista.id,
                issue_date=today - timedelta(days=1),
                lpo_no="LPO-2026-014",
                project_villa_no="Burj Vista Tower 2 - Floor 12",
                bill_to_address="Office 1204, Burj Vista Tower 2, Downtown Dubai, UAE",
                ship_to_address="Site office, Burj Vista Tower 2, Downtown Dubai, UAE",
                line_items=[
                    InvoiceLineItemInput(
                        item_id=tempered_glass.id,
                        description="10mm tempered glass partition - Floor 12 lobby",
                        width_mm=Decimal("2400"),
                        height_mm=Decimal("2700"),
                        unit_price=Decimal("180.00"),
                        vat_category=VatCategory.STANDARD,
                    ),
                ],
            ),
        )

        # 5. Purchase bill from supplier
        invoice_5 = await invoices_repo.create(
            db,
            tenant,
            InvoiceCreate(
                type=InvoiceType.PURCHASE_BILL,
                supplier_id=sharjah_glass.id,
                issue_date=today - timedelta(days=10),
                due_date=today + timedelta(days=20),
                line_items=[
                    InvoiceLineItemInput(
                        item_id=float_glass.id,
                        description="6mm clear float glass - stock replenishment",
                        quantity=Decimal("50"),
                        unit_price=Decimal("60.00"),
                        vat_category=VatCategory.STANDARD,
                    ),
                    InvoiceLineItemInput(
                        item_id=sealant.id,
                        description="Silicone sealant (clear) - stock replenishment",
                        quantity=Decimal("100"),
                        unit_price=Decimal("14.00"),
                        vat_category=VatCategory.STANDARD,
                    ),
                ],
            ),
        )
        await invoices_repo.set_status(db, invoice_5, InvoiceStatus.SENT, None)

        # --- Payments ------------------------------------------------------------
        payment_1 = await payments_repo.create(
            db,
            tenant.id,
            PaymentCreate(
                customer_id=burj_vista.id,
                amount=invoice_1.grand_total,
                method=PaymentMethod.BANK_TRANSFER,
                reference_no="FT26031500123",
                payment_date=today - timedelta(days=15),
                notes="Full settlement via bank transfer",
                allocations=[PaymentAllocationInput(invoice_id=invoice_1.id, amount=invoice_1.grand_total)],
            ),
        )

        half_invoice_2 = (invoice_2.grand_total / 2).quantize(Decimal("0.01"))
        await payments_repo.create(
            db,
            tenant.id,
            PaymentCreate(
                customer_id=al_reem.id,
                amount=half_invoice_2,
                method=PaymentMethod.CASH,
                payment_date=today - timedelta(days=6),
                notes="Advance payment on account",
                allocations=[PaymentAllocationInput(invoice_id=invoice_2.id, amount=half_invoice_2)],
            ),
        )

        half_invoice_5 = (invoice_5.grand_total / 2).quantize(Decimal("0.01"))
        await payments_repo.create(
            db,
            tenant.id,
            PaymentCreate(
                supplier_id=sharjah_glass.id,
                amount=half_invoice_5,
                method=PaymentMethod.CHEQUE,
                cheque_number="000482",
                cheque_date=today + timedelta(days=10),
                payment_date=today - timedelta(days=8),
                notes="Partial payment - post-dated cheque",
                allocations=[PaymentAllocationInput(invoice_id=invoice_5.id, amount=half_invoice_5)],
            ),
        )

        # --- Expenses --------------------------------------------------------------
        await expenses_repo.create(
            db,
            tenant.id,
            ExpenseCreate(
                category="Rent",
                amount=Decimal("8000.00"),
                vat_paid=Decimal("400.00"),
                expense_date=today - timedelta(days=18),
                notes="Warehouse rent - Al Quoz",
            ),
        )
        await expenses_repo.create(
            db,
            tenant.id,
            ExpenseCreate(
                category="Fuel & Transport",
                amount=Decimal("350.00"),
                vat_paid=Decimal("17.50"),
                expense_date=today - timedelta(days=4),
                notes="Site delivery van fuel",
            ),
        )

        # --- Job Register ------------------------------------------------------------
        await job_register_repo.create_row(
            db,
            tenant.id,
            JobRegisterRowCreate(
                qt_no=invoice_1.invoice_number,
                lpo_no="LPO-2026-014",
                description="Glass partition installation - Burj Vista Lobby",
                rate=invoice_1.grand_total,
                customer_id=burj_vista.id,
                source_invoice_id=invoice_1.id,
                work_status=JobWorkStatus.COMPLETED,
                tax_invoice_status=JobTaxInvoiceStatus.SUBMITTED,
                payment_status=JobPaymentStatus.RECEIVED,
                sort_order=0,
            ),
        )
        await job_register_repo.create_row(
            db,
            tenant.id,
            JobRegisterRowCreate(
                qt_no=invoice_2.invoice_number,
                lpo_no="LPO-2026-021",
                description="Window glazing & door hardware - Al Reem Tower B",
                rate=invoice_2.grand_total,
                customer_id=al_reem.id,
                source_invoice_id=invoice_2.id,
                work_status=JobWorkStatus.IN_PROGRESS,
                tax_invoice_status=JobTaxInvoiceStatus.SUBMITTED,
                payment_status=JobPaymentStatus.PENDING,
                sort_order=1,
            ),
        )
        await job_register_repo.create_row(
            db,
            tenant.id,
            JobRegisterRowCreate(
                qt_no=invoice_3.draft_number,
                description="Shopfront glazing - Falcon Interiors Showroom",
                rate=invoice_3.grand_total,
                customer_id=falcon_interiors.id,
                quotation_id=invoice_3.id,
                work_status=JobWorkStatus.NOT_COMPLETED,
                tax_invoice_status=JobTaxInvoiceStatus.NOT_SUBMITTED,
                payment_status=JobPaymentStatus.LPO_NOT_RECEIVED,
                sort_order=2,
            ),
        )

        await job_register_repo.create_receipt(
            db,
            tenant.id,
            JobReceiptCreate(
                customer_id=burj_vista.id,
                amount=payment_1.amount,
                receipt_date=today - timedelta(days=15),
                note=f"Bank transfer received against {invoice_1.invoice_number}",
                linked_payment_id=payment_1.id,
            ),
        )

        await db.commit()

    print(f"Demo tenant '{DEMO_BUSINESS_NAME}' seeded.")
    print(f"Log in with: {DEMO_EMAIL} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
