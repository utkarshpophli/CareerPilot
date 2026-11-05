import { describe, expect, it } from "vitest";

import { countryNameFromIso, countryNameOfCode } from "./country";

// Ported from career-ops (MIT): providers/_country.mjs. Names come from the runtime's locale data, so a few differ from
// everyday spelling and can shift between versions: tests pin only the stable ones.

describe("countryNameOfCode", () => {
  it("names a two-letter code in English, in either case", () => {
    expect(countryNameOfCode("DE")).toBe("Germany");
    expect(countryNameOfCode("dk")).toBe("Denmark");
    expect(countryNameOfCode("GB")).toBe("United Kingdom");
  });

  it("gives nothing for what is not a code", () => {
    for (const bad of ["", "D", "DEU1", "12", "ZZ", "xx", undefined, null, 5]) expect(countryNameOfCode(bad), String(bad)).toBe("");
  });
});

describe("countryNameFromIso", () => {
  it("also takes three-letter codes", () => {
    expect(countryNameFromIso("DEU")).toBe("Germany");
    expect(countryNameFromIso("dnk")).toBe("Denmark");
    expect(countryNameFromIso("USA")).toBe("United States");
    expect(countryNameFromIso(" gbr ")).toBe("United Kingdom");
  });

  it("gives nothing for an unassigned or malformed code", () => {
    for (const bad of ["ZZZ", "AAA", "", "DEUT", undefined]) expect(countryNameFromIso(bad), String(bad)).toBe("");
  });

  it("knows every assigned alpha-3 code it lists", () => {
    // 249 assigned codes; a few spot checks across the alphabet.
    for (const [alpha3, alpha2] of [["ABW", "AW"], ["CHE", "CH"], ["JPN", "JP"], ["NOR", "NO"], ["ZWE", "ZW"]]) expect(countryNameFromIso(alpha3)).toBe(countryNameOfCode(alpha2));
  });
});
