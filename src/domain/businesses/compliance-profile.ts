import type { RegistrationIdentifier, TaxIdentifier } from "../parties";

export type MyInvoisEnvironment = "sandbox" | "production";

/** Opaque references resolved by a future secrets provider; never raw credential values. */
export interface MyInvoisIntegrationConfiguration {
  environment: MyInvoisEnvironment;
  clientIdSecretRef: string;
  clientSecretSecretRef: string;
  certificateSecretRef?: string;
}

export interface BusinessComplianceProfile {
  tin?: TaxIdentifier;
  registration?: RegistrationIdentifier;
  sstRegistrations: TaxIdentifier[];
  tourismTaxRegistration?: TaxIdentifier;
  msicCode?: string;
  businessActivityDescription?: string;
  myInvois?: MyInvoisIntegrationConfiguration;
}
