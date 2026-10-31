import "server-only";

import { ActionError } from "@/lib/action";
import { hasAlarm, guard } from "@/lib/guards/posting-guard";
import { ACTIONS, recordActivitySafe } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";

// The posting guard at the door: every posting text is cleaned before the AI
// reads it or it is stored. Hidden content and invisible characters never get
// further, and anything suspicious is noted in the Activity Ledger as counts
// only: the quoted lines stay out of it, since they are the attacker's text.

/** Where the posting came from, for the ledger. */
export type PostingEntry = "paste" | "agent" | "connector";

/** The cleaned text of a posting. Throws an ActionError when nothing readable is left. */
export async function checkPosting(raw: string, entry: PostingEntry): Promise<string> {
  const [text, findings] = guard(raw, "auto");
  const removed = findings.hidden_blocks.length + findings.hidden_urls.length + Object.keys(findings.invisible_chars).length;
  if (hasAlarm(findings) || removed > 0) {
    await recordActivitySafe(prisma, {
      action: ACTIONS.postingChecked,
      summary: findings.verdict.replace(/^posting_guard: /, "Posting check: "),
      targetType: "posting",
      data: {
        entry,
        alarm: hasAlarm(findings),
        instructionLike: findings.instruction_like.length,
        hiddenBlocks: findings.hidden_blocks.length,
        hiddenUrls: findings.hidden_urls.length,
        invisibleFlagged: findings.invisible_flagged,
        mixedScriptWords: findings.homoglyph_runs.length,
      },
    });
  }
  if (!text.trim()) throw new ActionError("Nothing readable was left in that posting once hidden content was removed. Paste the text you can see on the page.");
  return text;
}
