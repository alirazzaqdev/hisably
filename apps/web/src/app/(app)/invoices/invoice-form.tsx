"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { customersApi } from "@/lib/api/customers";
import { suppliersApi } from "@/lib/api/suppliers";
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

const VAT_CATEGORIES: { value: VatCategory; label: string; rate: number }[] = [
  { value: "standard", label: "Standard (5%)", rate: 5 },
  { value: "zero_rated", label: "Zero-rated", rate: 0 },
  { value: "exempt", label: "Exempt", rate: 0 },
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

  const [type, setType] = useState<InvoiceType>(invoice?.type ?? typeParam ?? "tax_invoice");
  const [customerId, setCustomerId] = useState(invoice?.customer_id ?? "");
  const [supplierId, setSupplierId] = useState(invoice?.supplier_id ?? "");
  const [convertedFromId, setConvertedFromId] = useState<string | null>(invoice?.converted_from_id ?? null);
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? todayIso());
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? "");
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [terms, setTerms] = useState(invoice?.terms ?? "");
  const [discountAmount, setDiscountAmount] = useState(invoice?.discount_amount ?? "0");
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>(invoice?.pdf_template ?? "minimal");
  const [accentColor, setAccentColor] = useState(invoice?.accent_color ?? "");
  const [language, setLanguage] = useState<InvoiceLanguage>(invoice?.language ?? "en");
  const [lines, setLines] = useState<InvoiceLineItemInput[]>(
    invoice?.line_items?.length
      ? invoice.line_items.map((li) => ({
          item_id: li.item_id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          discount_percent: li.discount_percent,
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

  useEffect(() => {
    if (!sourceInvoice || isEditing) return;
    setCustomerId(sourceInvoice.customer_id ?? "");
    setSupplierId(sourceInvoice.supplier_id ?? "");
    setConvertedFromId(sourceInvoice.id);
    setLines(
      sourceInvoice.line_items.map((li) => ({
        item_id: li.item_id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        discount_percent: li.discount_percent,
        vat_category: li.vat_category,
      }))
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
        discount_amount: discountAmount || "0",
        notes: notes || null,
        terms: terms || null,
        pdf_template: pdfTemplate,
        accent_color: accentColor || null,
        language,
        line_items: lines,
        converted_from_id: convertedFromId,
      };
      return isEditing ? invoicesApi.update(invoice!.id, payload) : invoicesApi.create(payload);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push(`/invoices/${saved.id}`);
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

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const totals = computeTotals(lines, discountAmount);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit invoice" : "New invoice"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update this invoice's details." : "Create a new invoice for a customer."}
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
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

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
                  <tr>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="w-20 px-3 py-2 font-medium">Qty</th>
                    <th className="w-28 px-3 py-2 font-medium">Unit price</th>
                    <th className="w-32 px-3 py-2 font-medium">VAT</th>
                    <th className="w-24 px-3 py-2 text-right font-medium">Total</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => {
                    const computed = computeLine(line);
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
                        <td className="px-3 py-2 text-right tabular-nums">{computed.lineTotal.toFixed(2)}</td>
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

function computeLine(line: InvoiceLineItemInput) {
  const quantity = Number(line.quantity ?? "1") || 0;
  const unitPrice = Number(line.unit_price ?? "0") || 0;
  const gross = quantity * unitPrice;
  const discount = Number(line.discount_amount ?? "0") || 0;
  const taxable = gross - discount;
  const rate = VAT_CATEGORIES.find((v) => v.value === (line.vat_category ?? "standard"))?.rate ?? 0;
  const vat = (taxable * rate) / 100;
  return { taxable, vat, lineTotal: taxable + vat };
}

function computeTotals(lines: InvoiceLineItemInput[], discountAmount: string | undefined) {
  const lineResults = lines.map(computeLine);
  const grossSubtotal = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity ?? "1") || 0;
    const unitPrice = Number(line.unit_price ?? "0") || 0;
    return sum + quantity * unitPrice;
  }, 0);
  const invoiceDiscount = Number(discountAmount ?? "0") || 0;
  const taxableTotal = lineResults.reduce((sum, l) => sum + l.taxable, 0) - invoiceDiscount;
  const vat = lineResults.reduce((sum, l) => sum + l.vat, 0);
  return {
    subtotal: grossSubtotal,
    vat,
    grandTotal: taxableTotal + vat,
  };
}
