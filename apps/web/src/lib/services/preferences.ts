import type { Preferences } from "@/lib/job-scoring";
import type { ProfileData } from "@/lib/profile";

// What a scan scores postings against, taken from the profile. Only what the profile says is used: it has no field
// for remote work, pay or things to avoid, so those stay unknown and empty until the owner can set them (they are
// part of the Preferences type so the scorer is ready for them, not because anything is assumed).

const MAX_ROLES = 3;
const MAX_SKILLS = 40;

export function preferencesFromProfile(profile: ProfileData): Preferences {
  const seen = new Set<string>();
  const titles: string[] = [];
  for (const candidate of [profile.basics.headline, ...profile.experience.map((entry) => entry.role)]) {
    const title = candidate.trim();
    if (!title || seen.has(title.toLowerCase()) || titles.length >= MAX_ROLES) continue;
    seen.add(title.toLowerCase());
    titles.push(title);
  }
  const city = profile.basics.city.trim();
  return {
    titles,
    skills: profile.skills.map((skill) => skill.name.trim()).filter(Boolean).slice(0, MAX_SKILLS),
    places: city ? [city] : [],
    remote: "unknown",
    excludeKeywords: [],
    excludeCompanies: [],
  };
}
