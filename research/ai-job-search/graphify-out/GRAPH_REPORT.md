# Graph Report - C:\Projects\project_rho\ai-job-search  (2026-11-01)

## Corpus Check
- 281 files · ~262,141 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2930 nodes · 5134 edges · 177 communities (128 shown, 49 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 153 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Posting Guard Tests
- Apply Flow State
- FreeHire Search CLI
- Salary Excel Converter
- Job Key Dedup
- LinkedIn Search CLI
- Jobindex Search CLI
- Jobbank Search CLI
- Apply Records
- Apply Host Verification
- Rank and Scrape State
- Posting Guard and Page Decode
- Upstream Update Checker
- Fetch Page and Robots
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 66
- Community 67
- Community 68
- Community 69
- Community 70
- Community 71
- Community 72
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 120
- Community 121
- Community 122
- Community 123
- Community 124
- Community 125
- Community 126
- Community 127
- Community 128
- Community 129
- Community 130
- Community 131
- Community 132
- Community 133
- Community 134
- Community 135
- Community 136
- Community 137
- Community 138
- Community 139
- Community 140
- Community 141
- Community 142
- Community 143
- Community 144
- Community 145
- Community 146
- Community 147
- Community 148
- Community 149
- Community 150
- Community 151
- Community 152
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 174
- Community 175

## God Nodes (most connected - your core abstractions)
1. `run_guards()` - 77 edges
2. `entry()` - 50 edges
3. `Page` - 47 edges
4. `parse_sheet()` - 41 edges
5. `FakeWorksheet` - 37 edges
6. `/apply command (drafter-reviewer workflow)` - 35 edges
7. `Apply` - 32 edges
8. `DetectColumnTypeTests` - 29 edges
9. `RankCommandSpec` - 27 edges
10. `allowed()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `tools/posting_guard.py integrity gate` --semantically_similar_to--> `Trust boundary: postings, email and web pages are untrusted data`  [INFERRED] [semantically similar]
  README.md → ai-job-search/.claude/skills/job-application-assistant/09-web-research.md
- `Closed-at-source detection (isActive banner)` --semantically_similar_to--> `/rank command (triage scraped jobs)`  [INFERRED] [semantically similar]
  .claude/skills/job-scraper/SKILL.md → ai-job-search/.claude/commands/rank.md
- `Thin-pointer design (single source of truth)` --semantically_similar_to--> `Markdown specs are the implementation (no duplicate runtimes)`  [INFERRED] [semantically similar]
  AGENTS.md → CONTRIBUTING.md
- `TestFooterBand` --uses--> `Line`  [INFERRED]
  tests/test_verify_layout.py → tools/verify_layout.py
- `TestFooterBand` --uses--> `Page`  [INFERRED]
  tests/test_verify_layout.py → tools/verify_layout.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Installed job-portal CLI skill family** — portal_cli_pattern, ai_job_search_agents_skills_freehire_search_skill, ai_job_search_agents_skills_linkedin_search_skill, ai_job_search_agents_skills_jobbank_search_skill, ai_job_search_agents_skills_jobdanmark_search_skill, ai_job_search_agents_skills_jobindex_search_skill, ai_job_search_agents_skills_jobnet_search_skill [INFERRED 0.80]
- **Posting retrieval and integrity-gate pipeline** — ai_job_search_claude_agents_posting_fetcher_agent, ai_job_search_claude_agents_posting_scorer_agent, web_research_escalation, fetch_page_robots, posting_integrity_gate [INFERRED 0.85]
- **Danish demo portals shipped disabled by default** — danish_demo_portal_opt_in, ai_job_search_agents_skills_jobbank_search_skill, ai_job_search_agents_skills_jobdanmark_search_skill, ai_job_search_agents_skills_jobindex_search_skill, ai_job_search_agents_skills_jobnet_search_skill [EXTRACTED 1.00]
- **Apply two-agent drafter-reviewer pipeline** — ai_job_search_claude_commands_apply_command, ai_job_search_claude_agents_posting_fetcher_agent, ai_job_search_claude_agents_application_reviewer_agent, factual_grounding_audit, trust_boundary_rule [EXTRACTED 1.00]
- **Shared application tracker lifecycle across commands** — job_search_tracker_csv, ai_job_search_claude_commands_apply_command, ai_job_search_claude_commands_outcome_command, ai_job_search_claude_commands_gmail_sync_command, ai_job_search_claude_commands_notion_sync_command, ai_job_search_claude_commands_html_report_command, tracker_status_vocabulary [INFERRED 0.85]
- **Untrusted third-party text handling across commands** — trust_boundary_rule, posting_guard_tool, email_classification_rule, ai_job_search_claude_commands_rank_command, ai_job_search_claude_commands_gmail_sync_command, ai_job_search_claude_commands_notion_sync_command [INFERRED 0.80]
- **/scrape run pipeline: search, dedup, detail, store, health check, present** — claude_skills_job_scraper_skill_md, scrape_dedup_pipeline, seen_jobs_state, tracker_csv, portal_health_check [EXTRACTED 1.00]
- **Two-level defense: instruction rules plus permission grants and CI guards** — threat_model, trust_boundary_rule, posting_guard_py, permission_grants_table, security_guards_py [INFERRED 0.85]
- **Optional state fields that must never be inferred or back-filled** — no_backfill_rule, posted_date_field, deadline_field, source_field, recorded_gaps_field [EXTRACTED 1.00]
- **Six-command job search workflow** — cmd_setup, cmd_scrape, cmd_rank, cmd_apply, cmd_interview, cmd_outcome [EXTRACTED 1.00]
- **/apply draft-review-revise-compile loop until CV is 2 pages** — ai_job_search_assets_readme_apply_draft, ai_job_search_assets_readme_apply_review, ai_job_search_assets_readme_apply_revise, ai_job_search_assets_readme_apply_compile_inspect, output_cv_two_pages [EXTRACTED 1.00]
- **Application funnel: 69 applications, 20 interviews, 1 contract** — stat_69_applications, stat_20_first_interviews, stat_signed_contract [EXTRACTED 1.00]

## Communities (177 total, 49 thin omitted)

### Community 0 - "Posting Guard Tests"
Cohesion: 0.06
Nodes (21): Bypasses, Calibration, CleanPostings, GuardFixture, HiddenContent, Homoglyphs, InputHandling, InstructionLikeLines (+13 more)

### Community 1 - "Apply Flow State"
Cohesion: 0.09
Nodes (20): ApplyRunsThePageCountCheck, page_count_invocations(), Guard for /apply Step 5b's page-count check.  The 2-page CV and 1-page cover l, The body of one markdown section, up to the next heading of any depth., (document path, page count) for every runnable verify_pdf --pages line., section(), Apply, Candidates (+12 more)

### Community 2 - "FreeHire Search CLI"
Cohesion: 0.06
Nodes (53): ALIAS, commaList(), Flags, FlagValue, KNOWN_FLAGS, main(), parseFlags(), parseIntFlag() (+45 more)

### Community 3 - "Salary Excel Converter"
Cohesion: 0.06
Nodes (23): BareCountIndexPairingTests, BooleanCellCliTests, CompoundCategoryPairingTests, DetectColumnTypeTests, FakeWorksheet, ParseNumericCellLocaleTests, QualifiedCompanyHeaderNextToQualifiedSalaryHeader, A count/index pair whose headers carry no category word is still a pair. (+15 more)

### Community 4 - "Job Key Dedup"
Cohesion: 0.05
Nodes (28): AuditCLI, CanonicalAndLegacyShape, CompanyFallbackCLI, MakeKey, MixedScriptNamesKeepTheirIdentity, CompletedProcess, Tests for tools/job_key.py - the canonical seen_jobs.json key function.  /scra, A name that folds to a fragment is as lossy as one that folds to nothing. (+20 more)

### Community 5 - "LinkedIn Search CLI"
Cohesion: 0.07
Nodes (39): Flags, KNOWN_FLAGS, main(), parseFlags(), DetailOpts, normalizeId(), runDetail(), buildUrl() (+31 more)

### Community 6 - "Jobindex Search CLI"
Cohesion: 0.07
Nodes (37): argv, commands, invoked, bodyText(), buildUrl(), DANISH_MONTHS, decodeHtmlEntities(), detail (+29 more)

### Community 7 - "Jobbank Search CLI"
Cohesion: 0.07
Nodes (28): argv, commands, invoked, detail, normalizeSearchItem(), search, extractCdata(), extractJobIdFromUrl() (+20 more)

### Community 8 - "Apply Records"
Cohesion: 0.05
Nodes (26): ApplyArchivesThePosting, ApplyRecordsApplication, ArchiveNameIsOnePathComponent, DeadlineSurvivesEveryWrite, DraftedMeansDraftedToEveryReader, FallbackGlobFindsOneRolesDocuments, Guards for /apply's tracker recording step (Step 6b).  The step is part of the, /apply appends rows with one field per header column, so inserting         `dea (+18 more)

### Community 9 - "Apply Host Verification"
Cohesion: 0.07
Nodes (21): ApplyHostVerificationSpecTests, ApplyPostingGateWiringTests, classify_posting_host(), discover_installed_portal_hosts(), installed_portal_skills(), InstalledPortalsAreVerifiedTests, portal_enabled(), portal_hosts() (+13 more)

### Community 10 - "Rank and Scrape State"
Cohesion: 0.09
Nodes (35): date, datetime, The scrape helper filters before detail fetches and never rewrites old entries., ScrapeStateTests, band(), cmd_apply(), cmd_candidates(), cmd_sweep() (+27 more)

### Community 11 - "Posting Guard and Page Decode"
Cohesion: 0.09
Nodes (30): LegacyCharsets, page(), tools/page_decode.py decodes a saved page by the charset it declares.  Why thi, UnchangedBehaviour, declared_codec(), decode_page(), Decode a saved web page by the charset it declares, the way a browser does.  f, The codec a page declares through a UTF-16 BOM or a <meta> tag, or None. (+22 more)

### Community 12 - "Upstream Update Checker"
Cohesion: 0.10
Nodes (13): DirectCloneFallbackTests, FailedFetchTests, ForkWithoutUpstreamRemoteTests, IncompleteComparisonTests, LegacyEncodingTests, CompletedProcess, Simulates upstream renaming/deleting one framework file while the     fork stil, UpstreamCheckerRepoFixture (+5 more)

### Community 13 - "Fetch Page and Robots"
Cohesion: 0.09
Nodes (8): CurlArgvShape, Fetching, FetchPageFixture, _Handler, tools/fetch_page.py is the browser-header retry from 09-web-research.md.  Why, The grant is `Bash(python tools/fetch_page.py:*)`, so what curl is handed     i, RobotsGate, SchemeAndPathGuards

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (14): AlreadyAppliedTests, git(), MissingUpstreamRefTests, CompletedProcess, Path, Builds a real git history: a shared base, then an `upstream/master`     ref tha, The workflow must no-op on the upstream template, so a template clone     never, RelevanceFilterTests (+6 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (33): /apply drafter-reviewer workflow, CHANGELOG.md (frozen at 1.7.4), tools/check_upstream_updates.py, CLAUDE.md (candidate profile and workflow rules), commitizen SemVer bump from commit/PR types, tools/convert_salary_excel.py, Danish portal skills (jobindex, jobnet, jobbank, jobdanmark), tools/fetch_page.py browser-header retry (+25 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (20): Path, Guards for the tracker status vocabulary (issue #298).  The tracker CSV `statu, Open is derived by exclusion from the one explicit Final list, so a new, The vocabulary block must live as its own section below Step 1's closing, The writer must use canonical underscore spellings, never space forms., Each reader that classifies tracker values must handle both spellings     and m, Read-tolerance: both spellings must reach the Rejected/Closed bucket., No tracker value may drop out of the stats silently: unrecognised values (+12 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (32): application-reviewer agent (hiring-manager proxy), /add-template command, /apply command (drafter-reviewer workflow), /expand command (competency expansion), /interview command (prep pack and mock), Interview consistency: no claim in the room not on the paper, interview_prep_<stage>.md prep pack, Job Application Assistant skill (SKILL.md) (+24 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (14): FakeRun, install(), InstallPortalClis, Tests for tools/install_portal_clis.py - the one-command portal CLI install., A fork-added portal is found without editing any list., discover(), _force_utf8_output(), install() (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.09
Nodes (13): Guards for the LaTeX authoring guidance and the example documents.  Three sile, F34: every documented extraction command must pin the encoding., #384: the pdflatex fallback must load T1 fontenc, and only under pdflatex., The geometry scale specified in 05-cv-templates.md must match cv/main_example.te, Return the body of a markdown section up to the next heading., F9: no document or template doc may teach `\\item [text]`., F31: both template guides must document the LaTeX escapes., section() (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (27): bin, jobbank, dependencies, @bunli/core, @bunli/utils, node-html-parser, zod, description (+19 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (27): bin, jobdanmark, dependencies, @bunli/core, @bunli/utils, node-html-parser, zod, description (+19 more)

### Community 22 - "Community 22"
Cohesion: 0.07
Nodes (27): bin, jobindex, dependencies, @bunli/core, @bunli/utils, node-html-parser, zod, description (+19 more)

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (15): at(), A bbox line; text_left is where its text starts after a merged list marker., The orphan rule compares where the TEXT starts, not where the line starts., Dashes are not markers: an em dash can open a bullet's second line., The bullet line starts at x58.9, left of the header; its text is further in., The header's text at x70.4 counts as indented, so the left-edge rule missed it., `○` is not a LIST_MARKERS glyph, so the header keeps x59.0, as the left-edge rul, Both texts at x70.4, but the merged `○` keeps the header at x59.0. (+7 more)

### Community 24 - "Community 24"
Cohesion: 0.10
Nodes (27): jobbank-search skill (Akademikernes Jobbank), jobdanmark-search skill (Jobdanmark.dk), jobindex-search skill (Jobindex.dk), jobnet-search skill (STAR Jobnet.dk), posting-fetcher agent (retrieves one posting for /apply), posting-scorer agent (batch fetch and score for /rank), Danish demo portals ship disabled (enabled: false, opt-in via /setup), tools/fetch_page.py with robots.txt enforcement (+19 more)

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (8): match_score(), Compute a match score between 0 and 100 for ranking results., MatchScoreTests, TestMatchScoreAnglicize, TestMatchScoreExactMatch, TestMatchScoreNoOverlap, TestMatchScoreShortQuery, TestMatchScoreSubstring

### Community 26 - "Community 26"
Cohesion: 0.10
Nodes (14): _apply_research_step(), _interview_research_step(), Guards for the company-research cache spec.  /apply Step 3's reviewer agent an, New one-line restatement inside the cache-check paragraph itself, distinct, Pre-existing rule (unrelated to this cache) that must survive: the         cach, New one-line restatement inside the cache-check paragraph itself - distinct, Split a markdown spec into {heading: body} on a given '\\n<marker> ' prefix., apply.md's '### 1. Research the Company' subsection, isolated from the     othe (+6 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (7): FAIL-OPEN REGRESSION: /cs/ is disallowed despite the blank lines., FAIL-OPEN REGRESSION: 'Allow: /' precedes 'Disallow: /cs/' in the         file;, Cautious tie-break: Google resolves ties to Allow, we do not., The only ordering that exercises the tie-break clause: with Allow         first, TestAgentSelection, TestPathRules, allowed()

### Community 28 - "Community 28"
Cohesion: 0.08
Nodes (25): bin, jobnet, dependencies, @bunli/core, @bunli/utils, zod, description, devDependencies (+17 more)

### Community 29 - "Community 29"
Cohesion: 0.08
Nodes (23): compilerOptions, lib, module, moduleResolution, noFallthroughCasesInSwitch, noImplicitAny, noUnusedLocals, noUnusedParameters (+15 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (12): argv, commands, invoked, categories, Category, LocationGroup, LocationItem, locations (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.08
Nodes (23): compilerOptions, lib, module, moduleResolution, noFallthroughCasesInSwitch, noImplicitAny, noUnusedLocals, noUnusedParameters (+15 more)

### Community 32 - "Community 32"
Cohesion: 0.08
Nodes (23): compilerOptions, lib, module, moduleResolution, noFallthroughCasesInSwitch, noImplicitAny, noUnusedLocals, noUnusedParameters (+15 more)

### Community 33 - "Community 33"
Cohesion: 0.08
Nodes (23): compilerOptions, lib, module, moduleResolution, noFallthroughCasesInSwitch, noImplicitAny, noUnusedLocals, noUnusedParameters (+15 more)

### Community 34 - "Community 34"
Cohesion: 0.15
Nodes (24): Apply loop step: Compile + inspect, Apply loop step: Draft, How /apply works (flow diagram), Integrity gate and fit score (job posting intake), Apply loop step: Review, Apply loop step: Revise, AI Job Search hero banner, Hero terminal command ticker (/setup to /outcome, /apply <posting-url>) (+16 more)

### Community 35 - "Community 35"
Cohesion: 0.11
Nodes (7): SILENT FAILURE: the hole an ejected \\cventry leaves behind., Measured to the last body line (y410), not to the page number at y770., TestGapAndBottomSpace, TestHeadingAndIndentDetection, Line, Page, One line in the bottom band is a page number; two means body text spilled in.

### Community 36 - "Community 36"
Cohesion: 0.15
Nodes (23): check_agent_tool_grants(), check_gitignore(), check_package_manifests(), check_permissions(), check_skill_tool_grants(), check_tracked_node_modules(), _frontmatter(), _gitignore_lines() (+15 more)

### Community 37 - "Community 37"
Cohesion: 0.14
Nodes (23): /rank command (triage scraped jobs), tools/rank_state.py, Candidate profile (01-candidate-profile.md), job-scraper search-queries.md, job-scraper SKILL.md (/scrape), upskill SKILL.md (/upskill), Closed-at-source detection (isActive banner), Eligibility Gate (citizenship/PR hard filter) (+15 more)

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (13): HtmlReportCommandFileTests, HtmlReportGitignoreTests, HtmlReportLintIntegrationTests, HtmlReportTrackerFieldTests, Tests for the /html-report command and its gitignore rule.  Mirrors the patter, offer_declined is the candidate turning an offer down (a success)         and w, lint_skills.py must pass after the command is added., Structural checks on the command file itself. (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.20
Nodes (4): CompletedProcess, A skill's or command's allowed-tools pre-approves those tools for the turn, run_guards(), SkillGrantGuardTests

### Community 40 - "Community 40"
Cohesion: 0.13
Nodes (11): detail(), JOB, CLI_PATH, CLIResult, runCLI(), cli(), ENTITY_TAGGED, HIDDEN_MARKUP (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (13): buildSearchParams(), createSearchOutput(), externalAdUrl(), JobAdResult, occupationId(), SearchApiResponse, SearchFacetsRaw, SearchFlags (+5 more)

### Community 42 - "Community 42"
Cohesion: 0.18
Nodes (16): cleanText(), descriptionToText(), DetailResult, findJobPostingJsonLd(), fromJsonLd(), fromRenderedHtml(), isJobPosting(), JsonLdJobPosting (+8 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (12): detail, DetailApiResponse, formatDetailPlain(), mapSearchAdToDetail(), outputPlain(), prepareDetail(), JobAdRaw, isHiddenTag() (+4 more)

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (8): Search for a company by name. Returns matching entries sorted by relevance., search_company(), _entry(), _make_data(), SearchCompanyRefactoredTests, TestSearchCompanyBasicMatch, TestSearchCompanyCityFilter, TestSearchCompanyScoreThreshold

### Community 45 - "Community 45"
Cohesion: 0.12
Nodes (13): derive_contract_fields(), derive_stored_fields(), Path, Tests for the /scrape Step 2 search-output contract across portal CLIs.  Mirro, A stored field the spec never explains gets backfilled by guessing., The new key rule must not replay jobs stored under legacy keys., Every portal CLI's search output must carry the Step 2 contract fields., Guards the anchor the field list is derived from. (+5 more)

### Community 46 - "Community 46"
Cohesion: 0.17
Nodes (18): HTTPRedirectHandler, build_curl_argv(), _default_out(), fetch_with_curl(), fetch_with_urllib(), _force_utf8_output(), _inside_repo(), _location() (+10 more)

### Community 47 - "Community 47"
Cohesion: 0.20
Nodes (7): LinterRepoFixture, CompletedProcess, Path, check_skill()/check_command() are the linter's main job and were     previously, run_linter(), SettingsShapeTests, SkillAndCommandCheckTests

### Community 48 - "Community 48"
Cohesion: 0.18
Nodes (4): FindNonAsciiDateRangesTests, The date-range rule reads the raw layer; `--contains` folds and cannot.      `, find_non_ascii_date_ranges(), Return (line, dash) for every year joined to a non-ASCII dash in raw text.

### Community 49 - "Community 49"
Cohesion: 0.12
Nodes (19): freehire-search skill, linkedin-search skill (LinkedIn public job board), freehire agent/jobs/search endpoint (full descriptions in one request), freehire.me API reference, FREEHIRE_API_URL base-URL override (self-hosting), freehire-cli README, freehire detail command (lookup by slug), freehire facet filters (region, country, city, seniority, category, skill, remote) (+11 more)

### Community 50 - "Community 50"
Cohesion: 0.11
Nodes (8): RankCommandSpec, Pins the base field in the seen_jobs.json structure block and the         never, `location` meant two incompatible things in seen_jobs.json: a place         (sc, SKILL.md's "do not drop any of these fields" instruction cannot         protect, 04-job-evaluation.md is the authoritative file /rank tells its agents         t, Rule 6's expiry sweep mutates status automatically from stored         deadline, The sweep must write its result, or it reproduces the very bug it fixes., #534: `rank_state.py` owns the set of statuses a scoring agent may         retu

### Community 51 - "Community 51"
Cohesion: 0.15
Nodes (12): appear_in_order(), frontmatter(), h2_headings(), Guards for /reset's two scopes: documents and profile.  Both scopes have the s, (instruction sentence, fenced markdown) /reset uses to rewrite `filename` in Ste, The fenced markdown /reset writes over `filename` in Step 3., The leading `---` block of a skill file, or '' when it has none., Whether every needle occurs in haystack, in the same relative order. (+4 more)

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (4): The Python tools must write UTF-8 whatever the host's default encoding is.  On, Run a tool the way a Western-locale Windows host pipes it., run_legacy_stdout(), ToolsWriteUtf8

### Community 53 - "Community 53"
Cohesion: 0.20
Nodes (18): commit_cell(), files_touched(), _force_utf8_output(), git(), in_removed_dir(), load_wontport(), main(), patch_id() (+10 more)

### Community 54 - "Community 54"
Cohesion: 0.11
Nodes (17): bin, freehire-search, dependencies, description, devDependencies, @types/bun, typescript, @types/bun (+9 more)

### Community 55 - "Community 55"
Cohesion: 0.11
Nodes (17): bin, linkedin-search, dependencies, description, devDependencies, @types/bun, typescript, @types/bun (+9 more)

### Community 56 - "Community 56"
Cohesion: 0.21
Nodes (18): /gmail-sync command, gmail_sync/state.json (processed message IDs), /html-report command (offline dashboard), /notion-sync command, job_scraper/notion_sync.json (Notion sync state), /outcome command (record application result), documents/applications/<company>_<role>/ archive, Archived version is the submitted version (never overwritten) (+10 more)

### Community 57 - "Community 57"
Cohesion: 0.22
Nodes (5): Exception, VerifyPdfTests, Raised when a generated PDF does not satisfy its checks., VerificationError, verify_pdf()

### Community 58 - "Community 58"
Cohesion: 0.18
Nodes (15): collect_validation_issues(), fail_data_error(), _force_utf8_output(), load_data(), main(), print_validation_report(), Validate the salary data shape before lookups use it.      Preserves historica, Load and JSON-parse salary_data.json; exit with a helpful message if missing/inv (+7 more)

### Community 59 - "Community 59"
Cohesion: 0.18
Nodes (5): format_entry(), Format a single company entry for display., ConverterCLI, Exercise the documented Excel -> converter CLI -> salary JSON path., FormatEntryTests

### Community 60 - "Community 60"
Cohesion: 0.16
Nodes (6): CheckerRepoFixture, FrameworkVersionGateTests, Guards for tools/check_framework_version.py - the CI gate itself.  This gate i, run_git() must decode `git diff` output as UTF-8 explicitly, not via     whatev, RunGitEncodingTests, WindowsGitPathTests

### Community 61 - "Community 61"
Cohesion: 0.18
Nodes (11): anglicize(), extract_core_words(), match_score_optimized(), normalize(), Normalize string for robust fuzzy matching., Fold Nordic spellings first, then accents for ASCII-typed queries., Extract meaningful words from a company name, ignoring noise., Compute a match score between 0 and 100 using precalculated query values. (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.12
Nodes (7): Regression guard: language_gate/language_note were computed in Step 2 and used, Persisting alone does not re-fire the marker: Step 3 must read the stored, Split a command spec into {heading: body} by '##' headers.      Splitting this, The sweep's behaviour on the majority case, and its reversibility.          Mo, Rule 6 mutates exactly the entries Step 4 says are skipped.          Step 4's, Scoring agents read untrusted postings, so they run as the shipped         leas, _sections()

### Community 63 - "Community 63"
Cohesion: 0.19
Nodes (6): GitignoreGuardTests, GitignoreNegationTests, GitignoreWhitespaceTests, GuardRepoFixture, Builds a minimal repo tree the guards pass on, then breaks one thing per test., GHSA-rv99-7xf2-8f4p: git keeps leading whitespace in a pattern and drops     on

### Community 64 - "Community 64"
Cohesion: 0.18
Nodes (6): Guards for the /upskill skill spec.  The skill is a markdown spec (the spec IS, /outcome creates tracker rows for applications made outside the         workflo, Split a skill spec into {heading: body} by '##' headers.      Splitting this w, /upskill reads the tracker, so its enumeration of the columns must         matc, _sections(), UpskillSkillSpec

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (8): A broken extractor must not masquerade as a broken document.      Git for Wind, When the first pdftotext candidate lacks -bbox (e.g. Git for Windows's xpdf), When no candidate on PATH supports -bbox, the check skips with today's message (, Duplicate entries or multiple PATH directories resolving to the same binary, Resolved binary is cached at module level so repeated parse_pdf calls         a, Poppler 26.0x before 26.05 aborts -bbox on an empty Info-dict string, e.g., TestExtractorFailure, parse_pdf()

### Community 66 - "Community 66"
Cohesion: 0.16
Nodes (9): argv, commands, invoked, Occupation, OccupationAlias, occupations, search, suggestions (+1 more)

### Community 67 - "Community 67"
Cohesion: 0.12
Nodes (6): ArchiveWiring, InterviewWiring, OtherFrontDoors, Where the posting integrity gate (tools/posting_guard.py) is wired beyond /apply, The skill's own Step 1, /outcome's fresh-fetch archive and /interview's     fet, TrustBoundaryWiring

### Community 68 - "Community 68"
Cohesion: 0.12
Nodes (8): Offline tests for tools/robots_check.py.  No network: every case exercises the, The doc calls this by path; make sure that entry point stays valid., Rule patterns are percent-decoded to match the decoded request path.      FAIL, A URL can never be read by curl as an option.      gate() rebuilds the target, The robots target is rebuilt from scheme+host, never the raw input., TestArgumentHardening, TestCli, TestPercentEncodedRules

### Community 69 - "Community 69"
Cohesion: 0.21
Nodes (3): Category-shape and duplicate-name checks (reuses assert_invalid_data)., ValidateDataShapeTests, ValidateDataTests

### Community 70 - "Community 70"
Cohesion: 0.17
Nodes (8): Guards for the /setup command spec.  The command is a markdown spec (the spec, Split a command spec into {heading: body} by '## ' headers., Split a step body into {'### N. ...' heading: body}., Step A7 named 02-behavioral-profile.md sections that do not exist.      "Stron, _sections(), SetupPathAWritesIntoSectionsTheShippedFilesHave, SetupStep3ContactBlocks, _substeps()

### Community 71 - "Community 71"
Cohesion: 0.24
Nodes (8): apiFetch(), apiPost(), htmlFetch(), isHiddenTag(), stripHtml(), visibleHtml(), VOID_TAGS, wrappers

### Community 72 - "Community 72"
Cohesion: 0.17
Nodes (7): A 200 whose body is not a robots.txt used to grant permission.      Found by a, 09-web-research.md's Barclays-class recovery: the policy file itself         re, The fallback must not fail open: a policy readable only as a browser         st, RFC 9309: an empty file permits everything. Do not over-correct., TestSoftTwoHundred, is_robots_body(), Does this actually look like a robots.txt?      A misconfigured host can answe

### Community 73 - "Community 73"
Cohesion: 0.23
Nodes (7): A User-agent, Allow or Disallow line holding U+FFFD is unreadable.      FAIL-O, `text` saved in cp1254, then read as UTF-8 with bad bytes replaced., A trailing 0xA0 is a no-break space in cp1254, which strip() removes,         b, A 0xA0 indent garbled the field name, so the Disallow went unseen., User-agent, Allow and Disallow alike, and a first line behind a BOM:         _g, Real UTF-8 never decodes to U+FFFD. The first rule is tr.indeed.com's., TestUndecodableRules

### Community 74 - "Community 74"
Cohesion: 0.28
Nodes (7): _completed(), _no_github_env(), Unit tests for the shared fork-detection helper (issue #496).  The placeholder, Clear GITHUB_REPOSITORY so the origin-remote branch is exercised., UpstreamCheckoutTests, is_upstream_checkout(), Whether this checkout is the upstream template rather than a fork.      ``GITH

### Community 75 - "Community 75"
Cohesion: 0.18
Nodes (8): line(), A page that OPENS with bullets must not mistake their indent for its margin., SILENT FAILURE: \\enlargethispage pushing body text over the footer., SILENT FAILURE: a heading stranded at the bottom, content overleaf., SILENT FAILURE: the \\cventry title on one page, its bullets on the next., moderncv gives the itemize marker its own bbox line: different defect, different, TestFooterBand, TestOrphans

### Community 76 - "Community 76"
Cohesion: 0.15
Nodes (11): Exit 1 means "your document is broken"; a dead extractor must never claim that., find_pdftotext(), _force_utf8_output(), main(), printed_text_x(), Path, Largest top-to-top distance between body lines, and where it starts., Find a pdftotext binary that supports Poppler's -bbox flag.      Git for Windo (+3 more)

### Community 77 - "Community 77"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, module, moduleResolution, noEmit, skipLibCheck, strict, target (+5 more)

### Community 78 - "Community 78"
Cohesion: 0.14
Nodes (4): detail, ExitCalled, HIDDEN_MARKUP, TAGGED

### Community 79 - "Community 79"
Cohesion: 0.14
Nodes (13): compilerOptions, allowImportingTsExtensions, module, moduleResolution, noEmit, skipLibCheck, strict, target (+5 more)

### Community 80 - "Community 80"
Cohesion: 0.15
Nodes (4): RankStateToolSpec, Guards for routing Step 1/3/4 through tools/rank_state.py (#395).      /rank's, The field names Step 2's scoring-agent JSON contract declares.          Extrac, The condition on this change: Step 4's write-back semantics must         surviv

### Community 82 - "Community 82"
Cohesion: 0.19
Nodes (3): AskDenyRuleTests, PermissionGuardTests, settings.json ships deny rules (block in every mode, bypass included) and     a

### Community 83 - "Community 83"
Cohesion: 0.20
Nodes (7): FreeFormNotesWritersStateTheRule, NotesShapeUnderTheShippedReader, Guards for the rule that keeps free-form `notes` from breaking a tracker row., The body of one markdown section, up to the next heading of any depth., Format: (path, heading, line_anchor, rule, why), Why the rule exists, demonstrated with the reader the repo ships., section()

### Community 84 - "Community 84"
Cohesion: 0.18
Nodes (8): DumpTargetTests, `.claude/settings.json` pre-approves verify_pdf.py with any arguments, so     `, build_parser(), check_dump_target(), _force_utf8_output(), main(), Write UTF-8 whatever the host's default encoding is.      A piped stdout on Wi, Return why `--dump-text` may not write to `path`, or None if it may.

### Community 85 - "Community 85"
Cohesion: 0.21
Nodes (11): documents/applications archive, tools/install_portal_clis.py, outcome.md per application, SECURITY.md permission-level grants table, Personal-data ignore rules (.gitignore), Rationale: framework is explicitly not a sandbox, Rationale: instruction-level plus permission-level defenses, tools/security_guards.py CI guards (+3 more)

### Community 86 - "Community 86"
Cohesion: 0.17
Nodes (6): Guards for /scrape's result-provenance recording.  The scraper is a markdown s, Split the skill spec into {heading: body} by '###' step headers.      Splittin, Step 1b.3 says to scope to the last 14 days via the portal's recency     flag -, ScrapeProvenanceSpec, _steps(), TestRecencyFallback

### Community 87 - "Community 87"
Cohesion: 0.21
Nodes (7): Offline tests for tools/verify_layout.py.  Every case is built from synthetic, parse_pdf's text_left, from (xMin, yMin, yMax, text) words sorted left to right., Every tool's source must compile clean.      `verify_layout.py`'s docstring do, TestTextStart, ToolsCompileWithoutWarnings, xMin of the first word after leading LIST_MARKERS words, if there were any., text_start()

### Community 88 - "Community 88"
Cohesion: 0.18
Nodes (5): personalize_cv(), Guards for CI's placeholder-integrity sentinels.  The job exists to catch pers, Apply /setup Step 3.8's documented edit: replace placeholder personal     data, TestCvSentinelsAreDataLocated, TestProfileSentinelIsDataLocated

### Community 89 - "Community 89"
Cohesion: 0.21
Nodes (9): _bare_number(), _extract_pdftotext(), _extract_pypdf(), extract_text_layer(), _quantity_range(), The token with outer punctuation stripped, if it is a bare number, else None., True when both sides of the dash are bare numbers and not a date pair.      A, Return (text, pages) or None if pypdf is unavailable, raises, or yields no text. (+1 more)

### Community 90 - "Community 90"
Cohesion: 0.20
Nodes (11): _fetch(), _force_utf8_output(), gate(), _groups(), has_undecodable_rule(), _match(), user-agent -> [(is_allow, pattern)], tolerating blank lines inside a record., RFC 9309 wildcard match; returns match length or -1.      The pattern is perce (+3 more)

### Community 91 - "Community 91"
Cohesion: 0.31
Nodes (10): /add-portal command, /reset command (destructive profile/document reset), /setup command (profile onboarding), Portal credentials only from <SERVICE>_API_TOKEN env var, GitHub FUNDING.yml, Interview Preparation Guide (07), job-scraper skill (/scrape, search-queries.md), Personal-use-only warning for restricted portals (+2 more)

### Community 94 - "Community 94"
Cohesion: 0.18
Nodes (4): CleanTreeTests, GHSA-rv99-7xf2-8f4p: a .gitignore in a subdirectory takes precedence     over t, RealRepoTests, SubdirectoryGitignoreTests

### Community 96 - "Community 96"
Cohesion: 0.29
Nodes (4): NormalizeTextTests, `--contains` must see through what LaTeX does to plain source text.      Measu, normalize_text(), Fold a string for comparison: NFC, typographic punctuation, whitespace.      N

### Community 97 - "Community 97"
Cohesion: 0.27
Nodes (4): normalizeSlug(), CLI_PATH, CLIResult, runCLI()

### Community 98 - "Community 98"
Cohesion: 0.27
Nodes (4): normalizeJobId(), CLI_PATH, CLIResult, runCLI()

### Community 100 - "Community 100"
Cohesion: 0.29
Nodes (5): Guards for the onboarding privacy warnings (issue #345).  The README's quick s, Body of a markdown section up to the next heading of the same level., section(), TestForkWarningsAtTheDecisionPoint, TestSetupChecksOriginBeforeWriting

### Community 102 - "Community 102"
Cohesion: 0.27
Nodes (6): The slice of text from the start marker up to the end marker., Skill files /setup Step 3 populates, derived from its own headings.      Step, A file /setup personalizes must never be listed as framework-only.          Th, section(), setup_step3_skill_files(), TestResetCoversEveryPersonalizedSkillFile

### Community 105 - "Community 105"
Cohesion: 0.25
Nodes (4): autocomplete, AutocompleteGroup, AutocompleteItem, filterAutocompleteGroups()

### Community 110 - "Community 110"
Cohesion: 0.33
Nodes (4): ParsePageCountTests, RunToolTests, parse_page_count(), run_tool()

### Community 111 - "Community 111"
Cohesion: 0.36
Nodes (5): indent(), key_indent(), Pin the workflow settings zizmor checks, without needing zizmor or PyYAML.  -, Column of a step's keys: two past the dash on a `- key:` line., WorkflowHardeningTests

### Community 112 - "Community 112"
Cohesion: 0.32
Nodes (3): CLI_PATH, CLIResult, runCLI()

### Community 114 - "Community 114"
Cohesion: 0.25
Nodes (5): FrozenChangelogTests, CHANGELOG.md is frozen at 1.7.4; releases after it are documented in GitHub Rele, _is_upstream_url(), Shared fork-detection for tests that only apply to the upstream template.  Sev, Whether a git remote URL points at the upstream template repo.      Matches th

### Community 115 - "Community 115"
Cohesion: 0.29
Nodes (4): command_lines(), Guard: the workflow specs settle on `python3`, with one Windows note each.  Th, Yield (lineno, line) for every line-leading interpreter invocation., SpecPythonSpellingTest

### Community 116 - "Community 116"
Cohesion: 0.25
Nodes (3): RankBatchLimitSpec, Guards for the /rank command spec.  The command is a markdown spec (the spec I, The expensive fetch-and-score batch is bounded independently of output.

### Community 117 - "Community 117"
Cohesion: 0.32
Nodes (5): curl's output is decoded as UTF-8, never the locale's code page.      With tex, gate(url) with curl swapped for a process that prints `body` and the         st, The rule is verbatim from tr.indeed.com/robots.txt: 職 is e8 81 b7.         DISA, kap.org.tr answers /robots.txt with a UTF-8 HTML 404 that names         "Merkez, TestNonAsciiCurlOutput

### Community 118 - "Community 118"
Cohesion: 0.32
Nodes (3): Every spec that reads third-party content carries the trust-boundary rule.  `/, specs(), TrustBoundaryTests

### Community 119 - "Community 119"
Cohesion: 0.57
Nodes (7): get_base_commit(), has_non_trivial_changes(), main(), parse_frontmatter(), parse_frontmatter_text(), Path, run_git()

### Community 120 - "Community 120"
Cohesion: 0.46
Nodes (7): _force_utf8_output(), get_framework_version_from_text(), get_remote_url(), main(), parse_semver(), Use UTF-8 for piped output even on legacy-console hosts., run_git()

### Community 121 - "Community 121"
Cohesion: 0.29
Nodes (7): deadline field, Upskill gap heatmap, No-backfill rule for missing state fields, posted_date field, Rationale: persist posted_date because stale postings were ranked high, gaps field in seen_jobs.json (from /rank), source field (cli or websearch)

### Community 122 - "Community 122"
Cohesion: 0.43
Nodes (7): Fetch escalation order (portal CLI, WebFetch, fetch_page, search, unavailable), tools/fetch_page.py, Rationale: a WebFetch 403 means the client was refused, not the page missing, Prefer the employer's own posting over aggregator listings, tools/robots_check.py, robots.txt gate before browser-header retry, Web Research and Fetching guide (09)

### Community 123 - "Community 123"
Cohesion: 0.33
Nodes (5): find_bash(), Find a usable Bash for tests that replay the documented reset commands., Replay /reset's actual Bash commands against isolated document files., Probe only the filesystem capability needed by the scope controls., symlinks_available()

### Community 132 - "Community 132"
Cohesion: 0.62
Nodes (6): check_command(), check_settings(), check_skill(), main(), Path, rel()

### Community 133 - "Community 133"
Cohesion: 0.33
Nodes (4): dir, missingValueCases, preload, valuedCases

### Community 134 - "Community 134"
Cohesion: 0.33
Nodes (4): dir, missingValueCases, preload, valuedCases

### Community 135 - "Community 135"
Cohesion: 0.33
Nodes (4): dir, missingValueCases, preload, valuedCases

### Community 136 - "Community 136"
Cohesion: 0.33
Nodes (4): dir, missingValueCases, preload, valuedCases

### Community 140 - "Community 140"
Cohesion: 0.33
Nodes (3): Names of documents/ subfolders tracked in git (ignores local noise)., TestResetCoversEveryDocumentsSubfolder, tracked_document_subfolders()

### Community 141 - "Community 141"
Cohesion: 0.33
Nodes (3): One leading UTF-8 byte-order mark is skipped before parsing.      FAIL-OPEN RE, A lone directive behind a BOM read as a soft 200 (fail-closed, but         wron, TestByteOrderMark

### Community 145 - "Community 145"
Cohesion: 0.47
Nodes (3): NullShapeEndToEndTests, The disagreement in full: --validate blesses a file with a null     metadata/ca, Run main() against `payload` with the given argv. Returns         (exit_code_or

### Community 149 - "Community 149"
Cohesion: 0.33
Nodes (3): GitignorePatternBehaviorTests, Path, Pin the match semantics of the shipped .gitignore, not just rule presence.

### Community 161 - "Community 161"
Cohesion: 0.67
Nodes (3): jobindex-cli README, Jobindex native vs external ATS passthrough detail pages, Jobindex Stash JSON search parsing (searchResponse.results)

## Ambiguous Edges - Review These
- `Jobindex URL reference (jobsoegning path segments and area slugs)` → `Rationale: no area filter, city names go in the query`  [AMBIGUOUS]
  ai-job-search/.agents/skills/jobindex-search/url-reference.md · relation: conceptually_related_to
- `/rank command (triage scraped jobs)` → `Stale sweep branch (batch no_response, 60-day default)`  [AMBIGUOUS]
  ai-job-search/.claude/commands/outcome.md · relation: conceptually_related_to
- `tools/posting_guard.py` → `tools/rank_state.py`  [AMBIGUOUS]
  ai-job-search/.claude/commands/rank.md · relation: conceptually_related_to

## Knowledge Gaps
- **327 isolated node(s):** `name`, `version`, `description`, `type`, `main` (+322 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Jobindex URL reference (jobsoegning path segments and area slugs)` and `Rationale: no area filter, city names go in the query`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `/rank command (triage scraped jobs)` and `Stale sweep branch (batch no_response, 60-day default)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `tools/posting_guard.py` and `tools/rank_state.py`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Page` connect `Community 35` to `Community 65`, `Community 75`, `Community 76`, `Fetch Page and Robots`, `Community 87`, `Community 23`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `decode_page()` connect `Posting Guard and Page Decode` to `Community 46`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Page` (e.g. with `TestExtractorFailure` and `TestFooterBand`) actually correct?**
  _`Page` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _327 weakly-connected nodes found - possible documentation gaps or missing edges._