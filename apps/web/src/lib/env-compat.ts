// CareerPilot's settings are environment variables named CAREERPILOT_*. The
// project started from dossier, whose variables were DOSSIER_*, so a server
// that still uses those names keeps working: an old name is copied to the new
// one when the new one is not set. The new name always wins. Remove this when
// nobody is expected to be on the old names any more.

const OLD_PREFIX = "DOSSIER_";
const NEW_PREFIX = "CAREERPILOT_";

type Env = Record<string, string | undefined>;

/** Copies DOSSIER_X to CAREERPILOT_X where the latter is not set. Returns the old names that were used. */
export function applyLegacyEnv(env: Env = process.env): string[] {
  const used: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith(OLD_PREFIX) || value === undefined) continue;
    const next = NEW_PREFIX + name.slice(OLD_PREFIX.length);
    if (env[next] !== undefined) continue;
    env[next] = value;
    used.push(name);
  }
  return used;
}

let warned = false;

/** Applies the old names to the real environment, and says once which ones to rename. */
export function adoptLegacyEnv(env: Env = process.env): void {
  const used = applyLegacyEnv(env);
  if (used.length === 0 || warned) return;
  warned = true;
  process.stderr.write(
    `CareerPilot: ${used.length} setting${used.length === 1 ? " is" : "s are"} still using the old dossier name${used.length === 1 ? "" : "s"} (${used.join(", ")}). ` +
      `It still works; rename ${used.length === 1 ? "it" : "them"} from DOSSIER_ to CAREERPILOT_ when you can.\n`,
  );
}
