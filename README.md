# SkillRadar

**Find the right agent skill for the task — without installing hundreds of skills.**

SkillRadar is an open-source skill registry, discovery UI, safety-aware daily ranking pipeline, and Codex routing plugin. It continuously discovers public `SKILL.md` repositories, parses their real contents, scans risky behaviors, classifies them into design fields, updates rankings, and exposes only routable candidates to Codex.

> V0.3 closes the first working loop: **Radar → parse → static security scan → classify → rank → publish to registry → Codex route**.

## What is included

- Discover / Trending / Rising / Official views
- Category browsing and local search
- Task-to-skill router returning a Top 3 shortlist
- Skill detail cards with experimental score and safety grade
- Local `My Skills` state via `localStorage`
- Starter skill packs
- Codex plugin with `skill-router`, `find-skill`, `inspect-skill`, and `manage-skills`
- Local + GitHub raw registry fallback for the Codex plugin
- 12-field Design Radar with a Top 20 list per field
- 83 unique open-source design-related seed skills
- Daily GitHub discovery of real `SKILL.md` files
- Frontmatter / summary / quality / maintenance / GitHub-signal analysis
- Static scanning for destructive commands, shell/network access, secrets, package installation, filesystem writes, git writes and deploy behavior
- A/B/C/D/Blocked safety grades; D and Blocked candidates remain auditable but are excluded from Codex routing and dynamic Top 20
- Automatic 12-field classification and daily ranking history
- Generated `design-skills-radar.json` merged into the same registry used by the web UI and Codex plugin
- Daily Codex routing smoke tests for UI, Remotion/video, industrial/3D-printing and architecture/interior tasks
- Chinese design-task routing (海报、服装、建筑可视化、3D打印、视频动效等)

## First live Radar run

The 0.3 pipeline has already executed successfully through GitHub Actions and produced a `skillradar-bot` commit. The live registry is therefore no longer seed-only. Counts change on every run; inspect `data/radar-latest.json` and `data/design-skill-index.json` for the current state.

## Quick start

```bash
git clone https://github.com/changchangidea-oss/SkillRadar.git
cd SkillRadar
npm run validate
npm run serve
```

Open `http://localhost:4173`.

## Repository structure

```text
SkillRadar/
├── index.html
├── assets/
│   ├── styles.css
│   └── app.js
├── data/
│   ├── skills.json
│   ├── design-skill-index.json
│   ├── design-skills-1.json ... design-skills-4.json
│   ├── design-skills-radar.json
│   ├── design-seed-baseline.json
│   ├── design-domains.json
│   ├── radar-latest.json
│   ├── radar-registry.json
│   └── ranking-history.json
├── packages/codex-plugin/
├── scripts/
│   ├── validate.mjs
│   ├── update-design-radar.mjs
│   └── apply-safety-gate.mjs
├── docs/
├── .github/workflows/
├── LICENSE
└── README.md
```

## Design Radar

The fields are UI Design, Visual Communication, Operations Design, Video Design, Industrial Design, Environmental Design, Fashion Design, Experience Design, Digital Media & Film, Arts & Crafts, Folk Art, and Architecture Design.

The original Top 20 lists are **SkillRadar seed rankings**, not an official global leaderboard. Daily Radar candidates compete with that baseline using domain relevance, parsed-skill quality, security, maintenance, popularity, and maturity signals. Rank snapshots are stored in `data/ranking-history.json`.

## Codex plugin

The plugin contains four skills:

- `skill-router` — route a real task to the most relevant safe skills.
- `find-skill` — search by technology, category, design field, or task.
- `inspect-skill` — inspect purpose, provenance, risk, and maintenance signals.
- `manage-skills` — keep global and project skill sets compact.

The CLI reads the same generated registry as the website. When installed outside this repository, it falls back to the public raw GitHub registry. D and Blocked candidates are filtered again at runtime as defense in depth.

## GitHub Pages

The repository already contains current GitHub Pages Actions workflows. GitHub requires Pages to be enabled once at the repository level before a normal `GITHUB_TOKEN` can deploy the first site. Use **Settings → Pages → Build and deployment → Source: GitHub Actions**. After that one-time switch, the existing workflows publish the site and refreshed Radar data automatically.

Advanced alternative: add a repository secret named `PAGES_TOKEN` with Pages write + Administration write permissions; the workflow is already prepared to use it for first-time enablement.

## Safety model

> **Discovery is not execution.**

Popularity never grants execution permission. The static scanner is a conservative filter, not a formal security audit. High-risk candidates stay visible for inspection in `radar-registry.json` but cannot enter the Codex routing shard when graded D or Blocked.

## Roadmap

1. ✅ Daily GitHub `SKILL.md` discovery for 12 design fields
2. ✅ Real `SKILL.md` parsing and metadata extraction
3. ✅ Static security scanning and routing safety gate
4. ✅ Automatic design-field classification
5. ✅ Seed + Radar daily Top 20 ranking and rank history
6. ✅ Codex routing against the same live registry
7. GitHub + skills.sh install-growth history
8. Semantic/vector search and hosted API
9. Persistent PostgreSQL/Supabase registry
10. Community curation and verified publishers

## Contributing

Issues, source corrections, discovery adapters, ranking improvements, and security rules are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT. See [LICENSE](LICENSE).
