import { describe, expect, it } from "vitest";
import {
  addDecimalValues,
  compareDecimalValues,
  currencyCodeSchema,
  decimalStringSchema,
  multiplyDecimalValues,
  percentageOfMoney,
  roundDecimalValue,
  subtractDecimalValues,
  sumMoneyValues,
} from ".";

const decimal = (value: string) => decimalStringSchema.parse(value);
const MYR = currencyCodeSchema.parse("MYR");

describe("decimal arithmetic", () => {
  it("calculates without binary floating-point drift", () => {
    expect(addDecimalValues(decimal("0.1"), decimal("0.2"))).toBe("0.3");
    expect(subtractDecimalValues(decimal("1"), decimal("0.9"))).toBe("0.1");
    expect(multiplyDecimalValues(decimal("3"), decimal("0.1"))).toBe("0.30");
  });

  it("compares differently scaled and very large values exactly", () => {
    expect(compareDecimalValues(decimal("12.50"), decimal("12.5"))).toBe(0);
    expect(compareDecimalValues(decimal("999999999999999999.99"), decimal("999999999999999999.98"))).toBe(1);
  });

  it("rounds money half away from zero", () => {
    expect(roundDecimalValue(decimal("1.005"))).toBe("1.01");
    expect(roundDecimalValue(decimal("-1.005"))).toBe("-1.01");
    expect(roundDecimalValue(decimal("8"))).toBe("8.00");
  });

  it("calculates percentages and money sums in one currency", () => {
    expect(percentageOfMoney({ amount: decimal("100"), currency: MYR }, decimal("8"))).toEqual({
      amount: "8.00",
      currency: "MYR",
    });
    expect(sumMoneyValues([
      { amount: decimal("0.10"), currency: MYR },
      { amount: decimal("0.20"), currency: MYR },
    ], MYR)).toEqual({ amount: "0.30", currency: "MYR" });
  });

  it("rejects a money value in a different currency", () => {
    const USD = currencyCodeSchema.parse("USD");
    expect(() => sumMoneyValues([{ amount: decimal("1"), currency: USD }], MYR)).toThrow(
      "All money values in a calculation must use the requested currency.",
    );
  });
});
