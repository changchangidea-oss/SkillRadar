---
name: inspect-skill
description: Inspect one SkillRadar skill for purpose, provenance, quality signals, security grade, maintenance, and suitability before installation or use.
---
# Inspect Skill

Run `node ../../scripts/skillradar.mjs inspect '<skill id or exact name>'`.

This is SkillRadar's own read-only registry CLI. It may be run to inspect the bundled registry without treating it as execution permission for the candidate skill itself.

Summarize what the skill does, its source repository, category or design specialty, `skillradar_score`, security grade, install/source URL, and any obvious risk implied by the task. Do not treat SkillRadar's grade as a full security audit. For third-party skills, inspect the actual `SKILL.md` and scripts before executing anything with shell, secrets, deployment, database writes, or external network access.
