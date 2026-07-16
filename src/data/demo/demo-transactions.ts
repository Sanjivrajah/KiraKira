import type { Transaction } from "@/types";
import {
  DEMO_FINANCIAL_TRANSACTIONS,
  DEMO_TRANSACTION_SOURCE_TYPES,
} from "./demo-financial-transactions";
import { toLegacyTransaction } from "./legacy-transaction-adapter";

export const DEMO_WHATSAPP_ORDER_MESSAGE = "Hi Kak Lina, can I order 40 lunch boxes for Friday? Total RM850. I’ll transfer the deposit today.";

/** Compatibility fixtures for the current UI; canonical values live in DEMO_FINANCIAL_TRANSACTIONS. */
export const DEMO_TRANSACTIONS: Transaction[] = DEMO_FINANCIAL_TRANSACTIONS.map((transaction) =>
  toLegacyTransaction(transaction, DEMO_TRANSACTION_SOURCE_TYPES[transaction.id]),
);
