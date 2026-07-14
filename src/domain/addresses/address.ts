export interface Address {
  addressLines: string[];
  city: string;
  postcode?: string;
  stateCode?: string;
  countryCode: string;
}
