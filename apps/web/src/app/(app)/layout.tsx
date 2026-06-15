"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { forwardRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  FileText,
  FileSignature,
  Repeat,
  CreditCard,
  Wallet,
  Receipt,
  BarChart3,
  Settings,
  LogOut,
  ClipboardList,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FirmSwitcher } from "@/components/firm-switcher";
import { Logo } from "@/components/logo";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SyncStatusBanner } from "@/components/sync-status-banner";
import { authApi } from "@/lib/api/auth";
import { useEnabledFields } from "@/lib/hooks/use-enabled-fields";
import { tenantsApi } from "@/lib/api/tenants";
import { usersApi } from "@/lib/api/users";
import { useAuthStore } from "@/stores/auth-store";

// Mirrors the `permission` keys in NAV_ITEMS, but also covers sub-routes
// (e.g. /items/new, /item-categories, /price-lists) that aren't top-level
// nav links, so staff can't bypass module permissions via direct URL.
const PERMISSION_BY_PATH: { prefix: string; permission: string }[] = [
  { prefix: "/customers", permission: "customers" },
  { prefix: "/suppliers", permission: "customers" },
  { prefix: "/items", permission: "items" },
  { prefix: "/item-categories", permission: "items" },
  { prefix: "/price-lists", permission: "items" },
  { prefix: "/invoices", permission: "invoices" },
  { prefix: "/quotations", permission: "invoices" },
  { prefix: "/recurring-invoices", permission: "invoices" },
  { prefix: "/payments", permission: "payments" },
  { prefix: "/accounts", permission: "payments" },
  { prefix: "/expenses", permission: "expenses" },
  { prefix: "/reports", permission: "reports" },
  { prefix: "/job-register", permission: "job_register" },
];

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null, moduleField: null },
  { href: "/customers", label: "Customers", icon: Users, permission: "customers", moduleField: null },
  { href: "/suppliers", label: "Suppliers", icon: Truck, permission: "customers", moduleField: null },
  { href: "/items", label: "Items", icon: Package, permission: "items", moduleField: null },
  { href: "/invoices", label: "Invoices", icon: FileText, permission: "invoices", moduleField: null },
  { href: "/quotations", label: "Quotations", icon: FileSignature, permission: "invoices", moduleField: null },
  { href: "/recurring-invoices", label: "Recurring", icon: Repeat, permission: "invoices", moduleField: null },
  { href: "/payments", label: "Payments", icon: CreditCard, permission: "payments", moduleField: null },
  { href: "/accounts", label: "Accounts", icon: Wallet, permission: "payments", moduleField: null },
  { href: "/expenses", label: "Expenses", icon: Receipt, permission: "expenses", moduleField: null },
  { href: "/job-register", label: "Job Register", icon: ClipboardList, permission: "job_register", moduleField: "module.job_register" },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports", moduleField: null },
  { href: "/settings", label: "Settings", icon: Settings, permission: null, moduleField: null },
] as const;

// Primary destinations surfaced one-tap in the mobile bottom tab bar.
const MOBILE_PRIMARY_HREFS = ["/dashboard", "/invoices", "/payments", "/items"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { refreshToken, clearSession } = useAuthStore();
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: tenant } = useQuery({ queryKey: ["tenant", "me"], queryFn: tenantsApi.me });
  const { data: user } = useQuery({ queryKey: ["user", "me"], queryFn: usersApi.me });
  const { enabled } = useEnabledFields();

  const deniedRoute =
    user?.role === "staff"
      ? PERMISSION_BY_PATH.find((p) => pathname.startsWith(p.prefix) && !user.permissions[p.permission])
      : undefined;

  const moduleDisabledRoute = !enabled["module.job_register"] && pathname.startsWith("/job-register");

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (user && user.role === "staff" && item.permission && !user.permissions[item.permission]) {
      return false;
    }
    if (item.moduleField && !enabled[item.moduleField]) {
      return false;
    }
    return true;
  });

  const primaryItems = MOBILE_PRIMARY_HREFS.map((href) => visibleNavItems.find((item) => item.href === href)).filter(
    (item): item is (typeof NAV_ITEMS)[number] => Boolean(item)
  );
  const moreItems = visibleNavItems.filter((item) => !primaryItems.includes(item));

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
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r border-border bg-surface md:flex print:hidden">
        <div className="px-6 py-5">
          <Logo size="sm" />
        </div>

        {user && user.role === "owner" && <FirmSwitcher />}

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {visibleNavItems.map((item) => (
            <NavLink key={item.href} item={item} isActive={pathname.startsWith(item.href)} />
          ))}
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

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden print:hidden">
        <Logo size="sm" />
        <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Open menu"
            className="flex h-11 w-11 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>

            {user && user.role === "owner" && <FirmSwitcher />}

            <nav className="flex flex-col gap-1">
              {visibleNavItems.map((item) => (
                <SheetClose key={item.href} asChild>
                  <NavLink item={item} isActive={pathname.startsWith(item.href)} />
                </SheetClose>
              ))}
            </nav>

            <div className="border-t border-border pt-4">
              <div className="mb-2 px-3">
                <p className="truncate text-body-sm font-medium text-foreground">
                  {tenant?.business_name ?? "..."}
                </p>
                <p className="truncate text-body-sm text-muted-foreground">{user?.email ?? ""}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-body text-foreground transition-colors hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex flex-1 flex-col">
        <SyncStatusBanner />
        <main className="flex-1 bg-background px-4 py-6 pb-24 md:px-10 md:py-8 md:pb-8">
          {deniedRoute || moduleDisabledRoute ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
              <h1 className="text-h2 text-foreground">Access denied</h1>
              <p className="text-body text-muted-foreground">
                You don&apos;t have permission to view this section. Ask the business owner to grant you
                access.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface md:hidden print:hidden">
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-caption transition-colors",
                isActive ? "text-accent-700" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        {moreItems.length > 0 && (
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 py-2 text-caption text-muted-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
            More
          </button>
        )}
      </nav>
    </div>
  );
}

const NavLink = forwardRef<
  HTMLAnchorElement,
  { item: (typeof NAV_ITEMS)[number]; isActive: boolean; className?: string } & React.ComponentPropsWithoutRef<"a">
>(function NavLink({ item, isActive, className, ...props }, ref) {
  const Icon = item.icon;
  return (
    <Link
      ref={ref}
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-body transition-colors",
        isActive ? "bg-accent-600/10 font-medium text-accent-700" : "text-foreground hover:bg-muted",
        className
      )}
      {...props}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
});
