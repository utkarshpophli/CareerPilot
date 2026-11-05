import { describe, expect, it } from "vitest";

import { compensationCurrency, compensationPeriod, parseAmount, parseAnnualCompensation } from "./salary-text";

// Ported with its cases from career-ops (MIT): providers/_salary-text.mjs. Pay is read only when the text states it, and
// a figure in the wrong unit is refused rather than returned.

describe("parseAmount", () => {
  it("reads a single amount and a range, with k for thousands applying to both ends", () => {
    expect(parseAmount("60000")).toEqual({ min: 60000, max: 60000, mid: 60000 });
    expect(parseAmount("80-90k")).toEqual({ min: 80000, max: 90000, mid: 85000 });
    expect(parseAmount("80k–90k")).toEqual({ min: 80000, max: 90000, mid: 85000 });
    expect(parseAmount("90 - 80")).toEqual({ min: 80, max: 90, mid: 85 });
  });

  it("strips currency symbols and a trailing three-letter code, repeated symbols included", () => {
    expect(parseAmount("$123,684—$254,644 USD")).toEqual({ min: 123684, max: 254644, mid: 189164 });
    expect(parseAmount("450k SEK")).toEqual({ min: 450000, max: 450000, mid: 450000 });
    expect(parseAmount("80-90k eur")).toEqual({ min: 80000, max: 90000, mid: 85000 });
    expect(parseAmount("60k CAD per year")).toEqual({ min: 60000, max: 60000, mid: 60000 });
  });

  it("reads both separator conventions, deciding which is which before touching either", () => {
    expect(parseAmount("45.000,00")?.min).toBe(45000);
    expect(parseAmount("123,684.50")?.min).toBe(123684.5);
    expect(parseAmount("35.000")?.min).toBe(35000);
    expect(parseAmount("123,684")?.min).toBe(123684);
    expect(parseAmount("82.5")?.min).toBe(82.5);
    expect(parseAmount("45000,50")?.min).toBe(45000.5);
    // Danish writing, as the Danish portals do.
    expect(parseAmount("45.000 - 55.000")).toEqual({ min: 45000, max: 55000, mid: 50000 });
  });

  it("gives nothing for text that is not an amount, or is not yearly", () => {
    for (const text of ["", "  ", "?", "-", "n/a", "null", "competitive", "DOE", "$20-25/hr", "5.000 EUR per month", undefined, null]) {
      expect(parseAmount(text), String(text)).toBeNull();
    }
  });
});

describe("compensationPeriod and compensationCurrency", () => {
  it("names the pay period only when the text does", () => {
    expect(compensationPeriod("60k per year")).toBe("annual");
    expect(compensationPeriod("DKK 45.000 pr. måned")).toBe("monthly"); // the Danish portals write it so
    expect(compensationPeriod("DKK 540.000 pr. år")).toBe("annual");
    expect(compensationPeriod("DKK 250 pr. time")).toBe("hourly");
    expect(compensationPeriod("5.000 EUR pro Monat")).toBe("monthly");
    expect(compensationPeriod("5000 / month")).toBe("monthly");
    expect(compensationPeriod("$20/hr")).toBe("hourly");
    expect(compensationPeriod("competitive")).toBeNull();
  });

  it("names one currency: its one capital code, else its one unambiguous symbol, else nothing", () => {
    expect(compensationCurrency("65.000 EUR - 75.000 EUR")).toBe("EUR");
    expect(compensationCurrency("€60k")).toBe("EUR");
    expect(compensationCurrency("£50k")).toBe("GBP");
    expect(compensationCurrency("$90k")).toBeUndefined(); // a dollar sign names no single currency
    expect(compensationCurrency("60k")).toBeUndefined();
    expect(compensationCurrency("USD 60k or EUR 55k")).toBe(""); // two currencies: no fallback may override the text
  });
});

describe("parseAnnualCompensation", () => {
  it("reads a yearly range whose currency is repeated after each end", () => {
    expect(parseAnnualCompensation("65.000 EUR-75.000 EUR")).toEqual({ min: 65000, max: 75000, mid: 70000 });
  });

  it("refuses a figure for another period", () => {
    expect(parseAnnualCompensation("$20-25/hr")).toBeNull();
    expect(parseAnnualCompensation("5.000 EUR per month")).toBeNull();
    expect(parseAnnualCompensation("DKK 45.000 pr. måned")).toBeNull();
    expect(parseAnnualCompensation("DKK 540.000 pr. år")).toEqual({ min: 540000, max: 540000, mid: 540000 });
  });
});
