# SkillRadar Codex Plugin

The full Codex integration for SkillRadar. It routes tasks to a small, safety-aware skill shortlist using the same safety-gated registry published by the open-source project, and diagnoses skill-context pressure before users start removing capabilities blindly.

## v0.4.0 behavior

The plugin ships with a bundled registry snapshot containing **core + design + general Agent Skills**. Normal `search`, `match`, and `inspect` calls read that local snapshot first, so routing works without GitHub Raw access and without cloning the repository. Network access is fallback only when the local snapshot is unavailable.

For explicit `$skill-router`, Top N, recommendation, comparison, ranking, or routing requests, the plugin has a strict **registry-first contract**: Codex must query the bundled SkillRadar registry before choosing candidates. Already-installed local skills may be reported as availability metadata after the Registry result, but they cannot replace the SkillRadar ranking.

### Matching v2

Matching v2 resolves task concepts/phrases, weights evidence by registry field, measures task-signal coverage, combines that with quality/security/freshness priors, and applies a small diversity rerank so near-duplicate skills do not occupy every Top-3 slot. Results expose `match_details` so the ranking is inspectable instead of being a black box.

### Skill Budget Doctor

`$manage-skills` now runs the bundled read-only `scripts/skill-budget.mjs` doctor. It:

- inventories user, project and plugin-provided skills that Codex can see;
- estimates metadata pressure using current Codex budget behavior;
- detects near-duplicate capabilities;
- uses current project/task signals to identify weakly relevant skills;
- produces `[[skills.config]] ... enabled = false` snippets and projected savings;
- suggests whole-plugin removal only when most capabilities from that plugin are redundant.

The doctor **does not edit config or uninstall anything by default**.

## Install from GitHub

```bash
codex plugin marketplace add changchangidea-oss/SkillRadar --ref v0.4.0 && codex plugin add skillradar@skillradar
```

After installation, start a **new Codex thread** so the newly installed plugin/skills are discovered cleanly.

## Included skills

- `skill-router` — task → Top-3 SkillRadar registry shortlist
- `find-skill` — search registry by task, technology, general domain or design domain
- `inspect-skill` — provenance, quality and safety inspection
- `manage-skills` — measure skill-context pressure and generate a read-only pruning plan

## Canonical routing evidence

A successful explicit `$skill-router` route should expose:

- top-level `source: skillradar-registry`;
- `registry.mode: local-bundled` when the bundled snapshot is healthy;
- `ranking.version: 2.0`;
- `match_score` — relevance to the current task;
- `skillradar_score` — overall SkillRadar quality/signal score;
- `security` — A/B/C safety grade;
- `source` — source repository;
- `reason` — concise routing rationale;
- `match_details` — matched signals, coverage and ranking priors.

If the Top-1 result is security grade C and an A/B result is within five match-score points, the router returns an `advisory` recommending the safer nearby alternative.

## Safety

Discovery is not execution. D and Blocked Radar candidates are excluded from the generated routing shard and filtered again at runtime. A/B/C recommendations remain discovery results only; third-party scripts, secrets, deployments, database writes and external network actions still require normal review and authorization. Skill Budget Doctor output is advisory until the user explicitly approves applying a configuration change.
