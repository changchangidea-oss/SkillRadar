---
name: skill-router
description: Route a coding or design task to the best available agent skill. Use when the task is specialized, the best local skill is unclear, the user asks which skill to use, or selecting a better skill before implementation would materially improve the result.
---
# Skill Router

Use SkillRadar as a retrieval layer, not as a reason to load every skill into context.

## Trusted internal lookup
`node ../../scripts/skillradar.mjs ...` is the read-only lookup CLI shipped inside the installed SkillRadar plugin. It reads SkillRadar's bundled safety-gated registry and does not install or execute any discovered third-party skill. Treat this internal lookup differently from scripts that belong to candidate third-party skills.

## Workflow
1. Read the user's task and inspect any obviously relevant local skills first.
2. If one precise local skill clearly covers the task, use it without remote lookup.
3. Otherwise run `node ../../scripts/skillradar.mjs match '<task>'` directly. Do not replace a successful registry lookup with general web search.
4. Read the canonical fields: `match_score`, `skillradar_score`, `security`, `source`, and `reason`.
5. Prefer A/B security skills when relevance is close. If the Top-1 result is C and SkillRadar returns an `advisory`, surface the safer nearby alternative.
6. For design requests, preserve the discipline intent: UI, visual communication, operations, video, industrial, environmental, fashion, experience, digital media/film, arts & crafts, folk art, or architecture.
7. If the chosen skill is not installed, show the install/source URL before running any third-party scripts.
8. Return to the original task after selecting the capability.

## Safety
Discovery is not execution. Running SkillRadar's own read-only registry CLI is allowed for routing; it does not authorize installation or execution of matched third-party skills. Popularity is not permission. Third-party shell commands, secret access, database writes and deployments remain subject to normal authorization and safety checks.
