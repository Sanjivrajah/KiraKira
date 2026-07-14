import { beforeEach, describe, expect, it } from "vitest";
import {
  clearTransactions,
  deleteTransaction,
  getTransactionById,
  getTransactions,
  initializeTransactions,
  saveTransaction,
  TRANSACTIONS_STORAGE_KEY,
  updateTransaction,
} from "./storage";
import type { Transaction } from "@/types";

const sample: Transaction = {
  id: "txn_test",
  businessId: "business_test",
  createdBy: "user_test",
  type: "expense",
  subtotal: 24.5,
  tax: 0,
  total: 24.5,
  currency: "MYR",
  date: "2026-07-14",
  category: "Supplies",
  description: "Paper bags",
  counterpartyName: "Maju Mart",
  counterpartyId: null,
  paymentMethod: "Cash",
  sourceDocumentId: null,
  confidenceScore: null,
  notes: null,
  sourceType: "manual",
  status: "confirmed",
  items: [],
  createdAt: "2026-07-14T08:00:00.000Z",
  updatedAt: "2026-07-14T08:00:00.000Z",
};

describe("transaction storage", () => {
  beforeEach(() => localStorage.clear());

  it("returns an empty array for missing or invalid storage", () => {
    expect(getTransactions()).toEqual([]);
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, "not-json");
    expect(getTransactions()).toEqual([]);
  });

  it("seeds fallback transactions only when storage has never been created", () => {
    expect(initializeTransactions([sample])).toEqual([sample]);
    expect(getTransactions()).toEqual([sample]);
    clearTransactions();
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, "[]");
    expect(initializeTransactions([sample])).toEqual([]);
  });

  it("saves, reads, updates, and deletes a transaction", () => {
    expect(saveTransaction(sample)).toBe(true);
    expect(getTransactionById(sample.id)).toEqual(sample);

    expect(updateTransaction({ ...sample, subtotal: 30, total: 30 })).toBe(true);
    expect(getTransactions()).toHaveLength(1);
    expect(getTransactionById(sample.id)?.total).toBe(30);

    expect(deleteTransaction(sample.id)).toBe(true);
    expect(getTransactions()).toEqual([]);
  });

  it("clears all locally saved transactions", () => {
    saveTransaction(sample);
    expect(clearTransactions()).toBe(true);
    expect(getTransactions()).toEqual([]);
  });

  it("deduplicates repeated IDs in stored data", () => {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify([sample, { ...sample, total: 99 }]));
    expect(getTransactions()).toEqual([sample]);

    saveTransaction({ ...sample, subtotal: 42, total: 42 });
    expect(getTransactions()).toEqual([{ ...sample, subtotal: 42, total: 42 }]);
  });

  it("ignores malformed records without discarding valid ones", () => {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify([{ id: "bad" }, sample]));
    expect(getTransactions()).toEqual([sample]);
  });

  it("migrates the legacy browser shape without losing the transaction", () => {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify([{
      id: "txn_legacy", type: "income", amount: 80, date: "2026-07-01", category: "Sales",
      description: "Legacy sale", customerName: "Kedai Lama", source: "manual", status: "reviewed",
      createdAt: "2026-07-01T08:00:00.000Z",
    }]));
    expect(getTransactions()[0]).toMatchObject({
      id: "txn_legacy", total: 80, counterpartyName: "Kedai Lama", sourceType: "manual",
      status: "confirmed", businessId: "business_demo", updatedAt: "2026-07-01T08:00:00.000Z",
    });
  });
});
