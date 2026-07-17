-- Resolve the historical Stage 1 v1.1-only check with the active unsigned
-- Invoice v1.0 boundary. Historical v1.1 rows remain readable; the trigger
-- installed by 20260718040000 prevents new active v1.1 records.

alter table public.e_invoice_documents
  drop constraint if exists e_invoice_documents_document_version_check;

alter table public.e_invoice_documents
  alter column document_version set default '1.0';

alter table public.e_invoice_documents
  add constraint e_invoice_documents_document_version_check
  check (document_version in ('1.0', '1.1'));

comment on column public.e_invoice_documents.document_version is
  'Active application records use unsigned MyInvois Invoice v1.0. Existing v1.1 values are historical compatibility records only.';
