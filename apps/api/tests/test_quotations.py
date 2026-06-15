import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.models.enums import QuotationStatus
from app.models.invoice import Invoice


async def _create_customer(client, auth_headers) -> str:
    resp = await client.post("/api/v1/customers", json={"name": "Acme Trading"}, headers=auth_headers)
    return resp.json()["id"]


async def _create_quotation(client, auth_headers, customer_id, due_date: str | None = None) -> dict:
    payload = {
        "type": "quotation",
        "customer_id": customer_id,
        "issue_date": "2026-06-01",
        "line_items": [
            {"description": "Glass partition", "quantity": "1", "unit_price": "500.00", "vat_category": "standard"},
        ],
    }
    if due_date is not None:
        payload["due_date"] = due_date
    resp = await client.post("/api/v1/invoices", json=payload, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


async def _set_quotation_status(db_session, quotation_id: str, status: QuotationStatus) -> None:
    result = await db_session.execute(select(Invoice).where(Invoice.id == uuid.UUID(quotation_id)))
    invoice = result.scalar_one()
    invoice.quotation_status = status
    await db_session.flush()
    await db_session.commit()


async def test_new_quotation_starts_as_draft(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    quotation = await _create_quotation(client, auth_headers, customer_id)
    assert quotation["quotation_status"] == "draft"
    assert quotation["effective_quotation_status"] == "draft"


async def test_quotation_pdf_renders_with_quotation_labels(client, auth_headers, db_session):
    customer_id = await _create_customer(client, auth_headers)
    quotation = await _create_quotation(client, auth_headers, customer_id, due_date="2026-12-01")
    await _set_quotation_status(db_session, quotation["id"], QuotationStatus.APPROVED)

    pdf_resp = await client.get(f"/api/v1/invoices/{quotation['id']}/pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content[:4] == b"%PDF"

    share_resp = await client.post(f"/api/v1/invoices/{quotation['id']}/share", headers=auth_headers)
    assert share_resp.status_code == 200
    token = share_resp.json()["public_token"]
    assert token

    public_pdf_resp = await client.get(f"/api/v1/public/invoices/{token}/pdf")
    assert public_pdf_resp.status_code == 200
    assert public_pdf_resp.headers["content-type"] == "application/pdf"
    assert public_pdf_resp.content[:4] == b"%PDF"


async def test_quotation_counts_and_listing_by_status(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    draft = await _create_quotation(client, auth_headers, customer_id)

    counts_resp = await client.get("/api/v1/quotations/counts", headers=auth_headers)
    assert counts_resp.status_code == 200
    counts = counts_resp.json()
    assert counts["draft"] == 1
    assert counts["total"] == 1

    list_resp = await client.get("/api/v1/quotations", params={"status": "draft"}, headers=auth_headers)
    assert list_resp.status_code == 200
    page = list_resp.json()
    assert page["total"] == 1
    assert page["items"][0]["id"] == draft["id"]

    empty_resp = await client.get("/api/v1/quotations", params={"status": "pending"}, headers=auth_headers)
    assert empty_resp.json()["total"] == 0


async def test_draft_cannot_jump_to_approved(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    quotation = await _create_quotation(client, auth_headers, customer_id, due_date="2026-12-01")

    bad_resp = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status", json={"status": "approved"}, headers=auth_headers
    )
    assert bad_resp.status_code == 409


async def test_draft_quotation_can_be_finalized_to_pending(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    quotation = await _create_quotation(client, auth_headers, customer_id)

    missing_due_resp = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status", json={"status": "pending"}, headers=auth_headers
    )
    assert missing_due_resp.status_code == 422

    due_date = (date.today() + timedelta(days=14)).isoformat()
    finalize_resp = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "pending", "due_date": due_date},
        headers=auth_headers,
    )
    assert finalize_resp.status_code == 200
    finalized = finalize_resp.json()
    assert finalized["quotation_status"] == "pending"
    assert finalized["effective_quotation_status"] == "pending"
    assert finalized["due_date"] == due_date


async def test_pending_quotation_can_be_approved_and_rejected(client, auth_headers, db_session):
    customer_id = await _create_customer(client, auth_headers)
    approve_target = await _create_quotation(client, auth_headers, customer_id, due_date="2026-12-01")
    reject_target = await _create_quotation(client, auth_headers, customer_id, due_date="2026-12-01")

    await _set_quotation_status(db_session, approve_target["id"], QuotationStatus.PENDING)
    await _set_quotation_status(db_session, reject_target["id"], QuotationStatus.PENDING)

    counts_resp = await client.get("/api/v1/quotations/counts", headers=auth_headers)
    assert counts_resp.json()["pending"] == 2

    approve_resp = await client.patch(
        f"/api/v1/quotations/{approve_target['id']}/status", json={"status": "approved"}, headers=auth_headers
    )
    assert approve_resp.status_code == 200
    assert approve_resp.json()["quotation_status"] == "approved"
    assert approve_resp.json()["effective_quotation_status"] == "approved"

    reject_resp = await client.patch(
        f"/api/v1/quotations/{reject_target['id']}/status", json={"status": "rejected"}, headers=auth_headers
    )
    assert reject_resp.status_code == 200
    assert reject_resp.json()["quotation_status"] == "rejected"

    # Approved/Rejected are terminal — no further manual transitions allowed.
    relapse_resp = await client.patch(
        f"/api/v1/quotations/{approve_target['id']}/status", json={"status": "pending", "due_date": "2026-12-31"},
        headers=auth_headers,
    )
    assert relapse_resp.status_code == 409


async def test_pending_quotation_past_due_date_is_expired_and_can_be_renewed(client, auth_headers, db_session):
    customer_id = await _create_customer(client, auth_headers)
    past_due = (date.today() - timedelta(days=5)).isoformat()
    quotation = await _create_quotation(client, auth_headers, customer_id, due_date=past_due)
    await _set_quotation_status(db_session, quotation["id"], QuotationStatus.PENDING)

    get_resp = await client.get(f"/api/v1/invoices/{quotation['id']}", headers=auth_headers)
    assert get_resp.json()["quotation_status"] == "pending"
    assert get_resp.json()["effective_quotation_status"] == "expired"

    counts_resp = await client.get("/api/v1/quotations/counts", headers=auth_headers)
    counts = counts_resp.json()
    assert counts["expired"] == 1
    assert counts["pending"] == 0

    list_resp = await client.get("/api/v1/quotations", params={"status": "expired"}, headers=auth_headers)
    assert list_resp.json()["total"] == 1

    new_due = (date.today() + timedelta(days=14)).isoformat()
    renew_resp = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "pending", "due_date": new_due},
        headers=auth_headers,
    )
    assert renew_resp.status_code == 200
    renewed = renew_resp.json()
    assert renewed["quotation_status"] == "pending"
    assert renewed["effective_quotation_status"] == "pending"
    assert renewed["due_date"] == new_due

    counts_resp = await client.get("/api/v1/quotations/counts", headers=auth_headers)
    counts = counts_resp.json()
    assert counts["expired"] == 0
    assert counts["pending"] == 1


async def test_renew_requires_due_date_in_future(client, auth_headers, db_session):
    customer_id = await _create_customer(client, auth_headers)
    past_due = (date.today() - timedelta(days=5)).isoformat()
    quotation = await _create_quotation(client, auth_headers, customer_id, due_date=past_due)
    await _set_quotation_status(db_session, quotation["id"], QuotationStatus.PENDING)

    missing_due_resp = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status", json={"status": "pending"}, headers=auth_headers
    )
    assert missing_due_resp.status_code == 422

    past_due_resp = await client.patch(
        f"/api/v1/quotations/{quotation['id']}/status",
        json={"status": "pending", "due_date": past_due},
        headers=auth_headers,
    )
    assert past_due_resp.status_code == 422
