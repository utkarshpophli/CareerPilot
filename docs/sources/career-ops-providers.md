# career-ops providers: where each one stands

career-ops ships 126 provider modules (`upstream/career-ops/providers/*.mjs`, helper files that start with `_` not counted). M4c ports, drops or defers every one, each with a verdict file in this folder before it ships. This table is checked by a test (`src/lib/job-search/providers-ledger.test.ts`): a provider missing here, listed twice, or listed without being in the upstream folder fails it, so the total cannot drift.

Status words: **ported** (a verdict file exists and the adapter ships), **verdict written** (allowed, adapter in progress), **dropped** (with the reason), **deferred** (read, but not enough to decide; with the reason), **queued** (not looked at yet: no verdict, nothing in the product calls it).

| Provider | Batch | Status | Verdict |
|---|---|---|---|
| 4dayweek | not sorted yet | queued: verdict file first | - |
| a16z-speedrun-talent | not sorted yet | queued: verdict file first | - |
| adp-workforcenow | not sorted yet | queued: verdict file first | - |
| agentic-jobs | not sorted yet | queued: verdict file first | - |
| alibaba | deferred | deferred: no robots.txt, no terms found | [alibaba.md](alibaba.md) |
| amazon | deferred | deferred: its terms are amazon.com's Conditions of Use, not yet read | [amazon.md](amazon.md) |
| apple | dropped | dropped: its website terms forbid page-scraping and robots | [apple.md](apple.md) |
| applitrack | not sorted yet | queued: verdict file first | - |
| arbeitnow | not sorted yet | queued: verdict file first | - |
| arbeitsagentur | done | ported earlier (owner accepts a note first) | n/a |
| ashby | done | ported (allowed with limits) | docs/sources/ashby.md |
| atlassian | done | ported (allowed with limits) | [atlassian.md](atlassian.md) |
| avature | not sorted yet | queued: verdict file first | - |
| bamboohr | deferred | deferred: no real tenant sampled and its terms not read | [bamboohr.md](bamboohr.md) |
| beesite | not sorted yet | queued: verdict file first | - |
| breezy | not sorted yet | queued: verdict file first | - |
| builtin | not sorted yet | queued: verdict file first | - |
| bulldogjob | not sorted yet | queued: verdict file first | - |
| bwi | not sorted yet | queued: verdict file first | - |
| careerviet | not sorted yet | queued: verdict file first | - |
| clearcompany | not sorted yet | queued: verdict file first | - |
| collage | not sorted yet | queued: verdict file first | - |
| comeet | not sorted yet | queued: verdict file first | - |
| computrabajo | not sorted yet | queued: verdict file first | - |
| consider | not sorted yet | queued: verdict file first | - |
| cryptocurrencyjobs | not sorted yet | queued: verdict file first | - |
| csod | not sorted yet | queued: verdict file first | - |
| dassault | deferred | deferred: only the Fondation site's terms found, which forbid robots | [dassault.md](dassault.md) |
| deel | not sorted yet | queued: verdict file first | - |
| deutschebahn | not sorted yet | queued: verdict file first | - |
| dover | not sorted yet | queued: verdict file first | - |
| echojobs | not sorted yet | queued: verdict file first | - |
| eightfold | not sorted yet | queued: verdict file first | - |
| eploy | not sorted yet | queued: verdict file first | - |
| feishu-jobs | not sorted yet | queued: verdict file first | - |
| flowxtra | not sorted yet | queued: verdict file first | - |
| garena | not sorted yet | queued: verdict file first | - |
| gem | not sorted yet | queued: verdict file first | - |
| generalist-world | not sorted yet | queued: verdict file first | - |
| getonbrd | not sorted yet | queued: verdict file first | - |
| getro | not sorted yet | queued: verdict file first | - |
| glints | not sorted yet | queued: verdict file first | - |
| google | 2 company pages | verdict written (allowed with limits, conditional on robots.txt); adapter with the HTML-scraped sources | [google.md](google.md) |
| greenhouse | done | ported | docs/sources/greenhouse.md |
| gupy | not sorted yet | queued: verdict file first | - |
| hackernews | not sorted yet | queued: verdict file first | - |
| hecklerkoch | not sorted yet | queued: verdict file first | - |
| higheredjobs | not sorted yet | queued: verdict file first | - |
| himalayas | not sorted yet | queued: verdict file first | - |
| hiringroom | not sorted yet | queued: verdict file first | - |
| homerun | not sorted yet | queued: verdict file first | - |
| ibm | deferred | deferred: its terms allow crawlers only where robots.txt does, and the API host has none | [ibm.md](ibm.md) |
| icims | not sorted yet | queued: verdict file first | - |
| inrecruiting | not sorted yet | queued: verdict file first | - |
| itviec | not sorted yet | queued: verdict file first | - |
| jazzhr | not sorted yet | queued: verdict file first | - |
| jibeapply | not sorted yet | queued: verdict file first | - |
| jobbankca | not sorted yet | queued: verdict file first | - |
| jobicy | not sorted yet | queued: verdict file first | - |
| jobscz | not sorted yet | queued: verdict file first | - |
| jobspresso | not sorted yet | queued: verdict file first | - |
| jobstreet | not sorted yet | queued: verdict file first | - |
| jobvite | not sorted yet | queued: verdict file first | - |
| join | not sorted yet | queued: verdict file first | - |
| joinup | not sorted yet | queued: verdict file first | - |
| justjoin | not sorted yet | queued: verdict file first | - |
| kalibrr | not sorted yet | queued: verdict file first | - |
| landingjobs | not sorted yet | queued: verdict file first | - |
| larajobs | not sorted yet | queued: verdict file first | - |
| lever | done | ported | docs/sources/lever.md |
| local-parser | dropped | dropped: runs a program named in a config file; no place in a self-hosted app that assistants can configure | [local-parser.md](local-parser.md) |
| magneto | not sorted yet | queued: verdict file first | - |
| manfred | not sorted yet | queued: verdict file first | - |
| meituan | not sorted yet | queued: verdict file first | - |
| mokahr | not sorted yet | queued: verdict file first | - |
| mycareersfuture | not sorted yet | queued: verdict file first | - |
| neogov | not sorted yet | queued: verdict file first | - |
| nodesk | not sorted yet | queued: verdict file first | - |
| nofluffjobs | not sorted yet | queued: verdict file first | - |
| notion | not sorted yet | queued: verdict file first | - |
| occ | not sorted yet | queued: verdict file first | - |
| oraclecloud | not sorted yet | queued: verdict file first | - |
| pageup | not sorted yet | queued: verdict file first | - |
| paylocity | not sorted yet | queued: verdict file first | - |
| peoplesoft | not sorted yet | queued: verdict file first | - |
| personio | deferred | deferred: its terms could not be read (security checkpoint) | [personio.md](personio.md) |
| phenom | not sorted yet | queued: verdict file first | - |
| pinpoint | not sorted yet | queued: verdict file first | - |
| platsbanken | not sorted yet | queued: verdict file first | - |
| pracecz | not sorted yet | queued: verdict file first | - |
| prevueaps | not sorted yet | queued: verdict file first | - |
| pythonorg | not sorted yet | queued: verdict file first | - |
| radancy | not sorted yet | queued: verdict file first | - |
| recruitee | done | ported (allowed with limits) | [recruitee.md](recruitee.md) |
| redrover | not sorted yet | queued: verdict file first | - |
| remoteok | not sorted yet | queued: verdict file first | - |
| remotive | not sorted yet | queued: verdict file first | - |
| remotli | not sorted yet | queued: verdict file first | - |
| rheinmetall | not sorted yet | queued: verdict file first | - |
| rippling | not sorted yet | queued: verdict file first | - |
| schoolspring | not sorted yet | queued: verdict file first | - |
| senjob | not sorted yet | queued: verdict file first | - |
| smartrecruiters | dropped | dropped: its API host disallows every automated reader but LinkedIn in robots.txt | [smartrecruiters.md](smartrecruiters.md) |
| softgarden | not sorted yet | queued: verdict file first | - |
| solidjobs | not sorted yet | queued: verdict file first | - |
| startup-jobs | not sorted yet | queued: verdict file first | - |
| successfactors | not sorted yet | queued: verdict file first | - |
| taleo | not sorted yet | queued: verdict file first | - |
| teamtailor | done | ported (allowed with limits) | [teamtailor.md](teamtailor.md) |
| techinasia | not sorted yet | queued: verdict file first | - |
| telegram-channel | not sorted yet | queued: verdict file first | - |
| tencent | not sorted yet | queued: verdict file first | - |
| thehub | not sorted yet | queued: verdict file first | - |
| themuse | not sorted yet | queued: verdict file first | - |
| tkms | not sorted yet | queued: verdict file first | - |
| torre | not sorted yet | queued: verdict file first | - |
| ultipro | not sorted yet | queued: verdict file first | - |
| vdab | not sorted yet | queued: verdict file first | - |
| weworkremotely | not sorted yet | queued: verdict file first | - |
| workable | done | ported (allowed with limits) | [workable.md](workable.md) |
| workday | not sorted yet | queued: verdict file first | - |
| workingnomads | not sorted yet | queued: verdict file first | - |
| wp-job-manager | not sorted yet | queued: verdict file first | - |
| wttj | not sorted yet | queued: verdict file first | - |
| yourator | not sorted yet | queued: verdict file first | - |
| zoho-recruit | not sorted yet | queued: verdict file first | - |

Totals: 126 providers; 8 ported, 1 verdict written, 3 dropped, 6 deferred, 108 queued.
