import {
  AudioLines,
  Building2,
  FileText,
  Files,
  Gauge,
  ReceiptText,
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
  { label: "Records", href: "/transactions", icon: ReceiptText },
  { label: "Voice assistant", shortLabel: "Voice", href: "/voice", icon: AudioLines },
  { label: "Invoices", href: "/invoices", icon: FileText },
  { label: "e-Invoice preparation", shortLabel: "e-Invoice", href: "/e-invoices", icon: Files },
  { label: "Business details", shortLabel: "Business", href: "/settings", icon: Building2 },
];

export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}
