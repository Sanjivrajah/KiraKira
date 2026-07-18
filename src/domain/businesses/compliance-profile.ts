import type { RegistrationIdentifier, TaxIdentifier } from "../parties";

export type MyInvoisEnvironment = "sandbox" | "production";

/** Opaque OAuth references resolved server-side; never raw credential values. */
export interface MyInvoisIntegrationConfiguration {
  environment: MyInvoisEnvironment;
  clientIdSecretRef: string;
  clientSecretSecretRef: string;
}

export interface BusinessComplianceProfile {
  tin?: TaxIdentifier;
  registration?: RegistrationIdentifier;
  sstRegistrations: TaxIdentifier[];
  tourismTaxRegistration?: TaxIdentifier;
  msicCode?: string;
  businessActivityDescription?: string;
}
