export type EntityId = string;
export type ISODateString = string;
export type ISODateTimeString = string;
export type CurrencyCode = "MYR";

/** Frontend money values are decimal ringgit amounts, rounded to two decimal places. */
export type MoneyAmount = number;

export interface AuditableEntity {
  id: EntityId;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
