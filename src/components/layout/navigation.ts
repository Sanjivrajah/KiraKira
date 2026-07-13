import {
  Boxes,
  FileText,
  Gauge,
  HandCoins,
  Landmark,
  ReceiptText,
  Settings,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
}

export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", shortLabel: "Home", href: "/dashboard", icon: Gauge },
  { label: "Transactions", shortLabel: "Records", href: "/transactions", icon: ReceiptText },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "Payment reminders", href: "/reminders", icon: HandCoins },
  { label: "Cash flow", href: "/cash-flow", icon: TrendingUp },
  { label: "Loan readiness", href: "/loan-readiness", icon: Landmark },
  { label: "Inventory", href: "/inventory", icon: Boxes },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}
