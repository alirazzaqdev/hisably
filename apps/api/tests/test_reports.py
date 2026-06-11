from decimal import Decimal


async def _create_customer(client, auth_headers, name="Acme Trading") -> str:
    resp = await client.post("/api/v1/customers", json={"name": name}, headers=auth_headers)
    return resp.json()["id"]


async def _create_invoice(client, auth_headers, customer_id: str, unit_price: str, issue_date: str = "2026-06-01") -> dict:
    resp = await client.post(
        "/api/v1/invoices",
        json={
            "customer_id": customer_id,
            "issue_date": issue_date,
            "due_date": "2026-06-15",
            "line_items": [
                {"description": "Glass panel", "quantity": "1", "unit_price": unit_price, "vat_category": "standard"},
            ],
        },
        headers=auth_headers,
    )
    invoice = resp.json()
    await client.patch(f"/api/v1/invoices/{invoice['id']}/status", json={"status": "sent"}, headers=auth_headers)
    return invoice


async def test_dashboard_kpis_and_reports(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, "100.00")
    invoice_id = invoice["id"]

    await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "105.00",
            "method": "cash",
            "payment_date": "2026-06-05",
            "allocations": [{"invoice_id": invoice_id, "amount": "105.00"}],
        },
        headers=auth_headers,
    )

    await client.post(
        "/api/v1/expenses",
        json={"category": "Rent", "amount": "500.00", "vat_paid": "25.00", "expense_date": "2026-06-02"},
        headers=auth_headers,
    )

    kpis_resp = await client.get("/api/v1/dashboard/kpis", headers=auth_headers)
    assert kpis_resp.status_code == 200
    kpis = kpis_resp.json()
    assert kpis["total_customers"] == 1
    assert kpis["total_invoices"] == 1
    assert kpis["revenue_paid"] == "105.00"
    assert kpis["outstanding_receivables"] == "0.00"

    trend_resp = await client.get("/api/v1/dashboard/sales-trend", headers=auth_headers)
    assert trend_resp.status_code == 200
    trend = trend_resp.json()
    assert any(p["period"] == "2026-06" and p["paid_total"] == "105.00" for p in trend)

    top_customers_resp = await client.get("/api/v1/dashboard/top-customers", headers=auth_headers)
    assert top_customers_resp.status_code == 200
    top_customers = top_customers_resp.json()
    assert top_customers[0]["name"] == "Acme Trading"
    assert top_customers[0]["total_invoiced"] == "105.00"

    top_items_resp = await client.get("/api/v1/dashboard/top-items", headers=auth_headers)
    assert top_items_resp.status_code == 200
    assert top_items_resp.json()[0]["description"] == "Glass panel"

    aging_resp = await client.get("/api/v1/dashboard/receivables-aging", headers=auth_headers)
    assert aging_resp.status_code == 200
    assert {b["label"] for b in aging_resp.json()} == {
        "Current",
        "1-30 days",
        "31-60 days",
        "61-90 days",
        "90+ days",
    }

    vat_resp = await client.get("/api/v1/reports/vat-summary", headers=auth_headers)
    assert vat_resp.status_code == 200
    vat = vat_resp.json()
    assert vat["output_vat"] == "5.00"
    assert vat["input_vat"] == "25.00"
    assert vat["net_vat_due"] == "-20.00"


async def test_dashboard_requires_auth(client):
    resp = await client.get("/api/v1/dashboard/kpis")
    assert resp.status_code == 401


