# SkillRadar

> **Open-source discovery, security, ranking, and routing infrastructure for Agent Skills and Codex.**

[![Release](https://img.shields.io/github/v/release/changchangidea-oss/SkillRadar?display_name=tag)](https://github.com/changchangidea-oss/SkillRadar/releases)
[![Daily Radar](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/design-radar.yml/badge.svg)](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/design-radar.yml)
[![Security Guard](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/security.yml/badge.svg)](https://github.com/changchangidea-oss/SkillRadar/actions/workflows/security.yml)
[![MIT](https://img.shields.io/badge/license-MIT-6f7d73)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent_Skills-compatible-4A90D9)](https://agentskills.io)
[![Stars](https://img.shields.io/github/stars/changchangidea-oss/SkillRadar?style=flat)](https://github.com/changchangidea-oss/SkillRadar/stargazers)

![SkillRadar overview](docs/media/skillradar-demo.gif)

SkillRadar is **not another list of bookmarked skill repositories**. It is an auditable intelligence layer between the fast-growing Agent Skills ecosystem and the coding agent that needs one capability *right now*.

It continuously discovers public `SKILL.md` files, parses their real contents, performs a conservative static security scan, classifies them by task/domain, combines quality + maintenance + popularity + safety signals, keeps daily ranking history, and exposes the same safety-gated registry to both the public web UI and the Codex plugin.

**Current closed loop:**

`Radar → Parse → Security scan → Classify → Rank → Publish registry → Codex route`

## Why this exists

Installing hundreds of skills is the wrong optimization. It increases context pressure, makes provenance harder to track, and turns task routing into guesswork.

SkillRadar takes the opposite approach:

- keep discovery broad;
- keep installation narrow;
- inspect before trusting;
- separate popularity from permission;
- return a small Top-3 match for the actual task;
- make ranking changes and safety decisions observable in GitHub.

## 60-second quick start

### Option A — full Codex Plugin

Current Codex supports Git marketplace sources and marketplace-backed plugin installation. Add this repository as a marketplace and install SkillRadar in one shell line:

```bash
codex plugin marketplace add changchangidea-oss/SkillRadar --ref v0.3.1 && codex plugin add skillradar@skillradar
```

Then start a fresh Codex thread and ask, for example:

```text
Find a safe skill for a Remotion product launch video and explain why you picked it.
```

**v0.3.1 is offline-first for normal routing.** The installed plugin ships with a complete safety-gated registry snapshot, so `search`, `match`, and `inspect` read local data first. GitHub/network access is fallback only; normal Top-3 routing does not require cloning this repository or fetching GitHub Raw.

The bundled `skillradar.mjs` command is SkillRadar's own read-only lookup CLI. Running it does not authorize installation or execution of any discovered third-party skill.

### Option B — standard Agent Skill / skills.sh ecosystem

```bash
npx skills add changchangidea-oss/SkillRadar --skill skillradar
```

The standard skill is intentionally read-first: it helps an agent discover and inspect skills without automatically executing discovered code.

### Option C — run the registry UI locally

```bash
git clone https://github.com/changchangidea-oss/SkillRadar.git
cd SkillRadar
npm run validate
npm run serve
```

Open `http://localhost:4173`.

## Public metrics

The project publishes operational evidence instead of hard-coding marketing numbers.

**Metrics page:** `https://changchangidea-oss.github.io/SkillRadar/metrics.html`

The page reads directly from generated repository data and shows:

- total indexed skills (`core + seed + live Radar`);
- 12 design domains;
- latest daily Radar status;
- active / review / blocked candidate counts;
- Codex Top-3 routing model;
- daily ranking snapshots from `data/ranking-history.json`.

Registry counts are intentionally generated from current repository data rather than frozen into README marketing copy. Daily Radar refreshes can change them automatically.

## Architecture

```mermaid
flowchart LR
  GH[Public GitHub repositories] --> D[Daily Radar discovery]
  D --> P[SKILL.md parser]
  P --> S[Static security scanner]
  S -->|A / B / C| C[Domain classifier]
  S -->|D / Blocked| A[Audit-only candidate pool]
  C --> R[Daily ranking engine]
  R --> H[(ranking-history.json)]
  R --> REG[(Safety-gated registry)]
  REG --> SNAP[(Bundled Codex registry snapshot)]
  REG --> WEB[Public web UI + metrics]
  SNAP --> CODEX[Codex Plugin router]
  CODEX --> T[Top-3 task match]
```

### The safety boundary

**Discovery is not execution.**

The scanner looks for high-risk patterns and capabilities including destructive shell commands, pipe-to-shell installs, remote shell use, dynamic execution, secret access, networking, package installation, filesystem writes, git writes, and deploy tooling.

Grades are conservative:

- **A** — low-risk static profile.
- **B** — limited side-effect surface or scripts require awareness.
- **C** — explicit review required before recommendation/installation.
- **D** — audit-only; excluded from dynamic Top 20 and Codex automatic routing.
- **Blocked** — prohibited from automatic routing.

If a C-grade skill ranks first and an A/B candidate is within five match-score points, the v0.3.1 router surfaces a safer-alternative advisory instead of treating rank #1 as automatic permission.

This is **not** a formal security audit or sandbox. The goal is to make risk visible *before* an agent installs or runs something.

## Design Radar

SkillRadar currently maintains 12 design fields:

UI Design · Visual Communication · Operations Design · Video Design · Industrial Design · Environmental Design · Fashion Design · Experience Design · Digital Media & Film · Arts & Crafts · Folk Art · Architecture Design.

Each field started with a curated Top 20 seed baseline. New Radar candidates do not automatically jump to the top: they compete using parsed quality, maintenance, popularity, safety, domain relevance, and maturity signals. Daily snapshots are committed to `data/ranking-history.json`.

## Codex Plugin

The plugin lives in `packages/codex-plugin/` and includes:

- `skill-router` — map a real task to a small, relevant skill stack;
- `find-skill` — search by task, technology, category, or design field;
- `inspect-skill` — inspect provenance, maintenance, safety, and intended use;
- `manage-skills` — keep global/project skill sets compact.

The router returns canonical fields:

- `match_score` — relevance to the current task;
- `skillradar_score` — overall SkillRadar quality/signal score;
- `security` — A/B/C safety grade;
- `source` — source repository;
- `reason` — concise routing rationale.

A repository-level Codex marketplace lives at `.agents/plugins/marketplace.json`, so Codex can install directly from GitHub. The plugin bundles the same generated safety-gated registry used by the project and filters D/Blocked candidates again at runtime as defense in depth.

## Repository map

```text
SkillRadar/
├── .agents/plugins/marketplace.json     # Codex marketplace entry
├── skills/skillradar/SKILL.md           # standard Agent Skill
├── index.html                            # registry UI
├── metrics.html                          # public operational metrics
├── assets/                               # web UI
├── data/
│   ├── design-skills-1..4.json           # seed registry
│   ├── design-skills-radar.json          # safety-gated Radar shard
│   ├── design-domains.json               # live Top 20 rankings
│   ├── design-seed-baseline.json         # immutable seed baseline
│   ├── radar-latest.json                 # latest run
│   ├── radar-registry.json               # audit candidate pool
│   └── ranking-history.json              # daily snapshots
├── packages/codex-plugin/
│   ├── data/registry.json                # bundled safety-gated snapshot
│   ├── scripts/skillradar.mjs            # read-only local-first router CLI
│   └── skills/                            # Codex routing skills
├── scripts/
└── .github/workflows/
```

## Open-source operating model

The repository intentionally keeps evidence in public Git history:

- the daily bot commits generated Radar data and refreshes the bundled plugin registry;
- ranking snapshots show how Top 20 lists move;
- security-gated candidates remain inspectable;
- Issues and PRs are the source of roadmap and maintenance discussion;
- Releases package stable plugin versions;
- CI verifies registry integrity, secret patterns, ecosystem manifests, and plugin-only offline routing.

We do **not** manufacture Stars, Forks, installs, or contributor activity. Adoption metrics should represent real external users.

## GitHub Pages

The public registry and metrics are deployed through GitHub Actions:

- `https://changchangidea-oss.github.io/SkillRadar/`
- `https://changchangidea-oss.github.io/SkillRadar/metrics.html`

Daily Radar refreshes can publish the current registry and metrics page automatically.

## Contributing

Useful first contributions include:

- add or correct a Skill source;
- improve a static safety rule and add a fixture;
- improve domain classification/ranking;
- add a new non-design taxonomy adapter;
- test Codex / skills CLI installation on another OS;
- improve accessibility or data visualization on the metrics page.

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues should follow [SECURITY.md](SECURITY.md).

## Release

See [v0.3.1 release notes](docs/releases/v0.3.1.md).

## License

MIT — see [LICENSE](LICENSE).
