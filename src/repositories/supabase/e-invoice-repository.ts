import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMalaysiaStateCode } from "@/compliance/myinvois/reference-data/malaysia-states";
import { commercialDocumentSchema, type Party } from "@/domain";
import type {
  AssemblyProvenanceEntry,
  CreateOrRefreshPreparationInput,
  EInvoiceAssemblyBundle,
  EInvoiceCandidate,
  EInvoicePreparationRecord,
  EInvoicePreparationRepository,
  EInvoicePayloadSnapshotRecord,
  EInvoicePayloadSnapshotRepository,
  EInvoiceConnectionRepository,
  MyInvoisConnectionRecord,
  MyInvoisEnvironment,
  PersistEInvoicePayloadSnapshotInput,
  PersistMyInvoisConnectionInput,
  EInvoiceSourceRepository,
  StoredAddressSource,
  StoredBusinessSource,
  StoredInvoiceSource,
  StoredPartySource,
  PreparationReadinessResult,
} from "@/application/e-invoices";
import type { Database, Json, Tables } from "@/lib/supabase/database.types";

type BusinessJoin = Tables<"businesses"> & {
  business_tax_identifiers: Array<{ scheme: string; value: string; issuing_country_code: string | null; description: string | null }>;
  business_registration_identifiers: Array<{ scheme: string; value: string; issuing_country_code: string | null; description: string | null }>;
  business_addresses: Array<{ line1: string; line2: string | null; line3: string | null; city: string; postal_code: string | null; state_code: string | null; country_code: string; is_primary: boolean }>;
  business_contacts: Array<{ contact_type: string; value: string; is_primary: boolean }>;
};
type PartyJoin = Tables<"parties"> & {
  party_tax_identifiers: Array<{ scheme: string; value: string; issuing_country_code: string | null; description: string | null }>;
  party_registration_identifiers: Array<{ scheme: string; value: string; issuing_country_code: string | null; description: string | null }>;
  party_addresses: Array<{ address_type: string; line1: string; line2: string | null; line3: string | null; city: string; postal_code: string | null; state_code: string | null; country_code: string; is_primary: boolean }>;
};
type InvoiceJoin = Tables<"invoices"> & { invoice_items: Tables<"invoice_items">[] };

const businessSelection = "*,business_tax_identifiers(scheme,value,issuing_country_code,description),business_registration_identifiers(scheme,value,issuing_country_code,description),business_addresses(line1,line2,line3,city,postal_code,state_code,country_code,is_primary),business_contacts(contact_type,value,is_primary)";
const partySelection = "*,party_tax_identifiers(scheme,value,issuing_country_code,description),party_registration_identifiers(scheme,value,issuing_country_code,description),party_addresses(address_type,line1,line2,line3,city,postal_code,state_code,country_code,is_primary)";
const connectionSelection = "id,business_id,environment,auth_mode,taxpayer_tin,taxpayer_registration_scheme,taxpayer_registration_value,onbehalfof_value,credential_set_id,client_id_secret_ref,client_secret_secret_ref,enabled,document_version,verified_at,verified_by,sandbox_verified_at,sandbox_verified_by,production_activated_at,production_activated_by,production_disabled_at,production_disabled_by,production_activation_reason,created_at,updated_at";

