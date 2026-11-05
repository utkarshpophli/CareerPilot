import { describe, expect, it } from "vitest";

import { demoProfile } from "@/lib/demo-profile";

import { DEFAULT_SCAN_PREFERENCES, settingsFromRows } from "@/lib/settings";

import { preferencesFor, preferencesFromProfile } from "./preferences";

describe("preferencesFromProfile", () => {
  it("takes the roles, skills and place from what the profile says, and nothing the profile does not say", () => {
    const profile = demoProfile();
    const prefs = preferencesFromProfile(profile);
    expect(prefs.titles).toContain(profile.basics.headline);
    expect(prefs.skills).toEqual(expect.arrayContaining(profile.skills.slice(0, 3).map((skill) => skill.name)));
    expect(prefs.places).toEqual([profile.basics.city]);
    // The profile has no field for remote work, pay or exclusions: none is invented.
    expect(prefs.remote).toBe("unknown");
    expect(prefs.minSalary).toBeUndefined();
    expect(prefs.excludeKeywords).toEqual([]);
    expect(prefs.excludeCompanies).toEqual([]);
  });

  it("adds recent roles once each, trimmed, and leaves out blanks", () => {
    const profile = demoProfile();
    profile.basics.headline = "  ";
    profile.basics.city = "";
    profile.experience = [
      { ...profile.experience[0]!, role: " Product Designer " },
      { ...profile.experience[0]!, id: "x2", role: "product designer" },
      { ...profile.experience[0]!, id: "x3", role: "" },
      { ...profile.experience[0]!, id: "x4", role: "Researcher" },
      { ...profile.experience[0]!, id: "x5", role: "Intern" },
      { ...profile.experience[0]!, id: "x6", role: "Barista" },
    ];
    const prefs = preferencesFromProfile(profile);
    expect(prefs.titles).toEqual(["Product Designer", "Researcher", "Intern"]);
    expect(prefs.places).toEqual([]);
  });

  it("caps a long skills list", () => {
    const profile = demoProfile();
    profile.skills = Array.from({ length: 80 }, (_, index) => ({ ...profile.skills[0]!, id: `s${index}`, name: `Skill ${index}` }));
    expect(preferencesFromProfile(profile).skills).toHaveLength(40);
  });
});

describe("preferencesFor", () => {
  it("is the profile's preferences until the owner says more", () => {
    const profile = demoProfile();
    expect(preferencesFor(profile, DEFAULT_SCAN_PREFERENCES)).toEqual(preferencesFromProfile(profile));
    expect(preferencesFor(profile, undefined)).toEqual(preferencesFromProfile(profile));
  });

  it("adds what the owner set: remote work, the lowest pay, words and companies to avoid", () => {
    const prefs = preferencesFor(demoProfile(), { remote: "yes", minSalary: { amount: 60000, currency: "EUR" }, excludeKeywords: ["commission only"], excludeCompanies: ["Evil Corp"] });
    expect(prefs).toMatchObject({ remote: "yes", minSalary: { amount: 60000, currency: "EUR" }, excludeKeywords: ["commission only"], excludeCompanies: ["Evil Corp"] });
    expect(prefs.titles.length).toBeGreaterThan(0);
  });
});

describe("the stored preferences setting", () => {
  it("reads as the default when missing, broken or out of range, and keeps what is valid", () => {
    expect(settingsFromRows([]).scanPreferences).toEqual(DEFAULT_SCAN_PREFERENCES);
    expect(settingsFromRows([{ key: "scanPreferences", value: "not json" }]).scanPreferences).toEqual(DEFAULT_SCAN_PREFERENCES);
    const valid = JSON.stringify({ remote: "no", minSalary: { amount: 50000, currency: "usd" }, excludeKeywords: ["  spam  "], excludeCompanies: [] });
    expect(settingsFromRows([{ key: "scanPreferences", value: valid }]).scanPreferences).toEqual({ remote: "no", minSalary: { amount: 50000, currency: "USD" }, excludeKeywords: ["spam"], excludeCompanies: [] });
    // One bad part falls back on its own; the rest is kept.
    const mixed = JSON.stringify({ remote: "maybe", minSalary: { amount: -5, currency: "EURO" }, excludeKeywords: ["ok"], excludeCompanies: "no" });
    expect(settingsFromRows([{ key: "scanPreferences", value: mixed }]).scanPreferences).toEqual({ remote: "unknown", minSalary: null, excludeKeywords: ["ok"], excludeCompanies: [] });
  });
});
