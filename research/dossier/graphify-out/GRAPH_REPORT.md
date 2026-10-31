# Graph Report - C:\Projects\project_rho\dossier  (2026-11-01)

## Corpus Check
- Large corpus: 778 files · ~496,544 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 4074 nodes · 12516 edges · 186 communities (155 shown, 31 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 165 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Job Search Providers
- Profile and Prisma Data
- MCP OAuth Connector
- UI Primitives
- Applications List and Board
- Agent Runner and Scheduler
- Settings and AI Config
- Update Check and Layout
- Application Status Control
- Google Inbox and Conversation
- Form Inputs
- Calendar Dashboard
- AI Writing Tasks
- Job Search Tests
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
- Community 153
- Community 154
- Community 155
- Community 156
- Community 157
- Community 158
- Community 159
- Community 160
- Community 161
- Community 162
- Community 163
- Community 164
- Community 165
- Community 166
- Community 167
- Community 168
- Community 169
- Community 170
- Community 171
- Community 172
- Community 173
- Community 174
- Community 177
- Community 178
- Community 179
- Community 180
- Community 181
- Community 183

## God Nodes (most connected - your core abstractions)
1. `cn()` - 136 edges
2. `loadSettings()` - 113 edges
3. `toast` - 94 edges
4. `toastResult()` - 65 edges
5. `prisma` - 62 edges
6. `createTestClient()` - 57 edges
7. `resetDatabase()` - 57 edges
8. `buttonClassName()` - 53 edges
9. `saveSettings()` - 48 edges
10. `useTrackSave()` - 46 edges

## Surprising Connections (you probably didn't know these)
- `expectAccessible()` --references--> `page`  [EXTRACTED]
  e2e/connector.spec.ts → src/lib/agent/run.db.test.ts
- `ApplicationView()` --indirect_call--> `job()`  [INFERRED]
  src/app/(app)/applications/[id]/application-view.tsx → e2e/fake-jobs.mts
- `PostingResults()` --indirect_call--> `job()`  [INFERRED]
  src/app/(app)/jobs/posting-results.tsx → e2e/fake-jobs.mts
- `useJob()` --indirect_call--> `job()`  [INFERRED]
  src/hooks/use-job.ts → e2e/fake-jobs.mts
- `buildExport()` --indirect_call--> `startups()`  [INFERRED]
  src/lib/data-export.ts → e2e/fake-jobs.mts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Session guard on every mutation and route** — dossier_development_server_actions, dossier_development_route_handlers, dossier_security_session_checks, dossier_development_sign_in [INFERRED 0.80]
- **Outbound data flows that leave the server** — dossier_privacy_outbound_recipients, dossier_privacy_hosted_ai_receives, dossier_privacy_typesafe_receives, dossier_privacy_mcp_connector, dossier_privacy_startups_robots [INFERRED 0.75]
- **CI and release pipeline** — dossier_github_workflows_ci_checked_skip_job, dossier_github_workflows_ci_check_job, dossier_github_workflows_ci_e2e_job, dossier_github_workflows_ci_image_job, dossier_github_workflows_release_tag_workflow [EXTRACTED 1.00]
- **Fonts bundled under SIL OFL 1.1 in dossier/src/fonts** — dossier_src_fonts_ibm_plex_sans_devanagari_ofl_ibm_plex_sans_devanagari, dossier_src_fonts_ibm_plex_sans_jp_ofl_ibm_plex_sans_jp, dossier_src_fonts_ibm_plex_sans_kr_ofl_ibm_plex_sans_kr, dossier_src_fonts_ibm_plex_sans_ofl_ibm_plex_sans, dossier_src_fonts_inter_ofl_inter, dossier_src_fonts_jetbrains_mono_ofl_jetbrains_mono, dossier_src_fonts_libre_caslon_text_ofl_libre_caslon_text, dossier_src_fonts_lora_ofl_lora, dossier_src_fonts_manrope_ofl_manrope, dossier_src_fonts_newsreader_ofl_newsreader, dossier_src_fonts_noto_sans_sc_ofl_noto_sans_sc, dossier_src_fonts_playfair_display_ofl_playfair_display, dossier_src_fonts_source_serif_4_ofl_source_serif_4, dossier_src_fonts_space_grotesk_ofl_space_grotesk, dossier_src_fonts_work_sans_ofl_work_sans [INFERRED 0.90]
- **Job application lifecycle: find, tailor, track, review** — img_find_jobs, img_application_resume_editor, img_applications_kanban, img_dashboard_funnel, concept_application_status_pipeline [INFERRED 0.70]
- **Profile feeds base resume and new application** — dossier_github_images_profile_screen, base_resume_screen, dossier_github_images_new_application_screen [INFERRED 0.85]
- **Create Next App default public assets** — dossier_public_next_svg, dossier_public_vercel_svg, dossier_public_window_svg [INFERRED 0.70]
- **Dossier brand identity (D mark across icons and social card)** — dossier_src_app_icon_svg, dossier_src_app_apple_icon_png, dossier_site_og_png, dossier_product [INFERRED 0.75]

## Communities (186 total, 31 thin omitted)

### Community 0 - "Job Search Providers"
Cohesion: 0.04
Nodes (90): JobSourceAdapter, RequestContext, SourceCredentials, adzuna, CURRENCIES, maybeNumber, maybeText, postingFromResult() (+82 more)

### Community 1 - "Profile and Prisma Data"
Cohesion: 0.06
Nodes (68): GET, GET, POST, TAILORED, get(), getHeld(), post(), metadata (+60 more)

### Community 2 - "MCP OAuth Connector"
Cohesion: 0.05
Nodes (72): RFC-8414, GET, handle(), handler, POST, accessToken(), answer(), call() (+64 more)

### Community 3 - "UI Primitives"
Cohesion: 0.06
Nodes (61): RFC-6266, chooseUsagePing, SendWithGmail(), props, NoSource(), SearchProblem(), AboutSection(), Check (+53 more)

### Community 4 - "Applications List and Board"
Cohesion: 0.06
Nodes (52): rememberListView, ApplicationsScreen(), ApplicationsScreenProps, FirstApplication(), HINTS, params, props, router (+44 more)

### Community 5 - "Agent Runner and Scheduler"
Cohesion: 0.05
Nodes (48): metadata, StartupsPage(), register(), agentScanJob, db, zone, globalForAgent, resetInterruptedDrafts() (+40 more)

### Community 6 - "Settings and AI Config"
Cohesion: 0.07
Nodes (54): metadata, NewApplicationPage(), AboutFacts, currentKeyState(), loadScoringView(), loadView(), aboutFacts(), filePreview() (+46 more)

### Community 7 - "Update Check and Layout"
Cohesion: 0.06
Nodes (46): GET(), AppLayout(), countAgentQueue(), inboxCount(), saveSettings(), rememberBrowserTimeZone(), parseSidebarCollapsed(), availableUpdate() (+38 more)

### Community 8 - "Application Status Control"
Cohesion: 0.08
Nodes (41): ApplicationMenu(), router, StatusControl(), RowMenu(), demoAction, fakeSave(), Gallery(), NEW_STEPS (+33 more)

### Community 9 - "Google Inbox and Conversation"
Cohesion: 0.08
Nodes (46): ConversationTab(), InboxScreen(), Row(), inbox, Unmatched(), ClientCard(), GoogleClientView, GoogleSection() (+38 more)

### Community 10 - "Form Inputs"
Cohesion: 0.08
Nodes (40): CheckThis(), UnitEditor(), UnitFrame(), UnitFrameProps, MONTHS, MonthYear, MonthYearField(), parseYear() (+32 more)

### Community 11 - "Calendar Dashboard"
Cohesion: 0.09
Nodes (47): agendaDay(), CalendarCard(), plural(), STEPS, items, props, router, WEEKDAYS (+39 more)

### Community 12 - "AI Writing Tasks"
Cohesion: 0.13
Nodes (48): guardSources(), guardUnits(), answerSchema, Classified, ClassifyInput, classifyReply(), emailForPrompt(), SUGGESTED_STATUS (+40 more)

### Community 13 - "Job Search Tests"
Cohesion: 0.06
Nodes (44): FakeRequest, hang(), Route, stubFetch(), credentials, fetchPosting, query, arbeitsagentur (+36 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (38): ai, db, posting, query, dismissFoundPosting, loadFullText, postingRef, removeJobSearch (+30 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (40): AgentPage(), metadata, agentDedupeKey(), candidateData(), db, posting, score, normal() (+32 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (44): RFC-2047, RFC-2231, RFC-5322, googleUrl(), HOSTS, api(), currentHistoryId(), decodeBody() (+36 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (41): approveCandidate(), createDossierServer(), documentText(), failure(), POSTED, postingLine(), postingSource, ResolvedPosting (+33 more)

### Community 18 - "Community 18"
Cohesion: 0.08
Nodes (35): SearchFieldErrors, EducationForm(), PublicationForm(), Linked, SkillsUsed(), AgentSection(), AgentSettings, clock() (+27 more)

### Community 19 - "Community 19"
Cohesion: 0.07
Nodes (24): @prisma/client, @prisma/client, db, telemetry, db, candidate(), db, now (+16 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (39): lookUpStartupAddresses, refreshStartupsNow, removeStartupForGood, saveStartupNotes, setStartupStatus, startupId, Emails(), mailto() (+31 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (37): contactsIn(), CoverLetterDocument(), CoverLetterDocumentProps, publicationHref(), publicationLink(), letterUnits(), saveWrittenApplication(), writtenDetailsSchema (+29 more)

### Community 22 - "Community 22"
Cohesion: 0.08
Nodes (38): Preview(), CitationText(), factSources, MONTHS_AND_DAYS, NOT_NAMES, NUMBER_WORDS, numbersIn(), numberValue() (+30 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (34): GET(), GET, GROUPS, env, accessToken(), disconnectGoogle(), globalForTokens, loadGoogleAccount() (+26 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (35): RFC-5321, Role, addressesOnPage(), lookUpSite(), PEOPLE_PAGES, ROLE_PAGES, SiteLookup, SourceError (+27 more)

### Community 25 - "Community 25"
Cohesion: 0.13
Nodes (35): googleConnection, googleFetch(), calendarInUse(), CalendarSync, eventFor(), proposeSlots(), pullInterviewEvents(), scheduleInterview() (+27 more)

### Community 26 - "Community 26"
Cohesion: 0.11
Nodes (34): addMatchSkill, ai, calendar, db, prisma(), resume, units(), leaveOutUnit (+26 more)

### Community 27 - "Community 27"
Cohesion: 0.09
Nodes (30): createApplication, detailsSchema, fetchPostingText, handOffToClaude, startReadingPosting, startWritingDocuments, DetailsCard(), FIELDS (+22 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (27): signIn, SignInFormState, signInWithForm(), text(), LoginForm(), replace, loginMessages, clientIp() (+19 more)

### Community 29 - "Community 29"
Cohesion: 0.09
Nodes (28): approveAgentDraft, candidateId, candidate(), db, prisma(), query, setup, dismissAgentCandidate (+20 more)

### Community 30 - "Community 30"
Cohesion: 0.08
Nodes (32): MockReply, answerSchema, extractPosting(), isoDate(), localDate(), answerSchema, classify(), Item (+24 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (11): SCREENS, appEnv(), e2eDatabaseUrl(), FakeEvent, FakeGoogleState, fakeJobSearches(), fakeStartupRequests(), lastPrompt() (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (31): acceptArbeitsagenturNote, JobsScreen(), JobsScreenProps, SearchForm(), ViewTabs(), PastSearches(), RemoteOnlyField(), SearchFields() (+23 more)

### Community 33 - "Community 33"
Cohesion: 0.05
Nodes (37): @anthropic-ai/sdk, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities, jose, lucide-react, mammoth, @modelcontextprotocol/server (+29 more)

### Community 34 - "Community 34"
Cohesion: 0.10
Nodes (28): dataDir, db, globalForSchedule, lastNightlyBackup(), nextRun(), pruneBackups(), runNightlyBackup(), startBackupSchedule() (+20 more)

### Community 35 - "Community 35"
Cohesion: 0.13
Nodes (30): rankEmails(), placeOf(), refreshStartups(), refreshStartupsJob, blockHashes(), berlin, db, now (+22 more)

### Community 36 - "Community 36"
Cohesion: 0.11
Nodes (29): ApplicationPage(), generateMetadata(), pullCalendar, InboxPage(), metadata, activityTimeline(), isAiConfigured(), editsSchema (+21 more)

### Community 37 - "Community 37"
Cohesion: 0.10
Nodes (26): applyProfileImport, discardProfileImport, BASICS_LABELS, ProfileImport(), done, profile, router, ImportProfileResult (+18 more)

### Community 38 - "Community 38"
Cohesion: 0.06
Nodes (33): @axe-core/playwright, dotenv, esbuild, eslint, eslint-config-next, jsdom, devDependencies, @axe-core/playwright (+25 more)

### Community 39 - "Community 39"
Cohesion: 0.10
Nodes (19): GET, dataDir, done, get(), db, gate, job, GET (+11 more)

### Community 40 - "Community 40"
Cohesion: 0.12
Nodes (24): seedBuiltIns(), daysBefore(), Db, DemoRefused, hasUserData(), PROTOTYPE_TODAY, relativeDate(), seedDemo() (+16 more)

### Community 41 - "Community 41"
Cohesion: 0.13
Nodes (23): FactsSection(), ProfileEditor(), ProfileOrder, sectionFromParam(), SectionId, SECTIONS, StrengthMeter(), basics (+15 more)

### Community 42 - "Community 42"
Cohesion: 0.15
Nodes (18): RepositoryLink(), CollapsedContext, SidebarFrame(), useExpandSidebar(), useSidebarCollapsed(), initials(), Sidebar(), currentScheme() (+10 more)

### Community 43 - "Community 43"
Cohesion: 0.11
Nodes (28): Contact(), ContactLine(), DocumentPage(), DocumentSection(), themeClasses(), themeStyle(), breakAfterDash(), EntryHead() (+20 more)

### Community 44 - "Community 44"
Cohesion: 0.09
Nodes (29): AFRICA, ALIASES, allCountryNames(), AMBIGUOUS, ASIA, CEE, CITY_NAMES, countriesIn() (+21 more)

### Community 45 - "Community 45"
Cohesion: 0.11
Nodes (23): db, details, extracted, finishedJobs(), match, prisma(), trim, DevDocumentsPage() (+15 more)

### Community 46 - "Community 46"
Cohesion: 0.07
Nodes (29): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 47 - "Community 47"
Cohesion: 0.11
Nodes (20): JobProgress(), TailoringCard(), TONE_OPTIONS, addDocumentLanguage, updateSettings, AiBehaviour(), Behaviour, CREATIVITY_OPTIONS (+12 more)

### Community 48 - "Community 48"
Cohesion: 0.07
Nodes (26): metadata, RootLayout(), ebGaramond, fontVariables, fraunces, geist, greekSans, greekSerif (+18 more)

### Community 49 - "Community 49"
Cohesion: 0.08
Nodes (26): GET, get(), agentCandidate, application, chatMessage, date, document, education (+18 more)

### Community 50 - "Community 50"
Cohesion: 0.17
Nodes (21): baseThemeId(), db, deleteTheme, duplicateTheme, importTheme, saveTheme, setBaseTheme, deleteDescription() (+13 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (24): Choices(), FONT_OPTIONS, options(), group(), ThemeBuilder(), ThemeBuilderProps, ThemeDraft, accentName() (+16 more)

### Community 52 - "Community 52"
Cohesion: 0.15
Nodes (21): ApiKeyChange, apiKeyState, ApiKeyUnreadable, applyApiKeyChange(), decryptApiKey(), encryptApiKey(), useJSearch(), FROM_ENV (+13 more)

### Community 53 - "Community 53"
Cohesion: 0.11
Nodes (18): rememberDashboardPeriod, rememberQuietDays, Dashboard(), plural(), figures, props, router, Welcome() (+10 more)

### Community 54 - "Community 54"
Cohesion: 0.14
Nodes (25): JobsPage(), latestQuery(), metadata, profileSearch(), handsOffToClaude(), ALIASES, CODES, COUNTRIES (+17 more)

### Community 55 - "Community 55"
Cohesion: 0.15
Nodes (21): addConnectorRedirect, db, provider, settings(), disconnectApps, listAiModels, removeConnectorRedirect, saveAiProvider (+13 more)

### Community 56 - "Community 56"
Cohesion: 0.12
Nodes (20): DevJobsPage(), metadata, DevUiPage(), metadata, signOut(), jar, encodeSession(), endSession() (+12 more)

### Community 57 - "Community 57"
Cohesion: 0.11
Nodes (16): AiError, AiErrorKind, CONNECTION_CODES, HttpLike, MESSAGES, networkCode(), toAiError(), keyGuardedFetch() (+8 more)

### Community 58 - "Community 58"
Cohesion: 0.09
Nodes (23): answerSchema, askJev(), AskOptions, ChoiceQuestion, Content, errorFor(), MESSAGES, NoulQuestion (+15 more)

### Community 59 - "Community 59"
Cohesion: 0.09
Nodes (17): dateSpan, educationFields, experienceFields, id, level, month, ORDER_SETTING, projectFields (+9 more)

### Community 60 - "Community 60"
Cohesion: 0.14
Nodes (19): refused(), getJson(), getSitePage(), getText(), fetchHtml, state, testAddress(), cache (+11 more)

### Community 61 - "Community 61"
Cohesion: 0.13
Nodes (23): BLOCK, blocked, decode(), FETCH_MESSAGES, FetchedPage, FetchedPosting, fetchHtml(), guardedLookup() (+15 more)

### Community 62 - "Community 62"
Cohesion: 0.11
Nodes (4): Block(), bodies, ScreenSkeleton(), Variant

### Community 63 - "Community 63"
Cohesion: 0.11
Nodes (19): Attachments, EmailTab(), Block, Bubble(), ChatEntry, ChatTarget, messageBlocks(), RefinePanel() (+11 more)

### Community 64 - "Community 64"
Cohesion: 0.16
Nodes (19): PostingData, PostingTab(), shortLink(), MatchCard(), sectionHref(), MARKS, MatchRows(), Match (+11 more)

### Community 65 - "Community 65"
Cohesion: 0.17
Nodes (17): removePhoto, savePhoto, setPhotoOnResumes, CropDialog(), FRAME, PhotoField(), centredCrop(), clampCrop() (+9 more)

### Community 66 - "Community 66"
Cohesion: 0.12
Nodes (12): ChatAnswer, ChatCall, Effort, ANTHROPIC_FALLBACK_MODELS, AnthropicProvider, effortLevels, promptSchemas, MockProvider (+4 more)

### Community 67 - "Community 67"
Cohesion: 0.16
Nodes (18): readResume(), RESUME, POST, post(), resume, discardProfileImports(), importProfileJob, asText() (+10 more)

### Community 69 - "Community 69"
Cohesion: 0.17
Nodes (19): SkillsCard(), listOf(), same(), tailoringSummary, answerSchema, pageFit(), resumeUnits(), TailorInput (+11 more)

### Community 70 - "Community 70"
Cohesion: 0.17
Nodes (15): decodeSession(), sessionTokenOptions(), contentSecurityPolicy(), createNonce(), cached, deriveKey(), hkdf(), KeyPurpose (+7 more)

### Community 71 - "Community 71"
Cohesion: 0.19
Nodes (14): answerText(), hasReasoning(), JSON_MODES, JsonMode, OpenAICompatibleProvider, promptSchemas, Quirks, refusal() (+6 more)

### Community 72 - "Community 72"
Cohesion: 0.16
Nodes (20): AT, band(), column(), FunnelChart(), layout(), OPEN, OUTCOME_COLORS, outcomeColor() (+12 more)

### Community 73 - "Community 73"
Cohesion: 0.17
Nodes (15): FactList(), FactRow(), latest, notice, research, applicationId, createFact, db (+7 more)

### Community 74 - "Community 74"
Cohesion: 0.14
Nodes (15): addLanguage, removeLanguage, removeSkill, renameSkillGroup, setLanguageLevel, setSkillGroup, GroupHeading(), groupNameProblem() (+7 more)

### Community 75 - "Community 75"
Cohesion: 0.16
Nodes (16): createEducation, createReference, basics, db, removeEducation, removeReference, restoreEducation, restoreReference (+8 more)

### Community 76 - "Community 76"
Cohesion: 0.15
Nodes (16): MISTRAL_FALLBACK_MODELS, MistralModel, mistralModelNames(), MistralProvider, anthropicMessage(), anthropicModel(), ask, Instance (+8 more)

### Community 77 - "Community 77"
Cohesion: 0.18
Nodes (17): baseDomain(), best(), companyDomains(), companyKey(), MailMatch, MatchableApplication, MatchableMail, matchMail() (+9 more)

### Community 78 - "Community 78"
Cohesion: 0.17
Nodes (18): notFound(), renderRequested(), Attachment, PRINTED, replySubject(), sendApplicationEmail(), sender(), sendReply() (+10 more)

### Community 79 - "Community 79"
Cohesion: 0.15
Nodes (9): JobWatcher(), ScoreWatcher(), startDemoJob, demoJob, JobDemo(), finished(), FakeEventSource, useJob() (+1 more)

### Community 80 - "Community 80"
Cohesion: 0.20
Nodes (15): attachNewSkill, createExperience, role(), removeExperience, restoreExperience, saveExperience, setExperienceSkill, sortEntriesByDate (+7 more)

### Community 81 - "Community 81"
Cohesion: 0.14
Nodes (17): metadata, ProfileImportPage(), JSEARCH_HOSTS, agentRunSchema, DATE_FORMATS, isJobRetention(), JOB_RETENTION_OPTIONS, jobRetentionLabel() (+9 more)

### Community 82 - "Community 82"
Cohesion: 0.16
Nodes (16): RFC-5987, listVersions, loadVersion, Version, VersionHistory(), versionLabel(), versionTime(), ViewedVersion (+8 more)

### Community 83 - "Community 83"
Cohesion: 0.14
Nodes (12): column(), expectAccessible(), expectAccessible(), shot(), column(), linger(), roles(), connectFakeGoogle() (+4 more)

### Community 84 - "Community 84"
Cohesion: 0.19
Nodes (15): POST, post(), summary, DossierExport, EXPORT_SCHEMA_VERSIONS, INSTALL_SETTINGS, SECRET_SETTINGS, currentSummary() (+7 more)

### Community 85 - "Community 85"
Cohesion: 0.18
Nodes (13): theme(), DevLanguagesPage(), metadata, profile, today, LANGUAGE_SAMPLES, Sample, sampleProfile() (+5 more)

### Community 86 - "Community 86"
Cohesion: 0.27
Nodes (15): metaLine(), application, worthALook(), dayIn(), daysBetween(), format(), formatCalendarDate(), formatDate() (+7 more)

### Community 87 - "Community 87"
Cohesion: 0.14
Nodes (18): Base resume screen (live A4 preview, Download PDF), Resume theme picker (Editorial in use, Classic, Modern, Minimal, Technical, Ledger), Dossier app shell (sidebar navigation), Rationale: unmatched replies held for manual linking rather than guessed, Inbox 'Choose application... / Link' control, Inbox 'Needs an answer' group (interview invite, salary question), Inbox 'Needs a look' group (replies not matched to an application), Inbox screen (employer email replies triage) (+10 more)

### Community 88 - "Community 88"
Cohesion: 0.18
Nodes (13): saveJobSearchDetails, saveJobSource, saveJobSourceKey, testJobSource, Choice, CHOICES, Connection, ConnectionStatus() (+5 more)

### Community 89 - "Community 89"
Cohesion: 0.18
Nodes (11): ChatMessage, extractJson(), matchingBracket(), TEMPERATURES, validateJson(), withJsonSchema(), OllamaProvider, ask (+3 more)

### Community 90 - "Community 90"
Cohesion: 0.18
Nodes (12): claudeChatUrl(), db, describe(), Handoff, handOffFoundPosting(), handOffPastedPosting(), promptFor(), readPastedPosting() (+4 more)

### Community 91 - "Community 91"
Cohesion: 0.18
Nodes (12): compose.yml (development stack), compose.production.yml (self-host stack), Bug report issue form, Feature request issue form, ci.yml workflow, pages.yml workflow, GitHub Pages publish job for site/, release.yml workflow (+4 more)

### Community 92 - "Community 92"
Cohesion: 0.15
Nodes (17): Rule: a job source receives only the search, never profile data, Rule: try OpenAI-compatible provider before adding a new provider, AI provider layer with servers.ts OpenAI-compatible registry, Job source adapters behind index.ts with 30-minute cache, Scoring via AI model or Jev by TypeSafe, Opt-in usage ping to telemetry endpoint, Data sent to a hosted AI provider per task, Fields never sent in AI prompts (+9 more)

### Community 93 - "Community 93"
Cohesion: 0.22
Nodes (11): LoginPage(), metadata, request, action(), ActionContext, ActionError, publicAction(), run() (+3 more)

### Community 94 - "Community 94"
Cohesion: 0.14
Nodes (16): clamp(), COVERAGE, jevParts, JevPosting, jevQuestions(), JevWeights, KINDS, LANGUAGE (+8 more)

### Community 95 - "Community 95"
Cohesion: 0.15
Nodes (16): IBM Plex Sans Devanagari OFL license, IBM Plex Sans JP OFL license, IBM Plex Sans KR OFL license, IBM Plex Sans OFL license, Inter OFL license, JetBrains Mono OFL license, Libre Caslon Text OFL license, Lora OFL license (+8 more)

### Community 96 - "Community 96"
Cohesion: 0.14
Nodes (9): asGmail(), base64url(), events, FakeEvent, idToken(), Mail, mailbox, port (+1 more)

### Community 97 - "Community 97"
Cohesion: 0.24
Nodes (13): Cancelled, main(), readFirstLine(), readHidden(), readPassword(), compute(), DEFAULTS, derive (+5 more)

### Community 98 - "Community 98"
Cohesion: 0.16
Nodes (12): NO_MESSAGES, NOTHING_SAVING, Rewrite, TAB_OF, Target, ThemeMenu(), byPageLimit(), describe() (+4 more)

### Community 99 - "Community 99"
Cohesion: 0.26
Nodes (12): attachNewProjectSkill, createProject, removeProject, reorderEntries, restoreProject, saveProject, setProjectSkill, ProjectForm() (+4 more)

### Community 100 - "Community 100"
Cohesion: 0.20
Nodes (12): saveBasics, BasicsSection(), FIELDS, FieldSpec, formatHint(), looksLikeEmail(), looksLikeWebAddress(), empty (+4 more)

### Community 101 - "Community 101"
Cohesion: 0.21
Nodes (13): AttentionItem, DashboardApplication, dashboardFigures, DashboardOptions, loadDashboard(), FunnelOutcome, rank(), app() (+5 more)

### Community 102 - "Community 102"
Cohesion: 0.21
Nodes (8): ApplicationHeader(), ApplicationNotFound(), NewApplicationError(), NotFound(), PageBar(), PageHeader(), PageHeaderProps, ScreenMessage()

### Community 103 - "Community 103"
Cohesion: 0.21
Nodes (11): createPublication, removePublication, reorderPublications, restorePublication, savePublication, CitationField(), PublicationsSection(), hidden (+3 more)

### Community 104 - "Community 104"
Cohesion: 0.26
Nodes (12): saveScorer, saveTypesafeKey, testJev, Connection, ConnectionStatus(), ScoringSection(), ai, jev (+4 more)

### Community 105 - "Community 105"
Cohesion: 0.20
Nodes (6): AIProvider, CompletionRequest, JsonCompletionRequest, Flavour, flavours, LocalProvider

### Community 106 - "Community 106"
Cohesion: 0.19
Nodes (11): escape(), FIELDS, matchStartup(), skillPattern(), StartupFit, berlin, now, profile (+3 more)

### Community 107 - "Community 107"
Cohesion: 0.15
Nodes (11): ALGOLIA, firstPage, HN_API, job(), pings, port, secondPage, send() (+3 more)

### Community 108 - "Community 108"
Cohesion: 0.15
Nodes (11): currentTheme(), floats, frames, labelThemeButton(), nav, reducedMotion, reveals, stage (+3 more)

### Community 109 - "Community 109"
Cohesion: 0.23
Nodes (10): metadata, PrintBaseResumePage(), metadata, PrintTailoredDocumentPage(), TailoredLetter(), TailoredResume(), DocumentData, verifyPrintAccess() (+2 more)

### Community 110 - "Community 110"
Cohesion: 0.29
Nodes (9): CalendarSkeleton(), Greeting(), never(), DashboardPage(), metadata, periodFromParam(), waitingByApplication(), dayPeriod (+1 more)

### Community 111 - "Community 111"
Cohesion: 0.19
Nodes (9): Bar(), SketchSection(), mine, ThemePicker(), ThemePickerProps, ThemeThumbnail(), documentFamily(), resolveTheme() (+1 more)

### Community 112 - "Community 112"
Cohesion: 0.22
Nodes (10): buildExport(), client, now, exportSchema, asFile(), client, now, prisma() (+2 more)

### Community 113 - "Community 113"
Cohesion: 0.18
Nodes (9): jevFit(), jevScore(), fitting, live, liveKey(), mean(), pearson(), unfitting (+1 more)

### Community 114 - "Community 114"
Cohesion: 0.24
Nodes (12): AI resume tailoring (Refine with AI panel), Application status pipeline (Draft, Sent, Screening, Interview, Offer, Accepted), Calendar view of interviews and routine events, Job discovery via JSearch postings search, Grounded tailoring rule: nothing invented beyond profile, Dossier (self-hosted job search app), Application detail and AI resume editor screenshot, Applications kanban board screenshot (+4 more)

### Community 115 - "Community 115"
Cohesion: 0.20
Nodes (12): Accepted pull requests are brought into a release and credited there, Rule: author reviews AI-written code and keeps the change minimal, Fake AI, job and Google servers for e2e tests, Production Docker image: standalone Next.js, Chromium for PDFs, Prisma CLI, Vitest unit, Postgres db and Playwright e2e test layers, CI lint, typecheck and coverage test job, CI job that skips re-checking code already checked in its pull request, Rationale: merge commit with identical tree reuses the pull request CI result (+4 more)

### Community 116 - "Community 116"
Cohesion: 0.27
Nodes (6): NavLinks(), PageBarIcon(), currentSection(), isCurrent(), NAV, NavItem

### Community 117 - "Community 117"
Cohesion: 0.24
Nodes (8): AddEntryButton(), DragHandle(), EmptyEntries(), EntryCard(), Reorder, Ordering, Summary, ActionResult

### Community 118 - "Community 118"
Cohesion: 0.21
Nodes (10): ask(), context, db, lastMessage(), letter, prisma(), provider, resume (+2 more)

### Community 119 - "Community 119"
Cohesion: 0.18
Nodes (11): scripts, build, dev, hash-password, lint, start, test, test:coverage (+3 more)

### Community 120 - "Community 120"
Cohesion: 0.24
Nodes (9): JEV_WEIGHTS, jevState(), answersFor(), choice(), noul(), posting, profile, score() (+1 more)

### Community 121 - "Community 121"
Cohesion: 0.22
Nodes (10): Rationale: agent runs kept in settings, not Job rows, so the task-data sweep does not delete them, Background jobs in src/lib/jobs with retention sweep, Rationale: Next.js buffers request bodies up to proxyClientMaxBodySize because proxy runs on every request, Import file size limit 10 MB, Job agent: agent-scan and agent-draft jobs, In-process timers for nightly backups and the agent schedule, What deleting an application and Delete everything remove, Table of stored data and retention periods (+2 more)

### Community 122 - "Community 122"
Cohesion: 0.20
Nodes (10): OFL 1.1 license (EB Garamond), OFL 1.1 license (Fraunces), OFL 1.1 license (Geist), OFL 1.1 license (IBM Plex Mono), OFL 1.1 license (IBM Plex Sans Arabic), Bundled fonts README (20 OFL families), Rationale: Greek face loads before theme font because Geist has a few Greek letters, Noto Sans SC subset to GB 2312 with weight axis 400-600 (+2 more)

### Community 123 - "Community 123"
Cohesion: 0.36
Nodes (7): dropExpired(), globalForHeld, Held, heldPdf(), holdPdf(), pdfDownload(), pdf

### Community 124 - "Community 124"
Cohesion: 0.31
Nodes (6): addNote, deleteNote, restoreNote, updateNote, NotesTab(), ActivityEntry

### Community 125 - "Community 125"
Cohesion: 0.22
Nodes (7): create(), emit(), review(), OPEN_ROUTES, read(), SIGNED_OUT_ACTIONS, sources

### Community 127 - "Community 127"
Cohesion: 0.24
Nodes (8): b64(), db, fakeGoogle(), gmailMessage(), Mail, mailbox, provider, sent

### Community 128 - "Community 128"
Cohesion: 0.22
Nodes (7): answers, last, Message, port, Profile, Request, Unit

### Community 129 - "Community 129"
Cohesion: 0.42
Nodes (5): canPage(), countPages(), DocumentPreview(), never(), pageHeightOf()

### Community 130 - "Community 130"
Cohesion: 0.39
Nodes (6): live, Posting, liveAnthropic(), liveLmStudio(), liveMistral(), savedAiConfig()

### Community 132 - "Community 132"
Cohesion: 0.25
Nodes (8): context, db, input, prisma(), provider, savedSummary(), units, where

### Community 133 - "Community 133"
Cohesion: 0.22
Nodes (6): context, db, letter, provider, where, writeEmailJob

### Community 134 - "Community 134"
Cohesion: 0.29
Nodes (8): MCP connector data flow to Anthropic and other connected apps, Base resume with twelve themes and PDF output, Optional job agent: one daily search, Find jobs via JSearch Adzuna FreeHire, MCP connector for Claude and other MCP apps, New application from a pasted posting, One career profile feeding all documents, Startups: YC and Hacker News hiring posts

### Community 135 - "Community 135"
Cohesion: 0.25
Nodes (7): license, name, packageManager, private, resolutions, mysql2@npm:3.15.3, version

### Community 136 - "Community 136"
Cohesion: 0.36
Nodes (5): ActivityChart(), plural(), SERIES, weeks, WeekActivity

### Community 137 - "Community 137"
Cohesion: 0.29
Nodes (6): dataDir, db, now, prisma(), redirected, snapshot()

### Community 138 - "Community 138"
Cohesion: 0.32
Nodes (6): Unit, EMAIL_LABELS, EMAIL_UNITS, EmailUnitId, emailUnits(), isEmailAddress()

### Community 139 - "Community 139"
Cohesion: 0.29
Nodes (5): dataDir, db, left(), now, prisma()

### Community 140 - "Community 140"
Cohesion: 0.32
Nodes (6): db, prisma(), profile, resume(), units, countPdfPages()

### Community 141 - "Community 141"
Cohesion: 0.33
Nodes (7): Rationale: dollar signs in password hash are expanded by Next.js and Compose, Failed sign-in rate limiting stored in Postgres, argon2id:m=19456,t=2,p=1:salt:hash password string format, Route handlers wrapped in route() helper, Server Actions via action(schema, handler) helper, Sign-in: single password and encrypted JWE session cookie, Every page, Server Action and route handler checks the session

### Community 142 - "Community 142"
Cohesion: 0.29
Nodes (4): context, dataDir, db, steps

### Community 143 - "Community 143"
Cohesion: 0.48
Nodes (5): clean(), Item, items(), postingLines(), shorten()

### Community 144 - "Community 144"
Cohesion: 0.57
Nodes (5): bulletLines(), cleanUnitText(), isBulletUnit(), isPublicationUnit(), unitName()

### Community 145 - "Community 145"
Cohesion: 0.40
Nodes (4): answerUsagePing(), fakePings(), question(), upgradedInstall()

### Community 146 - "Community 146"
Cohesion: 0.53
Nodes (5): setInterviewDate, InterviewDate(), InterviewForm(), localInputValue(), never()

### Community 147 - "Community 147"
Cohesion: 0.33
Nodes (3): db, profile, WrittenApplication

### Community 148 - "Community 148"
Cohesion: 0.33
Nodes (4): context, db, provider, draftReplyJob

### Community 149 - "Community 149"
Cohesion: 0.60
Nodes (5): Dossier job-search app, Dossier Open Graph social card, Dossier Apple touch icon (D mark), Dossier favicon SVG (D mark), Self-hosted, own-your-data positioning

### Community 151 - "Community 151"
Cohesion: 0.50
Nodes (3): groups, metrics, summary

### Community 153 - "Community 153"
Cohesion: 0.67
Nodes (3): Next.js 16 App Router + Prisma 7 + PostgreSQL 18 on Docker Compose and Yarn 4, Dossier: self-hosted single-user job search app, Accepted dependency advisories table

## Ambiguous Edges - Review These
- `Dossier (self-hosted job search app)` → `Demo GIF (first frame is blank white)`  [AMBIGUOUS]
  dossier/.github/images/demo.gif · relation: references

## Knowledge Gaps
- **1074 isolated node(s):** `summary`, `groups`, `metrics`, `start.sh script`, `SCREENS` (+1069 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Dossier (self-hosted job search app)` and `Demo GIF (first frame is blank white)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `cn()` connect `Form Inputs` to `Community 129`, `UI Primitives`, `Applications List and Board`, `Application Status Control`, `Google Inbox and Conversation`, `Calendar Dashboard`, `Community 14`, `Community 18`, `Community 20`, `Community 28`, `Community 32`, `Community 41`, `Community 42`, `Community 43`, `Community 47`, `Community 51`, `Community 53`, `Community 55`, `Community 62`, `Community 63`, `Community 64`, `Community 73`, `Community 88`, `Community 103`, `Community 104`, `Community 111`, `Community 116`, `Community 117`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `loadSettings()` connect `Settings and AI Config` to `Job Search Providers`, `Profile and Prisma Data`, `MCP OAuth Connector`, `Applications List and Board`, `Agent Runner and Scheduler`, `Update Check and Layout`, `Google Inbox and Conversation`, `Community 15`, `Community 16`, `Community 19`, `Community 21`, `Community 23`, `Community 25`, `Community 29`, `Community 34`, `Community 35`, `Community 36`, `Community 45`, `Community 50`, `Community 52`, `Community 55`, `Community 59`, `Community 78`, `Community 81`, `Community 109`, `Community 110`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `toast` connect `UI Primitives` to `Applications List and Board`, `Application Status Control`, `Google Inbox and Conversation`, `Community 14`, `Community 18`, `Community 20`, `Community 26`, `Community 27`, `Community 29`, `Community 32`, `Community 37`, `Community 42`, `Community 47`, `Community 50`, `Community 55`, `Community 63`, `Community 65`, `Community 73`, `Community 74`, `Community 80`, `Community 93`, `Community 98`, `Community 99`, `Community 117`, `Community 124`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `toast` (e.g. with `useAutosave()` and `action()`) actually correct?**
  _`toast` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `toastResult()` (e.g. with `ConnectorSection()` and `archiveApplication()`) actually correct?**
  _`toastResult()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `summary`, `groups`, `metrics` to the rest of the system?**
  _1074 weakly-connected nodes found - possible documentation gaps or missing edges._