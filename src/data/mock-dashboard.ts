import type { LucideIcon } from "lucide-react";
import {
  FilePlus2,
  FileSpreadsheet,
  Mic2,
  Plus,
  ScanLine,
} from "lucide-react";

export interface DashboardMetric {
  id: string;
  label: string;
  value: number;
  trend: string;
  tone: "positive" | "neutral" | "brand" | "warning";
}

export interface CashFlowPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface QuickAction {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export const dashboardMetrics: DashboardMetric[] = [
  { id: "revenue", label: "Revenue this month", value: 8450, trend: "↑ 12.4% from June", tone: "positive" },
  { id: "expenses", label: "Expenses this month", value: 3280.4, trend: "↓ 4.1% from June", tone: "neutral" },
  { id: "profit", label: "Estimated profit", value: 5169.6, trend: "61% profit margin", tone: "brand" },
  { id: "outstanding", label: "Outstanding payments", value: 1240, trend: "3 invoices overdue", tone: "warning" },
];

export const mockCashFlow: CashFlowPoint[] = [
  { month: "Feb", income: 5800, expenses: 2940, net: 2860 },
  { month: "Mar", income: 6250, expenses: 3180, net: 3070 },
  { month: "Apr", income: 5920, expenses: 3460, net: 2460 },
  { month: "May", income: 7180, expenses: 3290, net: 3890 },
  { month: "Jun", income: 7515, expenses: 3421, net: 4094 },
  { month: "Jul", income: 8450, expenses: 3280.4, net: 5169.6 },
];

export const quickActions: QuickAction[] = [
  { label: "Add transaction", description: "Enter it manually", href: "/transactions/new?method=manual", icon: Plus },
  { label: "Scan receipt", description: "Capture an expense", href: "/transactions/new?method=receipt", icon: ScanLine },
  { label: "Record by voice", description: "Speak naturally", href: "/transactions/new?method=voice", icon: Mic2 },
  { label: "Import CSV", description: "Upload many records", href: "/transactions/new?method=csv", icon: FileSpreadsheet },
  { label: "Create invoice", description: "Request payment", href: "/invoices/new", icon: FilePlus2 },
];

export const dashboardInsights = [
  { id: "review", title: "2 transactions need review", description: "Confirm the categories before they affect your reports.", tone: "warning" as const, href: "/transactions" },
  { id: "overdue", title: "3 invoices are overdue", description: "RM 1,240 is still waiting to be collected.", tone: "danger" as const, href: "/invoices" },
  { id: "cash", title: "Cash may run low later this month", description: "A supplier payment is due before your next large order.", tone: "info" as const, href: "/cash-flow" },
  { id: "profile", title: "Business profile is 80% complete", description: "Add your tax identification number to finish setup.", tone: "brand" as const, href: "/settings" },
];

export const loanReadinessPreview = {
  score: 72,
  summary: "Your income records are consistent. Reviewing uncategorised expenses could strengthen your profile.",
};
