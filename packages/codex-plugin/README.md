# SkillRadar Codex Plugin

The full Codex integration for SkillRadar. It routes tasks to a small, safety-aware skill shortlist using the same safety-gated registry published by the open-source project.

## v0.3.1 behavior

The plugin now ships with a bundled registry snapshot. Normal `search`, `match`, and `inspect` calls read that local snapshot first, so routing works without GitHub Raw access and without cloning the repository. Network access is only a fallback when the local snapshot is unavailable.

The bundled `scripts/skillradar.mjs` command is SkillRadar's own read-only lookup CLI. Running it does **not** authorize installation or execution of any matched third-party skill.

## Install from GitHub

```bash
codex plugin marketplace add changchangidea-oss/SkillRadar --ref v0.3.1 && codex plugin add skillradar@skillradar
```

After installation, start a **new Codex thread** so the newly installed plugin/skills are discovered cleanly.

## Included skills

- `skill-router` — task → Top-3 skill shortlist
- `find-skill` — search registry by task, technology or design domain
- `inspect-skill` — provenance, quality and safety inspection
- `manage-skills` — keep project/global skill sets intentionally small

## Canonical routing fields

`skill-router` returns:

- `match_score` — relevance to the current task;
- `skillradar_score` — overall SkillRadar quality/signal score;
- `security` — A/B/C safety grade;
- `source` — source repository;
- `reason` — concise routing rationale.

If the Top-1 result is security grade C and an A/B result is within five match-score points, the router returns an `advisory` recommending the safer nearby alternative.

## Safety

Discovery is not execution. D and Blocked Radar candidates are excluded from the generated routing shard and filtered again at runtime. A/B/C recommendations remain discovery results only; third-party scripts, secrets, deployments, database writes and external network actions still require normal review and authorization.
