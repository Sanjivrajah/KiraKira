import { repositories } from "@/repositories";
import { DashboardService } from "./dashboard-service";
import { DemoService } from "./demo-service";
import { InvoiceService } from "./invoice-service";
import { ReminderService } from "./reminder-service";
import { TransactionService } from "./transaction-service";

export const services = {
  transactions: new TransactionService(repositories.transactions),
  invoices: new InvoiceService(repositories.invoices, repositories.reminders),
  reminders: new ReminderService(repositories.reminders),
  dashboard: new DashboardService(repositories.transactions, repositories.invoices),
  demo: new DemoService(repositories),
};

export { DashboardService, DemoService, InvoiceService, ReminderService, TransactionService };
