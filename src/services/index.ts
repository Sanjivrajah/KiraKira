import { repositories } from "@/repositories";
import { DashboardService } from "./dashboard-service";
import { BusinessService } from "./business-service";
import { DemoService } from "./demo-service";
import { InvoiceService } from "./invoice-service";
import { ReminderService } from "./reminder-service";
import { TransactionService } from "./transaction-service";

export const services = {
  businesses: new BusinessService(repositories.businesses, repositories.memberships),
  transactions: new TransactionService(repositories.transactions),
  invoices: new InvoiceService(repositories.invoices, repositories.reminders),
  reminders: new ReminderService(repositories.reminders),
  dashboard: new DashboardService(repositories.transactions, repositories.invoices),
  demo: new DemoService(repositories),
};

export { BusinessService, DashboardService, DemoService, InvoiceService, ReminderService, TransactionService };
