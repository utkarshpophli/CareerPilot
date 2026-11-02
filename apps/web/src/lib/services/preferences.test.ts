import { describe, expect, it } from "vitest";

import { demoProfile } from "@/lib/demo-profile";

import { preferencesFromProfile } from "./preferences";

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
