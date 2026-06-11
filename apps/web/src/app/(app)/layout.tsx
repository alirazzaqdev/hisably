"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  FileText,
  Repeat,
  CreditCard,
  Wallet,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncStatusBanner } from "@/components/sync-status-banner";
import { authApi } from "@/lib/api/auth";
import { tenantsApi } from "@/lib/api/tenants";
import { usersApi } from "@/lib/api/users";
import { useAuthStore } from "@/stores/auth-store";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, available: true, permission: null },
  { href: "/customers", label: "Customers", icon: Users, available: true, permission: "customers" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, available: true, permission: "customers" },
  { href: "/items", label: "Items", icon: Package, available: true, permission: "items" },
  { href: "/invoices", label: "Invoices", icon: FileText, available: true, permission: "invoices" },
  { href: "/recurring-invoices", label: "Recurring", icon: Repeat, available: true, permission: "invoices" },
  { href: "/payments", label: "Payments", icon: CreditCard, available: true, permission: "payments" },
  { href: "/accounts", label: "Accounts", icon: Wallet, available: true, permission: "payments" },
  { href: "/expenses", label: "Expenses", icon: Receipt, available: true, permission: "expenses" },
  { href: "/reports", label: "Reports", icon: BarChart3, available: true, permission: "reports" },
  { href: "/settings", label: "Settings", icon: Settings, available: true, permission: null },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { refreshToken, clearSession } = useAuthStore();

  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: user } = useQuery({ queryKey: ["user", "me"], queryFn: usersApi.me });

  async function handleLogout() {
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // Ignore — clear local session regardless.
      }
    }
    clearSession();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r border-border bg-surface md:flex">
        <div className="px-6 py-5">
          <span className="text-h3 font-semibold text-foreground">Hisably</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            if (user && user.role === "staff" && item.permission && !user.permissions[item.permission]) {
              return null;
            }

            if (!item.available) {
              return (
                <span
                  key={item.href}
                  className="flex cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-body text-muted-foreground/60"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <span className="text-body-sm">Soon</span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors",
                  isActive
                    ? "bg-accent-600/10 font-medium text-accent-700"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border px-3 py-4">
          <div className="mb-2 px-3">
            <p className="truncate text-body-sm font-medium text-foreground">
              {tenant?.business_name ?? "..."}
            </p>
            <p className="truncate text-body-sm text-muted-foreground">{user?.email ?? ""}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-body text-foreground transition-colors hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <SyncStatusBanner />
        <main className="flex-1 bg-background px-6 py-6 md:px-10 md:py-8">{children}</main>
      </div>
    </div>
  );
}
