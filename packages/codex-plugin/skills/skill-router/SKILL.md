---
name: skill-router
description: Route a coding or design task to the best available agent skill. Use when the task is specialized, the best local skill is unclear, the user asks which skill to use, or selecting a better skill before implementation would materially improve the result.
---
# Skill Router

Use SkillRadar as a retrieval layer, not as a reason to load every skill into context.

## Workflow
1. Read the user's task and inspect any obviously relevant local skills first.
2. If one precise local skill clearly covers the task, use it without remote lookup.
3. Otherwise call: `node ../../scripts/skillradar.mjs match '<task>'`.
4. Compare the top results by task match, SkillRadar score and security grade.
5. Prefer A/B security skills when relevance is close. Never auto-execute a Blocked skill.
6. For design requests, preserve the discipline intent: UI, visual communication, operations, video, industrial, environmental, fashion, experience, digital media/film, arts & crafts, folk art, or architecture.
7. If the chosen skill is not installed, show the install/source URL before running any third-party scripts.
8. Return to the original task after selecting the capability.

## Safety
Discovery is not execution. Popularity is not permission. Third-party shell commands, secret access, database writes and deployments remain subject to normal authorization and safety checks.
