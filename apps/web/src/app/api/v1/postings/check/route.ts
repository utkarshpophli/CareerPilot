import { ApiScope } from "@/generated/prisma/enums";
import { api, ApiError, jsonBody } from "@/lib/api-v1";
import { ActionError } from "@/lib/action";
import { hasAlarm } from "@/lib/guards/posting-guard";
import { inspectPosting } from "@/lib/posting-check";

/**
 * POST /api/v1/postings/check { "text": "…" }: cleans a posting (hidden text,
 * invisible characters) and says what looks like an instruction aimed at an
 * AI. Notes anything found in the Activity Ledger, as counts. Needs a
 * write token because of that.
 */
export const POST = (request: Request) =>
  api(request, ApiScope.WRITE, async () => {
    const { text } = await jsonBody(request);
    if (typeof text !== "string" || !text.trim()) throw new ApiError(400, "bad_request", 'Send { "text": "…" } with the posting.');
    if (text.length > 100_000) throw new ApiError(413, "too_large", "A posting is at most 100,000 characters.");
    try {
      const { text: cleaned, findings } = await inspectPosting(text, "api");
      return { text: cleaned, alarm: hasAlarm(findings), findings };
    } catch (error) {
      if (error instanceof ActionError) throw new ApiError(422, "nothing_readable", error.message);
      throw error;
    }
  });
