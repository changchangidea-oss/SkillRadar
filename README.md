# SkillRadar

> **Open-source discovery, security, ranking, and routing infrastructure for Agent Skills and Codex.**

[![Release](https://img.shields.io/github/v/release/changchangidea-oss/SkillRadar?display_name=tag)](https://github.com/changchangidea-oss/SkillRadar/releases)
[![Daily Radar](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/design-radar.yml/badge.svg)](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/design-radar.yml)
[![Router Benchmark](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/router-benchmark.yml/badge.svg)](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/router-benchmark.yml)
[![Security Guard](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/security.yml/badge.svg)](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/security.yml)
[![MIT](https://img.shields.io/badge/license-MIT-6f7d73)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent_Skills-compatible-4A90D9)](https://agentskills.io)
[![Stars](https://img.shields.io/github/stars/changchangidea-oss/SkillRadar?style=flat)](https://github.com/changchangidea-oss/SkillRadar/stargazers)

![SkillRadar overview](docs/media/skillradar-demo.gif)

SkillRadar is **not another list of bookmarked skill repositories**. It is an auditable intelligence layer between the fast-growing Agent Skills ecosystem and the coding agent that needs one capability *right now*.

It discovers public `SKILL.md` files, parses their real contents, performs a conservative static security scan, classifies them by task/domain, combines relevance + quality + maintenance + popularity + safety signals, and exposes the same safety-gated registry to both the public web UI and the Codex plugin.

**v0.5 closed loop:**

`Design Radar + General Radar → Parse → Security scan → Classify → Rank → Deduplicate → Bundle → Matching v2.1 → Golden Benchmark → Codex route`

## Why this exists

Installing hundreds of skills is the wrong optimization. It increases context pressure, makes provenance harder to track, and turns task routing into guesswork.

SkillRadar takes the opposite approach:

- keep discovery broad;
- keep active skill context narrow;
- inspect before trusting;
- separate popularity from permission;
- return a small Top-3 match for the actual task;
- explain why the match happened;
- measure routing quality instead of tuning by intuition;
- measure and reduce skill-context pressure instead of blindly deleting capabilities.

## 60-second quick start

### Option A — full Codex Plugin

```bash
codex plugin marketplace add changchangidea-oss/SkillRadar --ref v0.5.0 && codex plugin add skillradar@skillradar
```

Start a fresh Codex thread, then route a task:

```text
$skill-router
Find the best skills for a Next.js AI dashboard with tool calling and shadcn/ui.
```

Or diagnose a crowded Codex skill catalog:

```text
$manage-skills
Audit my active Skills for this project and show me what I can safely disable to reduce context pressure. Do not change configuration yet.
```

**v0.5.0 is offline-first and registry-first for explicit routing.** The installed plugin ships with a complete safety-gated `core + design + general` registry snapshot. Normal Top-3 routing does not require cloning this repository or fetching GitHub Raw.

A successful route exposes `source: skillradar-registry`, `registry.mode: local-bundled`, `ranking.version: 2.1`, `context.mode`, `match_score`, `skillradar_score`, `security`, `source`, `reason`, and auditable `match_details` including task and project-context evidence.

### Option B — standard Agent Skill / skills.sh ecosystem

```bash
npx skills add changchangidea-oss/SkillRadar --skill skillradar
```

The standard skill is intentionally read-first: discovery does not authorize third-party execution.

### Option C — run the registry UI locally

```bash
git clone https://github.com/changchangidea-oss/SkillRadar.git
cd SkillRadar
npm run validate
npm run benchmark:router
npm run serve
```

Open `http://localhost:4173`.

## Wider discovery

SkillRadar combines the 12-field Design Radar with a **General Agent Skills Radar** across 10 domains:

AI Agents · Frontend · Backend & API · Data & Database · Testing & Quality · DevOps & Cloud · Security · Mobile · Automation & Integrations · Docs & Research.

General discovery combines multiple channels rather than relying on one repository query:

- GitHub repository search;
- GitHub `SKILL.md` code search when available;
- broad Agent / Claude / Codex skill ecosystem queries.

Candidates record discovery channels, coverage, domain evidence, quality, maintenance, popularity, security findings and provenance. D/Blocked candidates stay audit-only and cannot enter the bundled routing shard.

Operational coverage is written to `data/general-radar-latest.json`; the auditable candidate pool is `data/general-radar-registry.json`.

## Matching v2.1

Raw substring matching is not enough. Matching v2.1:

- recognizes concepts/phrases such as App Router, tool calling and design systems;
- avoids short-token substring mistakes such as `ai` matching `tailwind`;
- weights identity, tags, domains, summary and source differently;
- measures how much of the user's explicit task is actually covered;
- combines evidence with SkillRadar quality, safety and freshness priors;
- uses project metadata only as a bounded secondary tie-break;
- caps project-context bonus at 6 points, and at 2 points when user-task coverage is zero;
- complementary-reranks Top 3 so the set covers important task facets not already covered by earlier selections;
- emits task signal weights, project-context evidence and other `match_details` for auditability.

Project context is deliberately narrow: dependency names, common config filenames, and framework directories may be read. Source-file contents, environment-variable values, credentials and candidate third-party scripts are not used for project-context routing.

If a C-grade skill ranks first and an A/B candidate is within five match-score points, SkillRadar surfaces a safer-alternative advisory.

## Router Quality Benchmark

v0.5 adds a golden benchmark so ranking changes have a measurable contract instead of relying on subjective spot checks.

The initial main-branch v0.5 baseline is:

- 7 / 7 golden routing cases passed;
- pass rate: 100%;
- D / Blocked results in Top-3: 0;
- average Top-1 match score: 85.1;
- project-context fixture: passed;
- explicit task-dominance fixture: passed.

The multi-capability AI Dashboard case is intentionally strict: the Top-3 must include `nextjs`, `ai-sdk`, and `shadcn`, proving that the reranker covers distinct explicit task facets instead of filling slots with generic near-matches.

Benchmark inputs live in `data/router-benchmark.json`; the latest auditable result is committed to `data/router-benchmark-latest.json`. CI and the release workflow both enforce the benchmark. v0.5 does **not** use hidden auto-tuning: weight changes remain code-reviewed and benchmark-gated.

## Skill Budget Doctor

Current Codex has a finite model-visible skill metadata budget; crowded catalogs cause descriptions to be shortened or eventually omitted. `$manage-skills` uses a read-only doctor instead of generic cleanup advice.

The doctor inventories user, project and enabled plugin skills, estimates catalog pressure, detects near duplicates, uses current project/task relevance as a pruning signal, and generates:

- current pressure / usage / budget ratio;
- duplicate groups and preferred keepers;
- projected ratio after pruning;
- `[[skills.config]] ... enabled = false` snippets;
- whole-plugin removal suggestions only when most capabilities in that plugin are redundant.

It does **not** edit `~/.codex/config.toml`, disable skills, uninstall plugins or execute discovered scripts without a later explicit approval.

## Architecture

```mermaid
flowchart LR
  GH[Public GitHub repositories] --> DR[Design Radar]
  GH --> GR[General Radar]
  DR --> S[Parse + security scan]
  GR --> S
  S -->|A / B / C| R[Classify + rank]
  S -->|D / Blocked| A[Audit-only pool]
  R --> REG[(Safety-gated registry)]
  REG --> SNAP[(Bundled core + design + general snapshot)]
  SNAP --> M[Matching v2.1]
  M --> Q[Router Quality Benchmark]
  M --> CODEX[Codex $skill-router]
  CODEX --> T[Top-3 task match]
  CODEX --> B[Skill Budget Doctor]
```

## Safety boundary

**Discovery is not execution.**

The scanner looks for high-risk patterns and capabilities including destructive shell commands, pipe-to-shell installs, remote shell use, dynamic execution, secret access, networking, package installation, filesystem writes, git writes, and deploy tooling.

Grades are conservative:

- **A** — low-risk static profile.
- **B** — limited side-effect surface or scripts require awareness.
- **C** — explicit review required before recommendation/installation.
- **D** — audit-only; excluded from automatic routing.
- **Blocked** — prohibited from automatic routing.

This is **not** a formal security audit or sandbox. The goal is to make risk visible before an agent installs or runs something.

## Codex Plugin

The plugin lives in `packages/codex-plugin/` and includes:

- `skill-router` — task → evidence-backed Top 3;
- `find-skill` — search core, general and design registries;
- `inspect-skill` — provenance, quality and safety inspection;
- `manage-skills` — Skill Budget Doctor for context pressure and duplicate cleanup.

A repository-level Codex marketplace lives at `.agents/plugins/marketplace.json`, so Codex can install directly from GitHub. The plugin filters D/Blocked candidates again at runtime as defense in depth.

## Repository map

```text
SkillRadar/
├── .agents/plugins/marketplace.json
├── skills/skillradar/SKILL.md
├── data/
│   ├── skills.json                       # curated core
│   ├── design-skills-*.json              # design seed + live Radar
│   ├── general-domains.json              # 10-domain general taxonomy
│   ├── general-skills-radar.json         # safety-gated general routing shard
│   ├── general-radar-registry.json       # auditable general candidates
│   ├── general-radar-latest.json         # discovery coverage metrics
│   ├── router-benchmark.json             # golden routing tasks
│   └── router-benchmark-latest.json      # latest quality baseline
├── packages/codex-plugin/
│   ├── data/registry.json                # schema-v2 bundled snapshot
│   ├── scripts/skillradar.mjs            # Matching v2.1 router CLI
│   ├── scripts/skill-budget.mjs          # read-only Skill Budget Doctor
│   └── skills/
├── scripts/
└── .github/workflows/
```

## Open-source operating model

The repository intentionally keeps evidence in public Git history. Daily bots commit generated Radar data and refreshed bundled snapshots; the benchmark bot commits routing-quality baselines; ranking and discovery metrics remain inspectable; CI verifies security patterns, registry integrity, Matching v2.1, project-context boundaries, plugin-only offline routing, Router Quality Benchmark, Skill Budget Doctor behavior, and public marketplace installation.

We do **not** manufacture Stars, Forks, installs, or contributor activity. Adoption metrics should represent real external users.

## Public pages

- Registry: `https://changchangidea-oss.github.io/SkillRadar/`
- Metrics: `https://changchangidea-oss.github.io/SkillRadar/metrics.html`

## Contributing

Useful contributions include new Skill sources, safety rules/fixtures, domain taxonomy improvements, ranking improvements, benchmark cases, OS compatibility tests, and UI/metrics improvements. See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## Release

See [v0.5.0 release notes](docs/releases/v0.5.0.md).

## License

MIT — see [LICENSE](LICENSE).
