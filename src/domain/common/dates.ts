import { z } from "zod";

declare const dateBrand: unique symbol;

export type ISODate = string & { readonly [dateBrand]: "ISODate" };
export type ISODateTime = string & { readonly [dateBrand]: "ISODateTime" };
export type LocalTime = string & { readonly [dateBrand]: "LocalTime" };

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function isCalendarDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

export const isoDateSchema = z
  .string()
  .refine(isCalendarDate, "Use a valid ISO date in YYYY-MM-DD format.")
  .transform((value) => value as ISODate);

export const isoDateTimeSchema = z
  .iso.datetime({ offset: true })
  .transform((value) => value as ISODateTime);

export const localTimeSchema = z
  .string()
  .regex(LOCAL_TIME_PATTERN, "Use local time in HH:mm or HH:mm:ss format.")
  .transform((value) => value as LocalTime);
