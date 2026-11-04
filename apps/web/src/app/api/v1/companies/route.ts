import { z } from "zod";

import { ApiScope } from "@/generated/prisma/enums";
import { withServiceErrors } from "@/lib/api-runs";
import { api, jsonBody, parseBody } from "@/lib/api-v1";
import { BOARD_SOURCES } from "@/lib/job-search/boards";
import { prisma } from "@/lib/prisma";
import { addCompany, listCompanies } from "@/lib/services/companies";

/** GET /api/v1/companies: the employers whose job boards are watched, with how each one's last scan went. */
export const GET = (request: Request) => api(request, ApiScope.READ, () => listCompanies(prisma));

const addBody = z.object({
  source: z.enum(BOARD_SOURCES).optional(),
  board: z.string().trim().min(1).max(500),
  name: z.string().max(200).optional(),
});

/**
 * POST /api/v1/companies { "board": "stripe" | "https://job-boards.greenhouse.io/stripe", "source"?, "name"? }
 * starts watching an employer's own job board (Greenhouse, Lever, Ashby, Workable, Recruitee or Teamtailor).
 * "source" can be left out when "board" is the company's careers address. It
 * only records a name; reading the board happens in a scan.
 */
export const POST = (request: Request) =>
  api(request, ApiScope.WRITE, async () => {
    const input = parseBody(addBody, await jsonBody(request));
    return withServiceErrors(() => addCompany(prisma, input));
  });
