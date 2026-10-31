# ADR 0001: Foundation decisions

Status: accepted. Date: 2026-11-01.

These close the open decisions in `research/TECHNICAL_DECISIONS.md` that blocked Phase 0.

| Decision | Choice | Why |
|---|---|---|
| ADR-001 Licence and base code | Build on dossier; the product is AGPL-3.0-only | Fastest route to all of dossier's features. MIT code from career-ops and ai-job-search is ported in with notices. Consequence: no closed-source version later. A hosted version must offer its source to users. |
| ADR-002 Users | Single-user self-hosted first, with `owner_id` and a `Principal` seam added in Phase 1 | Avoids dossier's rewrite-to-multi-user problem without paying for SaaS now. |
| ADR-003 Language and stack | TypeScript, Next.js, Node worker | Already what dossier uses. |
| ADR-004 Database | PostgreSQL only | Needed for the queue, row locks and later RLS. |
| Name | CareerPilot | Avoids the reserved "career-ops" name. |

Still open (not blocking Phase 1): ADR-005 markdown prompt modes vs prompts in code (recommended: versioned prompt files executed by our runtime, markdown exported for Claude Code), ADR-006 hosting.

## Layout decision

Phase 0 keeps `apps/web` as a standalone Yarn project, because its Dockerfile and compose files assume it is the project root. A Yarn workspace root and `packages/*` are introduced with the first shared package in Phase 3.
