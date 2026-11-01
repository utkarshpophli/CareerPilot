# upstream/: reference copies, do not run

These are copies of the two MIT-licensed projects that CareerPilot ports behaviour and code from:

- `career-ops/` (Copyright (c) 2026 Santiago Fernandez de Valderrama, MIT)
- `ai-job-search/` (Copyright (c) 2026 Mads Lorentzen, MIT)

They are here to read, not to run or build. Nothing in `apps/` imports from them, and nothing here ships in any CareerPilot artifact. When code is ported, the new file keeps its origin path and the MIT copyright line (see `THIRD_PARTY_NOTICES.md`).

## What was changed from the originals

- **Personal data removed:** `career-ops/SIGNATURES.md`, `HIRED.md`, `CONTRIBUTORS.md` and `MAINTAINERS.md` list other people's handles, names and employment stories. They are not copied here.
- **Agent configuration made inert:** the folders and files that Claude Code, OpenCode, Codex, Gemini CLI and similar tools load automatically (`.claude`, `.agents`, `.claude-plugin`, `hooks`, `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, and so on) were renamed with a leading underscore (`_claude`, `_AGENTS.md`, ...). Their content is unchanged, so it can still be read as reference, but an assistant opened in this repository no longer picks up another project's instructions, skills or permission lists. The same goes for the nested `.github` (now `_github`).
- Nothing else was edited.

## Handle with care

- Some scripts here (for example `career-ops/batch/batch-runner.sh`) start AI assistants with permission checks switched off. Do not run them.
- `career-ops/` is a reserved name (`career-ops/TRADEMARK.md`): do not use it for anything CareerPilot ships.
