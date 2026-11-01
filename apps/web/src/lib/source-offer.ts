import { REPOSITORY_URL } from "@/lib/releases";

// The source offer the GNU Affero General Public License asks for: anyone who
// uses CareerPilot over a network can get the source of the version they are
// using. The link goes to the exact commit the running build was made from
// (CAREERPILOT_COMMIT, set when the image is built), or to the repository.

const COMMIT_ID = /^[0-9a-f]{7,40}$/i;

/** The address of this version's source: the build's commit when it is a real commit id, else the repository. */
export function sourceUrlFor(commit: string | undefined): string {
  return commit && COMMIT_ID.test(commit) ? `${REPOSITORY_URL}/tree/${commit}` : REPOSITORY_URL;
}

/** The commit the running build was made from, if it was told (see the Dockerfile's GIT_SHA), otherwise undefined. */
export function buildCommit(): string | undefined {
  const commit = process.env.CAREERPILOT_COMMIT?.trim();
  return commit && COMMIT_ID.test(commit) ? commit : undefined;
}
