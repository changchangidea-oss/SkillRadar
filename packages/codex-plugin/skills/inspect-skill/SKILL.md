---
name: inspect-skill
description: Inspect one SkillRadar skill for purpose, provenance, quality signals, security grade, maintenance, and suitability before installation or use.
---
# Inspect Skill

Run `node ../../scripts/skillradar.mjs inspect '<skill id or exact name>'`.

Summarize what the skill does, its source repository, category or design specialty, SkillRadar score, security grade, install/source URL, and any obvious risk implied by the task. Do not treat SkillRadar's seed grade as a full security audit. For third-party skills, inspect the actual `SKILL.md` and scripts before executing anything with shell, secrets, deployment, database writes, or external network access.
