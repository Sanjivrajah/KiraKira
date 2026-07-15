-- Transactions Migration Script
-- Creates the transactions table aligned with src/domain/transactions/transaction.schema.ts

-- 1. Create Enums for strict validation at the DB level
CREATE TYPE transaction_direction AS ENUM ('income', 'expense');
CREATE TYPE transaction_lifecycle AS ENUM ('proposed', 'review_required', 'confirmed', 'voided');
CREATE TYPE transaction_payment_status AS ENUM ('unpaid', 'partially_paid', 'paid', 'not_applicable', 'unknown');
CREATE TYPE transaction_einvoice_treatment AS ENUM (
  'individual',
  'consolidated_candidate',
  'self_billed_candidate',
  'not_required',
  'undetermined'
);

-- 2. Create Table
CREATE TABLE public.transactions (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    direction transaction_direction NOT NULL,
    lifecycle transaction_lifecycle NOT NULL,
    transaction_date DATE NOT NULL,
    accounting_date DATE NOT NULL,
    counterparty_id TEXT,
    counterparty_name_snapshot TEXT,
    -- JSONB Columns for deeply nested document-style fields
    source_links JSONB DEFAULT '[]'::jsonb NOT NULL,
    description TEXT NOT NULL,
    category_code TEXT NOT NULL,
    currency TEXT NOT NULL,
    exchange_rate_to_myr NUMERIC,
    lines JSONB NOT NULL,
    totals JSONB NOT NULL,
    payment_status transaction_payment_status NOT NULL,
    payment_method_code TEXT,
    e_invoice_treatment transaction_einvoice_treatment NOT NULL,
    confidence_score NUMERIC,
    confirmation JSONB,
    void_metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    created_by TEXT,
    updated_by TEXT,
    version INTEGER DEFAULT 0
);

-- 3. Row Level Security (RLS)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Note: We are creating a simple placeholder policy. 
-- In a real scenario, this would query your `business_memberships` table.
CREATE POLICY "Users can access their own business transactions" 
ON public.transactions
FOR ALL 
USING (
  -- Replace this with your actual tenant authorization logic (e.g., checking a memberships table)
  -- business_id IN (SELECT business_id FROM public.business_memberships WHERE user_id = auth.uid())
  TRUE 
);

-- 4. Indexes for common query patterns
CREATE INDEX idx_transactions_business_id ON public.transactions(business_id);
CREATE INDEX idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX idx_transactions_lifecycle ON public.transactions(lifecycle);