async def test_day_book(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers)
    invoice = await _create_invoice(client, auth_headers, customer_id, "100.00", issue_date="2026-06-10")
    invoice_id = invoice["id"]

    await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "105.00",
            "method": "cash",
            "payment_date": "2026-06-10",
            "allocations": [{"invoice_id": invoice_id, "amount": "105.00"}],
        },
        headers=auth_headers,
    )

    await client.post(
        "/api/v1/expenses",
        json={"category": "Rent", "amount": "500.00", "vat_paid": "25.00", "expense_date": "2026-06-10"},
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/reports/day-book", params={"date_from": "2026-06-10"}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    types = {entry["type"] for entry in data["entries"]}
    assert types == {"tax_invoice", "payment", "expense"}
    assert data["total_in"] == "210.00"
    assert data["total_out"] == "500.00"

    other_day_resp = await client.get(
        "/api/v1/reports/day-book", params={"date_from": "2026-06-11"}, headers=auth_headers
    )
    assert other_day_resp.json()["entries"] == []


async def test_profit_loss_and_balance_sheet(client, auth_headers):
    item_resp = await client.post(
        "/api/v1/items",
        json={
            "name": "Glass Sheet",
            "sku": "GLS-100",
            "unit": "pcs",
            "sale_price": "150.00",
            "purchase_price": "100.00",
            "track_inventory": True,
            "current_stock": "10",
            "low_stock_threshold": "2",
        },
        headers=auth_headers,
    )
    item_id = item_resp.json()["id"]

    customer_id = await _create_customer(client, auth_headers)

    invoice_resp = await client.post(
        "/api/v1/invoices",
        json={
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "due_date": "2026-06-15",
            "line_items": [
                {
                    "item_id": item_id,
                    "description": "Glass Sheet",
                    "quantity": "2",
                    "unit_price": "150.00",
                    "vat_category": "standard",
                },
            ],
        },
        headers=auth_headers,
    )
    invoice = invoice_resp.json()
    await client.patch(
        f"/api/v1/invoices/{invoice['id']}/status", json={"status": "sent"}, headers=auth_headers
    )

    await client.post(
        "/api/v1/payments",
        json={
            "customer_id": customer_id,
            "amount": "150.00",
            "method": "cash",
            "payment_date": "2026-06-05",
            "allocations": [{"invoice_id": invoice["id"], "amount": "150.00"}],
        },
        headers=auth_headers,
    )

    await client.post(
        "/api/v1/expenses",
        json={"category": "Rent", "amount": "50.00", "vat_paid": "0", "expense_date": "2026-06-02"},
        headers=auth_headers,
    )

    pl_resp = await client.get(
        "/api/v1/reports/profit-loss",
        params={"date_from": "2026-06-01", "date_to": "2026-06-30"},
        headers=auth_headers,
    )
    assert pl_resp.status_code == 200
    pl = pl_resp.json()
    assert Decimal(pl["sales_revenue"]) == Decimal("300.00")
    assert Decimal(pl["sales_returns"]) == Decimal("0")
    assert Decimal(pl["net_revenue"]) == Decimal("300.00")
    assert Decimal(pl["cost_of_goods_sold"]) == Decimal("200.00")
    assert Decimal(pl["gross_profit"]) == Decimal("100.00")
    assert any(
        e["category"] == "Rent" and Decimal(e["amount"]) == Decimal("50.00") for e in pl["expenses_by_category"]
    )
    assert Decimal(pl["total_expenses"]) == Decimal("50.00")
    assert Decimal(pl["net_profit"]) == Decimal("50.00")

    bs_resp = await client.get("/api/v1/reports/balance-sheet", headers=auth_headers)
    assert bs_resp.status_code == 200
    bs = bs_resp.json()
    assert Decimal(bs["cash_and_bank"]) == Decimal("100.00")
    assert Decimal(bs["accounts_receivable"]) == Decimal("165.00")
    assert Decimal(bs["inventory_value"]) == Decimal("1000.00")
    assert Decimal(bs["accounts_payable"]) == Decimal("0")


async def test_stock_summary(client, auth_headers):
    await client.post(
        "/api/v1/items",
        json={
            "name": "Glass Sheet",
            "sku": "GLS-001",
            "unit": "pcs",
            "sale_price": "150.00",
            "purchase_price": "100.00",
            "track_inventory": True,
            "current_stock": "20",
            "low_stock_threshold": "5",
        },
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/items",
        json={
            "name": "Untracked Service",
            "sale_price": "50.00",
            "purchase_price": "0",
            "track_inventory": False,
        },
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/reports/stock-summary", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    item = data["items"][0]
    assert item["name"] == "Glass Sheet"
    assert item["current_stock"] == "20.000"
    assert item["stock_value"] == "2000.00000"
    assert data["total_stock_value"] == "2000.00000"


async def test_multi_currency_invoice_converted_to_base_currency(client, auth_headers):
    customer_id = await _create_customer(client, auth_headers, name="Foreign Buyer")

    create_resp = await client.post(
        "/api/v1/invoices",
        json={
            "customer_id": customer_id,
            "issue_date": "2026-06-01",
            "due_date": "2026-06-15",
            "currency": "USD",
            "exchange_rate": "3.67",
            "line_items": [
                {"description": "Export item", "quantity": "1", "unit_price": "100.00", "vat_category": "zero_rated"},
            ],
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    invoice = create_resp.json()
    assert invoice["currency"] == "USD"
    assert invoice["exchange_rate"] == "3.67"
    assert invoice["grand_total"] == "100.00"

    await client.patch(f"/api/v1/invoices/{invoice['id']}/status", json={"status": "sent"}, headers=auth_headers)

    kpis_resp = await client.get("/api/v1/dashboard/kpis", headers=auth_headers)
    assert kpis_resp.status_code == 200
    kpis = kpis_resp.json()
    assert Decimal(kpis["outstanding_receivables"]) == Decimal("367.00")

    statement_resp = await client.get(f"/api/v1/customers/{customer_id}/statement", headers=auth_headers)
    assert statement_resp.status_code == 200
    statement = statement_resp.json()
    assert Decimal(statement["closing_balance"]) == Decimal("367.00")
