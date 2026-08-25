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

## Matching v2
SkillRadar v0.4 uses evidence-weighted matching rather than raw substring hits. It resolves task concepts and phrases, weights matches by field (identity/tags/domain/summary), measures task-signal coverage, then combines that evidence with SkillRadar quality, safety and freshness priors. The final Top 3 is diversity-reranked so near-duplicate capabilities do not unnecessarily occupy every slot.

## Workflow
1. Convert the user's task into a concise routing query without dropping important frameworks, technologies, design disciplines, or requested capabilities.
2. For explicit `$skill-router`, recommendation, comparison, ranking, or Top N requests, run `node ../../scripts/skillradar.mjs match '<task>'` **before** selecting candidates.
3. Read the canonical registry evidence: top-level `source`, `registry.mode`, `ranking.version`, and for each result `match_score`, `skillradar_score`, `security`, `source`, `reason`, and `match_details`.
4. Return the Registry Top 3 by default unless the user asks for another N. Preserve SkillRadar ordering unless you clearly explain a safety override.
5. Prefer A/B security skills when relevance is close. If the Top-1 result is C and SkillRadar returns an `advisory`, surface the safer nearby alternative.
6. Only after the Registry result is known, inspect whether those candidates are already installed locally. Local availability is supplemental metadata, not a replacement ranking.
7. If a Registry candidate is not installed, show its source/install URL before running any third-party scripts. Do not silently swap it for a different installed skill.
8. For design requests, preserve the discipline intent: UI, visual communication, operations, video, industrial, environmental, fashion, experience, digital media/film, arts & crafts, folk art, or architecture.
9. Return to the original task after selecting the capability.

## Required response evidence
For explicit routing/recommendation requests, include enough evidence to prove the bundled Registry and matching v2 were used:

- `source: skillradar-registry`
- `registry.mode: local-bundled` when the bundled snapshot is healthy
- `ranking.version: 2.0`
- for every recommended result: `match_score`, `skillradar_score`, `security`, `source`, and `reason`
- summarize useful `match_details`, especially matched signals and coverage, when the ranking needs explanation

If these fields are unavailable because the lookup failed, say so explicitly. Do not present a local-skill-only shortlist as a successful SkillRadar route.

## Safety
Discovery is not execution. Running SkillRadar's own read-only registry CLI is allowed for routing; it does not authorize installation or execution of matched third-party skills. Popularity is not permission. Third-party shell commands, secret access, database writes and deployments remain subject to normal authorization and safety checks.
