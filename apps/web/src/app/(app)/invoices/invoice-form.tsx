"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  computeInvoiceTotals,
  computeLineItem,
  toMajorUnits,
  toMinorUnits,
  type Country,
  type InvoiceLineItemInput as SharedLineItemInput,
} from "@hisably/shared";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { attachmentsApi } from "@/lib/api/attachments";
import { customersApi } from "@/lib/api/customers";
import { suppliersApi } from "@/lib/api/suppliers";
import { tenantsApi } from "@/lib/api/tenants";
import { itemsApi, type Item, type VatCategory } from "@/lib/api/items";
import { priceListsApi } from "@/lib/api/price-lists";
import {
  invoicesApi,
  type Invoice,
  type InvoiceInput,
  type InvoiceLanguage,
  type InvoiceLineItemInput,
  type InvoiceType,
  type PdfTemplate,
} from "@/lib/api/invoices";
import { createOrQueue } from "@/lib/offline/sync-engine";

const VAT_CATEGORIES: { value: VatCategory; label: string }[] = [
  { value: "standard", label: "Standard (5%)" },
  { value: "zero_rated", label: "Zero-rated" },
  { value: "exempt", label: "Exempt" },
];

const DOCUMENT_TYPES: { value: InvoiceType; label: string }[] = [
  { value: "tax_invoice", label: "Tax invoice" },
  { value: "quotation", label: "Quotation" },
  { value: "proforma", label: "Proforma invoice" },
  { value: "credit_note", label: "Credit note (sales return)" },
  { value: "purchase_bill", label: "Purchase bill" },
  { value: "debit_note", label: "Debit note (purchase return)" },
];

const SUPPLIER_TYPES: InvoiceType[] = ["purchase_bill", "debit_note"];

const PDF_TEMPLATES: { value: PdfTemplate; label: string }[] = [
  { value: "minimal", label: "Minimal" },
  { value: "classic", label: "Classic" },
  { value: "bold", label: "Bold" },
];

const INVOICE_LANGUAGES: { value: InvoiceLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "bilingual", label: "Bilingual (EN/AR)" },
];

const CURRENCIES = [
  "AED", "AUD", "BDT", "BHD", "CAD", "CHF", "CNY", "DKK", "EGP", "EUR", "GBP", "IDR", "ILS", "INR",
  "JOD", "JPY", "KES", "KRW", "KWD", "LBP", "MAD", "MXN", "MYR", "NGN", "NOK", "NZD", "OMR", "PHP",
  "PKR", "PLN", "QAR", "SAR", "SEK", "SGD", "THB", "TND", "TRY", "USD", "VND", "ZAR",
];