function json(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function address(row: { line1: string; line2: string | null; line3: string | null; city: string; postal_code: string | null; state_code: string | null; country_code: string }): StoredAddressSource {
  const stateCode = row.country_code === "MY" ? normalizeMalaysiaStateCode(row.state_code ?? undefined) : row.state_code ?? undefined;
  return { addressLines: [row.line1, row.line2, row.line3].filter((line): line is string => Boolean(line)), city: row.city, postcode: row.postal_code ?? undefined, stateCode: stateCode || undefined, countryCode: row.country_code };
}

function mapBusiness(row: BusinessJoin): StoredBusinessSource {
  const primaryAddress = row.business_addresses.find((item) => item.is_primary) ?? row.business_addresses[0];
  const contact = (type: string) => row.business_contacts.find((item) => item.contact_type === type && item.is_primary)?.value ?? row.business_contacts.find((item) => item.contact_type === type)?.value;
  return {
    id: row.id, legalName: row.legal_name, tradingName: row.trading_name ?? undefined, entityType: row.entity_type,
    defaultCurrency: row.default_currency, preferredLanguage: row.preferred_language, timezone: row.timezone,
    msicCode: row.msic_code ?? undefined, businessActivityDescription: row.business_activity_description ?? undefined,
    taxIdentifiers: row.business_tax_identifiers.map((item) => ({ scheme: item.scheme as Party["taxIdentifiers"][number]["scheme"], value: item.value, issuingCountryCode: item.issuing_country_code ?? undefined, description: item.description ?? undefined })),
    registrationIdentifiers: row.business_registration_identifiers.map((item) => ({ scheme: item.scheme as Party["registrationIdentifiers"][number]["scheme"], value: item.value, issuingCountryCode: item.issuing_country_code ?? undefined, description: item.description ?? undefined })),
    email: contact("email"), phone: contact("phone"), address: primaryAddress ? address(primaryAddress) : undefined,
    createdAt: row.created_at, updatedAt: row.updated_at, version: row.version,
  };
}

function mapParty(row: PartyJoin): StoredPartySource {
  const findAddress = (type: string) => {
    const item = row.party_addresses.find((candidate) => candidate.address_type === type && candidate.is_primary) ?? row.party_addresses.find((candidate) => candidate.address_type === type);
    return item ? address(item) : undefined;
  };
  return {
    id: row.id, kind: row.kind as Party["kind"], legalName: row.legal_name, tradingName: row.trading_name ?? undefined,
    roles: row.roles as Party["roles"], email: row.email ?? undefined, phone: row.phone ?? undefined,
    taxIdentifiers: row.party_tax_identifiers.map((item) => ({ scheme: item.scheme as Party["taxIdentifiers"][number]["scheme"], value: item.value, issuingCountryCode: item.issuing_country_code ?? undefined, description: item.description ?? undefined })),
    registrationIdentifiers: row.party_registration_identifiers.map((item) => ({ scheme: item.scheme as Party["registrationIdentifiers"][number]["scheme"], value: item.value, issuingCountryCode: item.issuing_country_code ?? undefined, description: item.description ?? undefined })),
    billingAddress: findAddress("billing"), shippingAddress: findAddress("shipping"), defaultCurrency: row.default_currency ?? undefined,
    defaultPaymentTermsDays: row.default_payment_terms_days ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at, version: row.version,
  };
}

function mapInvoice(row: InvoiceJoin): StoredInvoiceSource {
  return {
    id: row.id, businessId: row.business_id, documentType: row.document_type as StoredInvoiceSource["documentType"],
    invoiceNumber: row.invoice_number, customerId: row.customer_id ?? undefined,
    shippingRecipientPartyId: row.shipping_recipient_party_id ?? undefined, issueDate: row.issue_date,
    issueTime: row.issue_time ?? undefined, dueDate: row.due_date ?? undefined, currency: row.currency,
    taxCurrency: row.tax_currency ?? undefined, exchangeRate: row.exchange_rate?.toString(), paymentModeCode: row.payment_mode_code ?? undefined,
    bankAccountIdentifier: row.bank_account_identifier ?? undefined, paymentTerms: row.payment_terms ?? undefined,
    paymentReference: row.payment_reference ?? undefined, billingPeriodStart: row.billing_period_start ?? undefined,
    billingPeriodEnd: row.billing_period_end ?? undefined, documentReferences: row.document_references,
    documentAllowances: row.document_allowances, documentCharges: row.document_charges, prepaidMinor: row.prepaid_minor,
    invoicePurpose: row.invoice_purpose ?? undefined, notes: row.notes ?? undefined, roundingMinor: row.rounding_minor,
    supplementalFields: row.supplemental_fields as Record<string, unknown>, status: row.status, version: row.version,
    createdAt: row.created_at, updatedAt: row.updated_at, createdBy: row.created_by ?? undefined, updatedBy: row.updated_by ?? undefined,
    items: row.invoice_items.sort((a, b) => a.line_number - b.line_number).map((item) => ({
      id: item.id, lineNumber: item.line_number, description: item.description, quantity: item.quantity.toString(),
      unitCode: item.unit_code ?? undefined, unitPriceMinor: item.unit_price_minor, discountMinor: item.discount_minor,
      chargeMinor: item.charge_minor, taxTypeCode: item.tax_type_code, taxRate: item.tax_rate.toString(),
      classificationCode: item.classification_code ?? undefined, exemptionReason: item.exemption_reason ?? undefined,
      countryOfOrigin: item.country_of_origin ?? undefined, tariffCode: item.tariff_code ?? undefined,
      itemMetadata: item.item_metadata as Record<string, unknown>,
    })),
  };
}

function mapPreparation(row: Tables<"e_invoice_documents">): EInvoicePreparationRecord {
  const canonicalDocument = row.canonical_document ? commercialDocumentSchema.parse(row.canonical_document) : null;
  const readiness = row.readiness_result as unknown as PreparationReadinessResult;
  const revisionRow = row as typeof row & { supersedes_document_id?: string | null; active?: boolean; submission_eligible?: boolean };
  return {
    id: row.id, businessId: row.business_id, sourceInvoiceId: row.source_invoice_id,
    sourceInvoiceRevision: row.source_invoice_revision, documentType: row.document_type as EInvoicePreparationRecord["documentType"],
    documentVersion: row.document_version === "1.0" ? "1.0" : "unsupported_historical", scenario: row.scenario as EInvoicePreparationRecord["scenario"], canonicalDocument,
    supplierSnapshot: row.supplier_snapshot as Record<string, unknown>, buyerSnapshot: row.buyer_snapshot as Record<string, unknown>,
    supplementalFields: row.supplemental_fields as Record<string, unknown>, provenance: row.provenance as unknown as AssemblyProvenanceEntry[],
    readinessResult: readiness, status: row.status as EInvoicePreparationRecord["status"], revision: row.revision,
    approvedAt: row.approved_at ?? undefined, approvedBy: row.approved_by ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at,
    supersedesDocumentId: revisionRow.supersedes_document_id ?? undefined,
    active: revisionRow.active ?? true,
    submissionEligible: revisionRow.submission_eligible ?? row.status === "approved",
  };
}

function mapPayloadSnapshot(row: Tables<"e_invoice_payload_snapshots">): EInvoicePayloadSnapshotRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    eInvoiceDocumentId: row.e_invoice_document_id,
    documentRevision: row.document_revision,
    documentVersion: row.document_version as EInvoicePayloadSnapshotRecord["documentVersion"],
    mapperVersion: row.mapper_version,
    referenceDataVersion: row.reference_data_version,
    format: row.format as "json",
    unsignedPayload: row.unsigned_payload,
    unsignedPayloadHash: row.unsigned_payload_hash,
    payloadSizeBytes: row.payload_size_bytes,
    generatedAt: row.generated_at,
  };
}

