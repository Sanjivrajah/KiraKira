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
import type { Transaction } from "@/types/finance";

const sample: Transaction = {
  id: "txn_test",
  type: "expense",
  amount: 24.5,
  date: "2026-07-14",
  category: "Supplies",
  description: "Paper bags",
  merchantName: "Maju Mart",
  paymentMethod: "Cash",
  source: "manual",
  status: "reviewed",
  createdAt: "2026-07-14T08:00:00.000Z",
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

    expect(updateTransaction({ ...sample, amount: 30 })).toBe(true);
    expect(getTransactions()).toHaveLength(1);
    expect(getTransactionById(sample.id)?.amount).toBe(30);

    expect(deleteTransaction(sample.id)).toBe(true);
    expect(getTransactions()).toEqual([]);
  });

  it("clears all locally saved transactions", () => {
    saveTransaction(sample);
    expect(clearTransactions()).toBe(true);
    expect(getTransactions()).toEqual([]);
  });

  it("deduplicates repeated IDs in stored data", () => {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify([sample, { ...sample, amount: 99 }]));
    expect(getTransactions()).toEqual([sample]);

    saveTransaction({ ...sample, amount: 42 });
    expect(getTransactions()).toEqual([{ ...sample, amount: 42 }]);
  });

  it("ignores malformed records without discarding valid ones", () => {
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify([{ id: "bad" }, sample]));
    expect(getTransactions()).toEqual([sample]);
  });
});
