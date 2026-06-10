import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { computeInvoiceTotals, formatMinorUnits } from "@hisably/shared";

export default function Home() {
  const totals = computeInvoiceTotals(
    [
      { description: "Glass partition (3sqm)", width: 1.5, height: 2, unitPrice: 15000, vatCategory: "standard" },
      { description: "Installation service", quantity: 1, unitPrice: 50000, vatCategory: "standard" },
    ],
    "AE"
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-foreground">Hisably</h1>
        <p className="text-body-lg text-muted-foreground">
          Design system scaffold — premium, calm, offline-first billing for SMBs.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="primary">
          <Link href="/signup">Sign up</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/login">Log in</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary">Create invoice</Button>
        <Button variant="secondary">Add customer</Button>
        <Button variant="ghost">Settings</Button>
        <Button variant="destructive">Void</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="success">Paid</Badge>
        <Badge variant="warning">Partially paid</Badge>
        <Badge variant="danger">Overdue</Badge>
        <Badge variant="accent">Synced</Badge>
        <Badge variant="neutral">Draft</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sample invoice (shared invoice-math)</CardTitle>
          <CardDescription>
            Computed via @hisably/shared — the same package the offline frontend
            and the FastAPI backend will use, so totals always agree to the fils.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-body">
          <Row label="Subtotal" value={totals.subtotal} />
          <Row label="Discount" value={-totals.discountTotal} />
          {Object.entries(totals.vatBreakdown).map(([rate, amount]) => (
            <Row key={rate} label={`VAT (${rate}%)`} value={amount} />
          ))}
          <div className="my-1 h-px bg-border" />
          <Row label="Grand total (AED)" value={totals.grandTotal} bold />
        </CardContent>
      </Card>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "text-h3" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatMinorUnits(value)}</span>
    </div>
  );
}