type ActiveConnectionRow = Omit<Tables<"myinvois_connections">,
  "signing_certificate_secret_ref" | "signing_private_key_secret_ref" |
  "signing_key_passphrase_secret_ref" | "signing_certificate_chain_secret_ref" |
  "certificate_serial_number" | "certificate_issuer" | "certificate_not_before" |
  "certificate_not_after" | "certificate_fingerprint_sha256" | "certificate_metadata_updated_at" |
  "certificate_subject" | "certificate_thumbprint"
>;

function mapConnection(row: ActiveConnectionRow): MyInvoisConnectionRecord {
  return {
    id: row.id,
    businessId: row.business_id,
    environment: row.environment as MyInvoisConnectionRecord["environment"],
    authMode: row.auth_mode as MyInvoisConnectionRecord["authMode"],
    taxpayerTin: row.taxpayer_tin,
    taxpayerRegistrationScheme: row.taxpayer_registration_scheme as MyInvoisConnectionRecord["taxpayerRegistrationScheme"],
    taxpayerRegistrationValue: row.taxpayer_registration_value ?? undefined,
    onbehalfofValue: row.onbehalfof_value
      ?? (row.taxpayer_registration_value ? `${row.taxpayer_tin}:${row.taxpayer_registration_value}` : row.taxpayer_tin),
    credentialSetId: row.credential_set_id,
    clientIdSecretRef: row.client_id_secret_ref,
    clientSecretSecretRef: row.client_secret_secret_ref,
    enabled: row.enabled,
    documentVersion: row.document_version as "1.0",
    verifiedAt: row.verified_at ?? undefined,
    verifiedBy: row.verified_by ?? undefined,
    sandboxVerifiedAt: row.sandbox_verified_at ?? undefined,
    sandboxVerifiedBy: row.sandbox_verified_by ?? undefined,
    productionActivatedAt: row.production_activated_at ?? undefined,
    productionActivatedBy: row.production_activated_by ?? undefined,
    productionDisabledAt: row.production_disabled_at ?? undefined,
    productionDisabledBy: row.production_disabled_by ?? undefined,
    productionActivationReason: row.production_activation_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Supabase-only adapter. It never consults browser storage or local demo repositories. */
export class SupabaseEInvoiceRepository implements EInvoiceSourceRepository, EInvoicePreparationRepository, EInvoicePayloadSnapshotRepository, EInvoiceConnectionRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async loadAssemblyBundle(businessId: string, invoiceId: string): Promise<EInvoiceAssemblyBundle | null> {
    const [businessResult, invoiceResult] = await Promise.all([
      this.client.from("businesses").select(businessSelection).eq("id", businessId).maybeSingle(),
      this.client.from("invoices").select("*,invoice_items(*)").eq("business_id", businessId).eq("id", invoiceId).maybeSingle(),
    ]);
    if (businessResult.error) throw businessResult.error;
    if (invoiceResult.error) throw invoiceResult.error;
    if (!businessResult.data || !invoiceResult.data) return null;
    const invoice = mapInvoice(invoiceResult.data as unknown as InvoiceJoin);
    const ids = [invoice.customerId, invoice.shippingRecipientPartyId].filter((id): id is string => Boolean(id));
    let parties: StoredPartySource[] = [];
    if (ids.length) {
      const result = await this.client.from("parties").select(partySelection).eq("business_id", businessId).in("id", ids);
      if (result.error) throw result.error;
      parties = (result.data as unknown as PartyJoin[]).map(mapParty);
    }
    return {
      business: mapBusiness(businessResult.data as unknown as BusinessJoin), invoice,
      buyer: parties.find((party) => party.id === invoice.customerId),
      shippingRecipient: parties.find((party) => party.id === invoice.shippingRecipientPartyId),
    };
  }

  async listCandidates(businessId: string): Promise<EInvoiceCandidate[]> {
    const { data, error } = await this.client.from("invoices").select("id,invoice_number,document_type,issue_date,currency,status,version,customer_id,invoice_items(id)").eq("business_id", businessId).order("issue_date", { ascending: false });
    if (error) throw error;
    return data.map((row) => {
      const reasons = [
        ...(["void", "cancelled"].includes(row.status) ? ["Void or cancelled invoices cannot be prepared."] : []),
        ...(!row.customer_id ? ["Add a saved buyer before preparing this invoice."] : []),
        ...(row.invoice_items.length === 0 ? ["Add at least one invoice line before preparing this invoice."] : []),
      ];
      return { id: row.id, invoiceNumber: row.invoice_number, documentType: row.document_type as EInvoiceCandidate["documentType"], issueDate: row.issue_date, currency: row.currency, paymentStatus: row.status, revision: row.version, eligible: reasons.length === 0, ineligibilityReasons: reasons };
    });
  }

  async listPreparations(businessId: string): Promise<EInvoicePreparationRecord[]> {
    const { data, error } = await this.client.from("e_invoice_documents").select().eq("business_id", businessId).order("updated_at", { ascending: false });
    if (error) throw error;
    return data.map(mapPreparation);
  }

  async createOrRefresh(input: CreateOrRefreshPreparationInput): Promise<EInvoicePreparationRecord> {
    const payload = {
      business_id: input.businessId, source_invoice_id: input.sourceInvoiceId, source_invoice_revision: input.sourceInvoiceRevision,
      document_type: input.documentType, document_version: "1.0", scenario: input.scenario,
      canonical_document: input.canonicalDocument ? json(input.canonicalDocument) : null,
      supplier_snapshot: json(input.supplierSnapshot), buyer_snapshot: json(input.buyerSnapshot),
      supplemental_fields: json(input.supplementalFields), provenance: json(input.provenance),
      readiness_result: json(input.readinessResult ?? { ready: Boolean(input.canonicalDocument) && input.diagnostics.length === 0, diagnostics: input.diagnostics, validatedAt: new Date().toISOString(), checkLabel: "NiagaAI internal preparation checks" }),
      status: (input.readinessResult?.ready ?? (Boolean(input.canonicalDocument) && input.diagnostics.length === 0)) ? "ready" : "needs_information",
    };
    const existing = await this.client.from("e_invoice_documents").select("id,revision,status").eq("business_id", input.businessId).eq("source_invoice_id", input.sourceInvoiceId).eq("source_invoice_revision", input.sourceInvoiceRevision).eq("active", true).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) {
      if (existing.data.status === "approved") {
        const approved = await this.findByBusinessAndId(input.businessId, existing.data.id);
        if (!approved) throw new Error("Approved preparation document could not be reloaded.");
        return approved;
      }
      const { data, error } = await this.client.from("e_invoice_documents").update({ ...payload, revision: existing.data.revision + 1 }).eq("id", existing.data.id).eq("business_id", input.businessId).eq("revision", existing.data.revision).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("The preparation document changed while it was being refreshed.");
      return mapPreparation(data);
    }
    const { data, error } = await this.client.from("e_invoice_documents").insert(payload).select().single();
    if (error) throw error;
    return mapPreparation(data);
  }

  async findByBusinessAndId(businessId: string, documentId: string): Promise<EInvoicePreparationRecord | null> {
    const { data, error } = await this.client.from("e_invoice_documents").select().eq("business_id", businessId).eq("id", documentId).maybeSingle();
    if (error) throw error;
    return data ? mapPreparation(data) : null;
  }

  async saveSupplementalFields(businessId: string, documentId: string, expectedRevision: number, fields: Record<string, unknown>) {
    const { data, error } = await this.client.rpc("save_e_invoice_supplemental_fields", { p_business_id: businessId, p_document_id: documentId, p_expected_revision: expectedRevision, p_supplemental_fields: json(fields) });
    if (error) throw error;
    return mapPreparation(data);
  }

  async replaceDraft(input: CreateOrRefreshPreparationInput & { documentId: string; expectedRevision: number; readinessResult: PreparationReadinessResult }) {
    const { data, error } = await this.client.from("e_invoice_documents").update({
      canonical_document: input.canonicalDocument ? json(input.canonicalDocument) : null,
      supplier_snapshot: json(input.supplierSnapshot),
      buyer_snapshot: json(input.buyerSnapshot),
      supplemental_fields: json(input.supplementalFields),
      provenance: json(input.provenance),
      readiness_result: json(input.readinessResult),
      scenario: input.scenario,
      status: input.readinessResult.ready ? "ready" : "needs_information",
      revision: input.expectedRevision + 1,
    }).eq("id", input.documentId).eq("business_id", input.businessId).eq("revision", input.expectedRevision).eq("active", true).neq("status", "approved").select().maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The preparation changed while you were editing it. Reload and try again.");
    return mapPreparation(data);
  }

  async approveReadyRevision(businessId: string, documentId: string, expectedRevision: number, readinessResult: PreparationReadinessResult) {
    const { data, error } = await this.client.rpc("approve_e_invoice_document", { p_business_id: businessId, p_document_id: documentId, p_expected_revision: expectedRevision, p_readiness_result: json(readinessResult) });
    if (error) throw error;
    return mapPreparation(data);
  }

  async createRevision(businessId: string, documentId: string) {
    const { data, error } = await this.client.rpc("create_e_invoice_revision", { p_business_id: businessId, p_document_id: documentId });
    if (error) throw error;
    return mapPreparation(data);
  }

  async loadApprovedForGeneration(businessId: string, documentId: string) {
    const record = await this.findByBusinessAndId(businessId, documentId);
    return record?.status === "approved" && record.active && record.submissionEligible ? record : null;
  }

  async findExact(input: Pick<PersistEInvoicePayloadSnapshotInput,
    "businessId" | "eInvoiceDocumentId" | "documentRevision" | "documentVersion" |
    "mapperVersion" | "referenceDataVersion" | "format"
  >): Promise<EInvoicePayloadSnapshotRecord | null> {
    const { data, error } = await this.client.from("e_invoice_payload_snapshots").select()
      .eq("business_id", input.businessId)
      .eq("e_invoice_document_id", input.eInvoiceDocumentId)
      .eq("document_revision", input.documentRevision)
      .eq("document_version", input.documentVersion)
      .eq("mapper_version", input.mapperVersion)
      .eq("reference_data_version", input.referenceDataVersion)
      .eq("format", input.format)
      .maybeSingle();
    if (error) throw error;
    return data ? mapPayloadSnapshot(data) : null;
  }

  async persistImmutable(input: PersistEInvoicePayloadSnapshotInput): Promise<EInvoicePayloadSnapshotRecord> {
    const payload: Database["public"]["Tables"]["e_invoice_payload_snapshots"]["Insert"] = {
      business_id: input.businessId,
      e_invoice_document_id: input.eInvoiceDocumentId,
      document_revision: input.documentRevision,
      document_version: input.documentVersion,
      mapper_version: input.mapperVersion,
      reference_data_version: input.referenceDataVersion,
      format: input.format,
      unsigned_payload: input.unsignedPayload,
      unsigned_payload_hash: input.unsignedPayloadHash,
      payload_size_bytes: input.payloadSizeBytes,
      generated_at: input.generatedAt,
    };
    const { data, error } = await this.client.from("e_invoice_payload_snapshots").insert(payload).select().single();
    if (error) {
      if (error.code === "23505") {
        const existing = await this.findExact(input);
        if (existing) return existing;
      }
      throw error;
    }
    return mapPayloadSnapshot(data);
  }

  async findConnection(businessId: string, environment: MyInvoisEnvironment): Promise<MyInvoisConnectionRecord | null> {
    const { data, error } = await this.client.from("myinvois_connections").select(connectionSelection)
      .eq("business_id", businessId).eq("environment", environment).maybeSingle();
    if (error) throw error;
    return data ? mapConnection(data) : null;
  }

  async upsertConnection(input: PersistMyInvoisConnectionInput): Promise<MyInvoisConnectionRecord> {
    const payload: Database["public"]["Tables"]["myinvois_connections"]["Insert"] = {
      business_id: input.businessId,
      environment: input.environment,
      auth_mode: input.authMode,
      taxpayer_tin: input.taxpayerTin,
      taxpayer_registration_scheme: input.taxpayerRegistrationScheme ?? null,
      taxpayer_registration_value: input.taxpayerRegistrationValue ?? null,
      credential_set_id: input.credentialSetId,
      client_id_secret_ref: input.clientIdSecretRef,
      client_secret_secret_ref: input.clientSecretSecretRef,
      enabled: input.enabled,
      document_version: "1.0",
    };
    const { data, error } = await this.client.from("myinvois_connections").upsert(payload, { onConflict: "business_id,environment" }).select(connectionSelection).single();
    if (error) throw error;
    return mapConnection(data);
  }

  async markConnectionVerified(connectionId: string, businessId: string, verifiedBy: string, verifiedAt: string): Promise<void> {
    const { data, error } = await this.client.from("myinvois_connections").update({ verified_at: verifiedAt, verified_by: verifiedBy })
      .eq("id", connectionId).eq("business_id", businessId).select("id").maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("The MyInvois connection could not be verified for this business.");
  }

}