function emptyLine(): InvoiceLineItemInput {
  return { description: "", quantity: "1", unit_price: "0", vat_category: "standard" };
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InvoiceForm({ invoice }: { invoice?: Invoice }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const isEditing = Boolean(invoice);

  const fromInvoiceId = searchParams.get("from");
  const typeParam = searchParams.get("type") as InvoiceType | null;

  const { data: customers } = useQuery({
    queryKey: ["customers", "all"],
    queryFn: () => customersApi.list({ pageSize: 100 }),
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "all"],
    queryFn: () => suppliersApi.list({ pageSize: 100 }),
  });
  const { data: items } = useQuery({
    queryKey: ["items", "all"],
    queryFn: () => itemsApi.list({ pageSize: 100 }),
  });
  const { data: sourceInvoice } = useQuery({
    queryKey: ["invoices", fromInvoiceId],
    queryFn: () => invoicesApi.get(fromInvoiceId!),
    enabled: Boolean(fromInvoiceId) && !isEditing,
  });
  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });

  const [type, setType] = useState<InvoiceType>(invoice?.type ?? typeParam ?? "tax_invoice");
  const [customerId, setCustomerId] = useState(invoice?.customer_id ?? "");
  const [supplierId, setSupplierId] = useState(invoice?.supplier_id ?? "");
  const [convertedFromId, setConvertedFromId] = useState<string | null>(invoice?.converted_from_id ?? null);
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? todayIso());
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [currency, setCurrency] = useState(invoice?.currency ?? "");
  const [exchangeRate, setExchangeRate] = useState(invoice?.exchange_rate ?? "1");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [terms, setTerms] = useState(invoice?.terms ?? "");
  const [discountAmount, setDiscountAmount] = useState(invoice?.discount_amount ?? "0");
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>(invoice?.pdf_template ?? "minimal");
  const [accentColor, setAccentColor] = useState(invoice?.accent_color ?? "");
  const [language, setLanguage] = useState<InvoiceLanguage>(invoice?.language ?? "en");
  const [lpoNo, setLpoNo] = useState(invoice?.lpo_no ?? "");
  const [projectVillaNo, setProjectVillaNo] = useState(invoice?.project_villa_no ?? "");
  const [billToAddress, setBillToAddress] = useState(invoice?.bill_to_address ?? "");
  const [shipToAddress, setShipToAddress] = useState(invoice?.ship_to_address ?? "");
  const [siteImageUrl, setSiteImageUrl] = useState(invoice?.site_image_url ?? "");
  const [uploadingSiteImage, setUploadingSiteImage] = useState(false);
  const [lines, setLines] = useState<InvoiceLineItemInput[]>(
    invoice?.line_items?.length
      ? invoice.line_items.map((li) => ({
          item_id: li.item_id,
          description: li.description,
          quantity: li.quantity,
          width_mm: li.width_mm,
          height_mm: li.height_mm,
          length_mm: li.length_mm,
          unit_price: li.unit_price,
          discount_percent: li.discount_percent,
          override_total: li.override_total,
          final_payment_factor: li.final_payment_factor,
          vat_category: li.vat_category,
        }))
      : [emptyLine()]
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const selectedCustomer = customers?.items.find((c) => c.id === customerId);
  const { data: priceListItems } = useQuery({
    queryKey: ["price-lists", selectedCustomer?.price_list_id, "prices"],
    queryFn: () => priceListsApi.itemPrices(selectedCustomer!.price_list_id!),
    enabled: Boolean(selectedCustomer?.price_list_id),
  });
  const priceByItemId = new Map(priceListItems?.map((p) => [p.item_id, p.price]));
  const country = resolveCountry(tenant?.country);
  const vatRateOverride = tenant?.vat_rate !== undefined ? Number(tenant.vat_rate) : undefined;

  useEffect(() => {
    if (invoice || !tenant?.currency) return;
    setCurrency((prev) => prev || tenant.currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.currency]);

  useEffect(() => {
    if (!selectedCustomer?.billing_address) return;
    setBillToAddress((prev) => prev || selectedCustomer.billing_address || "");
    setShipToAddress((prev) => prev || selectedCustomer.billing_address || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    if (!sourceInvoice || isEditing) return;
    setCustomerId(sourceInvoice.customer_id ?? "");
    setSupplierId(sourceInvoice.supplier_id ?? "");
    setConvertedFromId(sourceInvoice.id);
    setLpoNo(sourceInvoice.lpo_no ?? "");
    setProjectVillaNo(sourceInvoice.project_villa_no ?? "");
    setBillToAddress(sourceInvoice.bill_to_address ?? "");
    setShipToAddress(sourceInvoice.ship_to_address ?? "");
    const isQuotationToProforma = type === "proforma" && sourceInvoice.type === "quotation";
    setLines(
      sourceInvoice.line_items.map((li) => {
        if (isQuotationToProforma) {
          const computed = computeLine(li, country, vatRateOverride);
          return {
            item_id: li.item_id,
            description: li.description,
            quantity: "1",
            unit_price: computed.gross.toFixed(2),
            final_payment_factor: "1",
            vat_category: li.vat_category,
          };
        }
        return {
          item_id: li.item_id,
          description: li.description,
          quantity: li.quantity,
          width_mm: li.width_mm,
          height_mm: li.height_mm,
          length_mm: li.length_mm,
          unit_price: li.unit_price,
          discount_percent: li.discount_percent,
          override_total: li.override_total,
          final_payment_factor: type === "proforma" ? li.final_payment_factor : null,
          vat_category: li.vat_category,
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceInvoice, isEditing]);

  const isSupplierDoc = SUPPLIER_TYPES.includes(type);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: InvoiceInput = {
        type,
        customer_id: isSupplierDoc ? null : customerId || null,
        supplier_id: isSupplierDoc ? supplierId || null : null,
        issue_date: issueDate,
        due_date: dueDate || null,
        currency: currency || undefined,
        exchange_rate: exchangeRate || "1",
        discount_amount: discountAmount || "0",
        notes: notes || null,
        terms: terms || null,
        pdf_template: pdfTemplate,
        accent_color: accentColor || null,
        language,
        lpo_no: type === "proforma" ? lpoNo || null : null,
        project_villa_no: type === "proforma" ? projectVillaNo || null : null,
        bill_to_address: type === "proforma" ? billToAddress || null : null,
        ship_to_address: type === "proforma" ? shipToAddress || null : null,
        site_image_url: type === "quotation" ? siteImageUrl || null : null,
        line_items: lines,
        converted_from_id: convertedFromId,
      };
      return isEditing
        ? invoicesApi.update(invoice!.id, payload)
        : createOrQueue("invoice", payload, invoicesApi.create);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push(saved ? `/invoices/${saved.id}` : "/invoices");
    },
    onError: (error) => {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
        return;
      }
      setFormError("Something went wrong. Please try again.");
    },
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    saveMutation.mutate();
  }

  function updateLine(index: number, patch: Partial<InvoiceLineItemInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function applyItemToLine(index: number, item: Item) {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index
          ? {
              ...line,
              item_id: item.id,
              description: item.name,
              unit_price: priceByItemId.get(item.id) ?? item.sale_price,
              vat_category: item.vat_category,
            }
          : line
      )
    );
  }

  function applyItem(index: number, itemId: string) {
    const item = items?.items.find((i) => i.id === itemId);
    if (!item) {
      updateLine(index, { item_id: null });
      return;
    }
    applyItemToLine(index, item);
  }

  async function handleBarcodeScan(barcode: string) {
    if (!barcode.trim()) return;
    try {
      const item = await itemsApi.getByBarcode(barcode.trim());
      setLines((prev) => {
        const emptyIndex = prev.findIndex((line) => !line.item_id && !line.description);
        const next =
          emptyIndex !== -1 ? [...prev] : [...prev, emptyLine()];
        const targetIndex = emptyIndex !== -1 ? emptyIndex : next.length - 1;
        next[targetIndex] = {
          ...next[targetIndex],
          item_id: item.id,
          description: item.name,
          unit_price: priceByItemId.get(item.id) ?? item.sale_price,
          vat_category: item.vat_category,
        };
        return next;
      });
      setBarcodeInput("");
      setBarcodeError(null);
    } catch {
      setBarcodeError(`No item found for barcode "${barcode}"`);
    }
  }

  async function handleSiteImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingSiteImage(true);
    setFormError(null);
    try {
      const attachment = await attachmentsApi.upload(file, "quotation_site_image");
      setSiteImageUrl(attachment.file_url);
    } catch (error) {
      if (error instanceof ApiError && typeof error.detail === "string") {
        setFormError(error.detail);
      } else {
        setFormError("Failed to upload image. Please try again.");
      }
    } finally {
      setUploadingSiteImage(false);
      event.target.value = "";
    }
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const totals = computeTotals(lines, discountAmount, country, vatRateOverride);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>
          {isEditing
            ? type === "quotation"
              ? "Edit quotation"
              : "Edit invoice"
            : type === "quotation"
              ? "New quotation"
              : "New invoice"}
        </CardTitle>
        <CardDescription>
          {isEditing
            ? type === "quotation"
              ? "Update this quotation's details."
              : "Update this invoice's details."
            : type === "quotation"
              ? "Create a rate offer to send to a customer."
              : "Create a new invoice for a customer."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-3">
            {!isEditing && (
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="doc_type">Document type</Label>
                <Select id="doc_type" value={type} onChange={(e) => setType(e.target.value as InvoiceType)}>
                  {DOCUMENT_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {isSupplierDoc ? (
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="supplier">Supplier</Label>
                <Select id="supplier" value={supplierId ?? ""} onChange={(e) => setSupplierId(e.target.value)}>
                  <option value="">No supplier</option>
                  {suppliers?.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="customer">Customer</Label>
                <Select id="customer" value={customerId ?? ""} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">No customer</option>
                  {customers?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="issue_date">Issue date</Label>
              <Input
                id="issue_date"
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="due_date">{type === "quotation" ? "Valid until" : "Due date"}</Label>
              <Input id="due_date" type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Select id="currency" value={currency || "AED"} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </Select>
            </div>
            {currency && currency !== tenant?.currency && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="exchange_rate">Exchange rate (to {tenant?.currency ?? "base currency"})</Label>
                <Input
                  id="exchange_rate"
                  type="number"
                  step="0.000001"
                  min="0"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                />
              </div>
            )}
          </div>

          {type === "proforma" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="lpo_no">LPO #</Label>
                <Input id="lpo_no" value={lpoNo} onChange={(e) => setLpoNo(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="project_villa_no">Villa / Project No</Label>
                <Input
                  id="project_villa_no"
                  placeholder="e.g. Villa No# 1491"
                  value={projectVillaNo}
                  onChange={(e) => setProjectVillaNo(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bill_to_address">Bill To</Label>
                <textarea
                  id="bill_to_address"
                  className="min-h-20 rounded-md border border-border bg-background px-3 py-2 text-body-sm"
                  value={billToAddress}
                  onChange={(e) => setBillToAddress(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ship_to_address">Ship To (if different)</Label>
                <textarea
                  id="ship_to_address"
                  className="min-h-20 rounded-md border border-border bg-background px-3 py-2 text-body-sm"
                  value={shipToAddress}
                  onChange={(e) => setShipToAddress(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="barcode_scan">Scan barcode</Label>
            <Input
              id="barcode_scan"
              placeholder="Scan or type a barcode and press Enter"
              value={barcodeInput}
              onChange={(e) => {
                setBarcodeInput(e.target.value);
                setBarcodeError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleBarcodeScan(barcodeInput);
                }
              }}
            />
            <FormError>{barcodeError}</FormError>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Line items</Label>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-body-sm">
                <thead className="border-b border-border bg-muted text-caption text-muted-foreground">
                  {type === "proforma" ? (
                    <tr>
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="w-20 px-3 py-2 font-medium">QTY</th>
                      <th className="w-28 px-3 py-2 font-medium">Final Payment</th>
                      <th className="w-28 px-3 py-2 font-medium">Rate</th>
                      <th className="w-24 px-3 py-2 text-right font-medium">Total</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  ) : (
                    <tr>
                      <th className="px-3 py-2 font-medium">Item</th>
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="w-20 px-3 py-2 font-medium">Qty</th>
                      <th className="w-28 px-3 py-2 font-medium">Unit price</th>
                      <th className="w-32 px-3 py-2 font-medium">VAT</th>
                      <th className="w-24 px-3 py-2 text-right font-medium">Total</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  )}
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const computed = computeLine(line, country, vatRateOverride);
                    const lineUnit = items?.items.find((i) => i.id === line.item_id)?.unit ?? "pcs";
                    const isSqm = lineUnit === "sqm";
                    const isLm = lineUnit === "lm";
                    const showSizeRow = type !== "proforma" && (isSqm || isLm);
                    const isOverridden = Boolean(line.override_total);
                    if (type === "proforma") {
                      return (
                        <tr key={index} className="border-b border-border last:border-0">
                          <td className="px-3 py-2">
                            <Select value={line.item_id ?? ""} onChange={(e) => applyItem(index, e.target.value)}>
                              <option value="">Custom</option>
                              {items?.items.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              required
                              value={line.description}
                              onChange={(e) => updateLine(index, { description: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.quantity ?? "1"}
                              onChange={(e) => updateLine(index, { quantity: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.final_payment_factor ?? "1"}
                              onChange={(e) => updateLine(index, { final_payment_factor: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unit_price}
                              onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              className="text-right"
                              placeholder={computed.computedGross.toFixed(2)}
                              value={line.override_total ?? ""}
                              onChange={(e) => updateLine(index, { override_total: e.target.value || null })}
                            />
                            {isOverridden && (
                              <span className="ml-1 rounded bg-muted px-1 py-0.5 text-caption text-muted-foreground">
                                edited
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(index)}
                              className="text-muted-foreground hover:text-danger-500"
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <>
                        <tr key={index} className={showSizeRow ? "border-b-0" : "border-b border-border last:border-0"}>
                          <td className="px-3 py-2">
                            <Select value={line.item_id ?? ""} onChange={(e) => applyItem(index, e.target.value)}>
                              <option value="">Custom</option>
                              {items?.items.map((i) => (
                                <option key={i.id} value={i.id}>
                                  {i.name}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              required
                              value={line.description}
                              onChange={(e) => updateLine(index, { description: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            {showSizeRow ? (
                              <span className="tabular-nums text-muted-foreground" title={isSqm ? "Total SQM" : "Total LM"}>
                                {computed.quantity.toFixed(4)}
                              </span>
                            ) : (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.quantity ?? "1"}
                                onChange={(e) => updateLine(index, { quantity: e.target.value })}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={line.unit_price}
                              onChange={(e) => updateLine(index, { unit_price: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Select
                              value={line.vat_category ?? "standard"}
                              onChange={(e) => updateLine(index, { vat_category: e.target.value as VatCategory })}
                            >
                              {VAT_CATEGORIES.map((vat) => (
                                <option key={vat.value} value={vat.value}>
                                  {vat.label}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {computed.lineTotal.toFixed(2)}
                            {isOverridden && (
                              <span className="ml-1 rounded bg-muted px-1 py-0.5 text-caption text-muted-foreground">
                                edited
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(index)}
                              className="text-muted-foreground hover:text-danger-500"
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                        {showSizeRow && (
                          <tr className="border-b border-border last:border-0">
                            <td colSpan={7} className="px-3 pb-2">
                              <div className="flex flex-wrap items-end gap-3">
                                {isSqm ? (
                                  <>
                                    <div className="flex flex-col gap-1">
                                      <Label htmlFor={`width_mm_${index}`} className="text-caption">Width (mm)</Label>
                                      <Input
                                        id={`width_mm_${index}`}
                                        type="number"
                                        step="1"
                                        min="0"
                                        className="w-28"
                                        value={line.width_mm ?? ""}
                                        onChange={(e) => updateLine(index, { width_mm: e.target.value })}
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <Label htmlFor={`height_mm_${index}`} className="text-caption">Height (mm)</Label>
                                      <Input
                                        id={`height_mm_${index}`}
                                        type="number"
                                        step="1"
                                        min="0"
                                        className="w-28"
                                        value={line.height_mm ?? ""}
                                        onChange={(e) => updateLine(index, { height_mm: e.target.value })}
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <div className="flex flex-col gap-1">
                                    <Label htmlFor={`length_mm_${index}`} className="text-caption">Length (mm)</Label>
                                    <Input
                                      id={`length_mm_${index}`}
                                      type="number"
                                      step="1"
                                      min="0"
                                      className="w-28"
                                      value={line.length_mm ?? ""}
                                      onChange={(e) => updateLine(index, { length_mm: e.target.value })}
                                    />
                                  </div>
                                )}
                                <div className="flex flex-col gap-1">
                                  <Label htmlFor={`qty_${index}`} className="text-caption">Qty</Label>
                                  <Input
                                    id={`qty_${index}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-20"
                                    value={line.quantity ?? "1"}
                                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Label className="text-caption">{isSqm ? "Total SQM" : "Total LM"}</Label>
                                  <span className="flex h-10 items-center text-body-sm tabular-nums text-muted-foreground">
                                    {computed.quantity.toFixed(4)}
                                  </span>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <Label htmlFor={`override_total_${index}`} className="text-caption">
                                    Line total override
                                  </Label>
                                  <Input
                                    id={`override_total_${index}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-28"
                                    placeholder={computed.computedGross.toFixed(2)}
                                    value={line.override_total ?? ""}
                                    onChange={(e) => updateLine(index, { override_total: e.target.value || null })}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={addLine} className="self-start">
              <Plus className="h-4 w-4" />
              Add line
            </Button>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <div className="flex flex-col gap-4 sm:w-1/2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Input id="notes" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="terms">Terms &amp; conditions</Label>
                <Input id="terms" value={terms ?? ""} onChange={(e) => setTerms(e.target.value)} />
              </div>
              {type === "quotation" && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="site_image">Site image</Label>
                  {siteImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={siteImageUrl}
                      alt="Site"
                      className="h-32 w-full rounded-md border border-border object-cover"
                    />
                  )}
                  <Input
                    id="site_image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleSiteImageChange}
                    disabled={uploadingSiteImage}
                  />
                  {uploadingSiteImage && <p className="text-body-sm text-muted-foreground">Uploading…</p>}
                  {siteImageUrl && !uploadingSiteImage && (
                    <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => setSiteImageUrl("")}>
                      Remove image
                    </Button>
                  )}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="pdf_template">PDF template</Label>
                  <Select id="pdf_template" value={pdfTemplate} onChange={(e) => setPdfTemplate(e.target.value as PdfTemplate)}>
                    {PDF_TEMPLATES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="accent_color">Accent color</Label>
                  <Input
                    id="accent_color"
                    type="color"
                    value={accentColor || "#0f766e"}
                    onChange={(e) => setAccentColor(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="language">Language</Label>
                  <Select id="language" value={language} onChange={(e) => setLanguage(e.target.value as InvoiceLanguage)}>
                    {INVOICE_LANGUAGES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:w-64">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="discount" className="shrink-0">
                  Discount
                </Label>
                <Input
                  id="discount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-28"
                  value={discountAmount ?? "0"}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between text-body-sm text-muted-foreground">
                <span>Subtotal</span>
                <span className="tabular-nums">{totals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-body-sm text-muted-foreground">
                <span>VAT</span>
                <span className="tabular-nums">{totals.vat.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 text-body font-semibold text-foreground">
                <span>Total</span>
                <span className="tabular-nums">{totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <FormError>{formError}</FormError>

          <div className="flex gap-3">
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push(isEditing ? `/invoices/${invoice!.id}` : "/invoices")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function resolveCountry(country: string | undefined): Country {
  return (country ?? "AE") as Country;
}

function toSharedLine(line: InvoiceLineItemInput): SharedLineItemInput {
  const num = (value: string | null | undefined) => (value ? Number(value) || undefined : undefined);
  return {
    description: line.description,
    quantity: num(line.quantity),
    widthMm: num(line.width_mm),
    heightMm: num(line.height_mm),
    lengthMm: num(line.length_mm),
    unitPrice: toMinorUnits(Number(line.unit_price ?? "0") || 0),
    discountPercent: num(line.discount_percent),
    discountAmount: line.discount_amount ? toMinorUnits(Number(line.discount_amount) || 0) : undefined,
    overrideTotal: line.override_total ? toMinorUnits(Number(line.override_total) || 0) : undefined,
    finalPaymentFactor: num(line.final_payment_factor),
    vatCategory: line.vat_category ?? "standard",
  };
}

function computeLine(line: InvoiceLineItemInput, country: Country, vatRateOverride?: number) {
  const computed = computeLineItem(toSharedLine(line), country, vatRateOverride);
  return {
    quantity: computed.quantity,
    computedGross: toMajorUnits(computed.computedGross),
    gross: toMajorUnits(computed.grossAmount),
    taxable: toMajorUnits(computed.taxableAmount),
    vat: toMajorUnits(computed.vatAmount),
    lineTotal: toMajorUnits(computed.lineTotal),
  };
}

function computeTotals(
  lines: InvoiceLineItemInput[],
  discountAmount: string | undefined,
  country: Country,
  vatRateOverride?: number
) {
  const totals = computeInvoiceTotals(
    lines.map(toSharedLine),
    country,
    toMinorUnits(Number(discountAmount ?? "0") || 0),
    vatRateOverride
  );
  return {
    subtotal: toMajorUnits(totals.subtotal),
    vat: toMajorUnits(totals.vatTotal),
    grandTotal: toMajorUnits(totals.grandTotal),
  };
}
