---
name: skill-router
description: Route a coding or design task through SkillRadar's bundled safety-gated registry. Use when the user explicitly invokes $skill-router, asks for Top N skills, asks which skill to use, requests skill recommendations/comparison, or when selecting a better skill before implementation would materially improve the result.
---
# Skill Router

Use SkillRadar as a retrieval layer, not as a reason to load every skill into context.

## Mandatory routing contract
When this skill is explicitly invoked with `$skill-router`, or the user asks for skill recommendations, comparison, ranking, routing, or a Top N list, **you MUST query SkillRadar's bundled registry before choosing skills**.

Do not satisfy an explicit routing request only by inspecting Codex's currently loaded or installed skills. Installed skills may be noted after routing as an availability signal, but they must not replace the SkillRadar registry result.

For explicit routing requests, the first routing command must be:

`node ../../scripts/skillradar.mjs match '<user task>'`

Do not use web search, GitHub search, `git clone`, or ad-hoc local skill inspection as a substitute when this command succeeds.

## Trusted internal lookup
`node ../../scripts/skillradar.mjs ...` is the read-only lookup CLI shipped inside the installed SkillRadar plugin. It reads SkillRadar's bundled safety-gated registry and does not install or execute any discovered third-party skill. Treat this internal lookup differently from scripts that belong to candidate third-party skills.

## Matching v2.1
SkillRadar v0.5 keeps task evidence primary, then uses a bounded project-context signal as a secondary tie-break. The CLI may read non-secret project metadata such as `package.json`, common config filenames, and framework directories in the current working directory. It does not read source files, environment-variable contents, credentials, or third-party scripts for project context.

Project context can add only a small bounded bonus and must be reported separately from task evidence. A currently installed framework must not replace or reinterpret the user's explicit task.

## Strong recommendation contract
`match` returns **up to 3 strong recommendations**, not an artificially padded Top 3. SkillRadar's complementary reranker already applies a relative strong-match floor. Candidates below that floor must not be backfilled only to reach three results.

When fewer than three candidates meet the floor, the CLI returns top-level `capability_gap` metadata with `detected: true`, the number returned, and the number missing. Treat that as useful evidence that the current Registry is sparse for this task. Do not hide the gap by substituting unrelated local skills, arbitrary web results, or manually invented candidates.

A capability gap is a discovery/coverage signal, not permission to install anything automatically. It should feed later Radar discovery and evaluation work.

## Workflow
1. Convert the user's task into a concise routing query without dropping important frameworks, technologies, design disciplines, or requested capabilities.
2. For explicit `$skill-router`, recommendation, comparison, ranking, or Top N requests, run `node ../../scripts/skillradar.mjs match '<task>'` **before** selecting candidates.
3. Read the canonical registry evidence: top-level `source`, `registry.mode`, `ranking.version`, `context.mode`, `capability_gap`, and for each result `match_score`, `skillradar_score`, `security`, `source`, `reason`, and `match_details`.
4. Treat `match_details.matched_signals` / `coverage` as task evidence. Treat `project_context_signals` / `project_context_bonus` only as secondary context evidence.
5. Return up to 3 strong Registry recommendations by default unless the user asks for another N. Preserve SkillRadar ordering unless you clearly explain a safety override. If `capability_gap.detected` is true, surface the gap instead of padding the list.
6. Prefer A/B security skills when relevance is close. If the Top-1 result is C and SkillRadar returns an `advisory`, surface the safer nearby alternative.
7. Only after the Registry result is known, inspect whether those candidates are already installed locally. Local availability is supplemental metadata, not a replacement ranking.
8. If a Registry candidate is not installed, show its source/install URL before running any third-party scripts. Do not silently swap it for a different installed skill.
9. For design requests, preserve the discipline intent: UI, visual communication, operations, video, industrial, environmental, fashion, experience, digital media/film, arts & crafts, folk art, or architecture.
10. Return to the original task after selecting the capability.

## Required response evidence
For explicit routing/recommendation requests, include enough evidence to prove the bundled Registry and matching v2.1 were used:

- `source: skillradar-registry`
- `registry.mode: local-bundled` when the bundled snapshot is healthy
- `ranking.version: 2.1`
- `context.mode: project-aware` or `task-only`
- `capability_gap` when fewer than 3 strong recommendations are returned
- for every recommended result: `match_score`, `skillradar_score`, `security`, `source`, and `reason`
- summarize useful `match_details`, especially task matched signals / coverage and any project-context bonus, when the ranking needs explanation

If these fields are unavailable because the lookup failed, say so explicitly. Do not present a local-skill-only shortlist as a successful SkillRadar route.

## Safety
Discovery is not execution. Running SkillRadar's own read-only registry CLI is allowed for routing; it does not authorize installation or execution of matched third-party skills. Popularity is not permission. Third-party shell commands, secret access, database writes and deployments remain subject to normal authorization and safety checks.
