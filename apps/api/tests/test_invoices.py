async def _create_customer(client, auth_headers) -> str:
    resp = await client.post("/api/v1/customers", json={"name": "Acme Trading"}, headers=auth_headers)
    return resp.json()["id"]


async def test_invoice_crud_totals_and_pdf(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    create_resp = await client.post(
        "/api/v1/invoices",
        json={
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "due_date": "2026-06-15",
            "line_items": [
                {"description": "Glass panel", "quantity": "2", "unit_price": "100.00", "vat_category": "standard"},
                {"description": "Installation", "quantity": "1", "unit_price": "50.00", "vat_category": "zero_rated"},
            ],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    invoice = create_resp.json()
    assert invoice["status"] == "draft"
    assert invoice["invoice_number"] == "INV-0001"
    assert invoice["subtotal"] == "250.00"
    assert invoice["vat_total"] == "10.00"
    assert invoice["grand_total"] == "260.00"
    assert len(invoice["line_items"]) == 2
    assert invoice["line_items"][0]["line_total"] == "210.00"

    invoice_id = invoice["id"]

    list_resp = await client.get("/api/v1/invoices", headers=auth_headers)
    assert list_resp.status_code == 200
    page = list_resp.json()
    assert page["total"] == 1

    get_resp = await client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert get_resp.status_code == 200

    patch_resp = await client.patch(
        f"/api/v1/invoices/{invoice_id}",
        json={
            "line_items": [
                {"description": "Glass panel", "quantity": "3", "unit_price": "100.00", "vat_category": "standard"},
            ]
        },
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert len(updated["line_items"]) == 1
    assert updated["subtotal"] == "300.00"
    assert updated["grand_total"] == "315.00"

    status_resp = await client.patch(
        f"/api/v1/invoices/{invoice_id}/status", json={"status": "sent"}, headers=auth_headers
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "sent"

    delete_resp = await client.delete(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert delete_resp.status_code == 409

    void_resp = await client.patch(
        f"/api/v1/invoices/{invoice_id}/status",
        json={"status": "void", "void_reason": "Customer cancelled"},
        headers=auth_headers,
    )
    assert void_resp.status_code == 200
    assert void_resp.json()["status"] == "void"
    assert void_resp.json()["void_reason"] == "Customer cancelled"

    pdf_resp = await client.get(f"/api/v1/invoices/{invoice_id}/pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content[:4] == b"%PDF"


async def test_invoice_numbers_increment_per_type(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    payload = {
        "customer_id": customer_id,
        "issue_date": "2026-06-01",
        "line_items": [{"description": "Item", "quantity": "1", "unit_price": "10.00"}],
    }

    first = await client.post("/api/v1/invoices", json=payload, headers=auth_headers)
    second = await client.post("/api/v1/invoices", json=payload, headers=auth_headers)

    assert first.json()["invoice_number"] == "INV-0001"
    assert second.json()["invoice_number"] == "INV-0002"


async def test_invoices_require_auth(client):
    resp = await client.get("/api/v1/invoices")
    assert resp.status_code == 401


async def test_draft_only_invoices_can_be_deleted(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    create_resp = await client.post(
        "/api/v1/invoices",
        json={
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "line_items": [{"description": "Item", "quantity": "1", "unit_price": "10.00"}],
        },
        headers=auth_headers,
    )
    invoice_id = create_resp.json()["id"]

    delete_resp = await client.delete(f"/api/v1/invoices/{invoice_id}", headers=auth_headers)
    assert delete_resp.status_code == 204


async def test_quotation_can_be_converted_to_tax_invoice(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    quotation_resp = await client.post(
        "/api/v1/invoices",
        json={
            "type": "quotation",
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "line_items": [
                {"description": "Glass partition", "quantity": "1", "unit_price": "500.00", "vat_category": "standard"},
            ],
        },
        headers=auth_headers,
    )
    assert quotation_resp.status_code == 201
    quotation = quotation_resp.json()
    assert quotation["type"] == "quotation"

    invoice_resp = await client.post(
        "/api/v1/invoices",
        json={
            "type": "tax_invoice",
            "customer_id": customer_id,
            "converted_from_id": quotation["id"],
            "issue_date": "2026-06-02",
            "line_items": quotation["line_items"],
        },
        headers=auth_headers,
    )
    assert invoice_resp.status_code == 201
    invoice = invoice_resp.json()
    assert invoice["type"] == "tax_invoice"
    assert invoice["converted_from_id"] == quotation["id"]
    assert invoice["grand_total"] == quotation["grand_total"]

    type_filter_resp = await client.get("/api/v1/invoices", params={"type": "quotation"}, headers=auth_headers)
    assert type_filter_resp.json()["total"] == 1


async def test_invoice_share_link_and_public_pdf(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    invoice_resp = await client.post(
        "/api/v1/invoices",
        json={
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "line_items": [
                {"description": "Glass panel", "quantity": "1", "unit_price": "100.00", "vat_category": "standard"},
            ],
        },
        headers=auth_headers,
    )
    invoice = invoice_resp.json()
    assert invoice["public_token"] is None

    share_resp = await client.post(f"/api/v1/invoices/{invoice['id']}/share", headers=auth_headers)
    assert share_resp.status_code == 200
    token = share_resp.json()["public_token"]
    assert token

    pdf_resp = await client.get(f"/api/v1/public/invoices/{token}/pdf")
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content[:4] == b"%PDF"

    bad_resp = await client.get("/api/v1/public/invoices/not-a-real-token/pdf")
    assert bad_resp.status_code == 404


async def test_proforma_invoice_layout_and_pdf(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    tenant_resp = await client.patch(
        "/api/v1/tenants/me",
        json={
            "cheque_payee_name": "Acme Trading LLC",
            "bank_name": "Emirates Bank",
            "bank_account_number": "1234567890",
            "bank_iban": "AE000123456789012345678",
            "contact_person": "John Doe",
            "contact_phone": "+971500000000",
        },
        headers=auth_headers,
    )
    assert tenant_resp.status_code == 200
    tenant = tenant_resp.json()
    assert tenant["bank_name"] == "Emirates Bank"

    create_resp = await client.post(
        "/api/v1/invoices",
        json={
            "type": "proforma",
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "lpo_no": "LPO-001",
            "project_villa_no": "Villa No# 1491",
            "bill_to_address": "123 Bill St, Dubai",
            "ship_to_address": "456 Ship St, Dubai",
            "line_items": [
                {
                    "description": "Aluminium frames",
                    "quantity": "10",
                    "unit_price": "100.00",
                    "final_payment_factor": "0.5",
                    "vat_category": "standard",
                },
            ],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    invoice = create_resp.json()
    assert invoice["type"] == "proforma"
    assert invoice["lpo_no"] == "LPO-001"
    assert invoice["project_villa_no"] == "Villa No# 1491"
    assert invoice["bill_to_address"] == "123 Bill St, Dubai"
    assert invoice["ship_to_address"] == "456 Ship St, Dubai"
    assert invoice["line_items"][0]["final_payment_factor"] == "0.5"
    assert invoice["line_items"][0]["line_total"] == "525.00"

    pdf_resp = await client.get(f"/api/v1/invoices/{invoice['id']}/pdf", headers=auth_headers)
    assert pdf_resp.status_code == 200
    assert pdf_resp.headers["content-type"] == "application/pdf"
    assert pdf_resp.content[:4] == b"%PDF"


async def test_invoice_template_customization(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)

    for template, accent_color, language in [
        ("minimal", None, "en"),
        ("classic", "#1e3a5f", "ar"),
        ("bold", "#b91c1c", "bilingual"),
    ]:
        create_resp = await client.post(
            "/api/v1/invoices",
            json={
                "customer_id": customer_id,
                "issue_date": "2026-06-01",
                "pdf_template": template,
                "accent_color": accent_color,
                "language": language,
                "line_items": [
                    {"description": "Glass panel", "quantity": "1", "unit_price": "100.00", "vat_category": "standard"},
                ],
            },
            headers=auth_headers,
        )
        assert create_resp.status_code == 201
        invoice = create_resp.json()
        assert invoice["pdf_template"] == template
        assert invoice["accent_color"] == accent_color
        assert invoice["language"] == language

        pdf_resp = await client.get(f"/api/v1/invoices/{invoice['id']}/pdf", headers=auth_headers)
        assert pdf_resp.status_code == 200
        assert pdf_resp.headers["content-type"] == "application/pdf"
        assert pdf_resp.content[:4] == b"%PDF"

    patch_resp = await client.patch(
        f"/api/v1/invoices/{invoice['id']}",
        json={"pdf_template": "minimal", "accent_color": "#22c55e", "language": "en"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200
    updated = patch_resp.json()
    assert updated["pdf_template"] == "minimal"
    assert updated["accent_color"] == "#22c55e"
    assert updated["language"] == "en"
