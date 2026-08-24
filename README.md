# SkillRadar

**Find the right agent skill for the task — without installing hundreds of skills.**

SkillRadar is an open-source skill registry, discovery UI, safety-aware ranking experiment, and Codex routing plugin. The goal is to continuously discover high-signal `SKILL.md` repositories, classify and inspect them, and help coding agents load the smallest useful set of skills for each task.

> V0.2 is local-first but no longer static-only: the website ships with a seed registry and a 12-field Design Radar, while GitHub Actions performs a daily public `SKILL.md` discovery pass. Persistent metrics and the hosted registry API remain future work.

## What is included

- Discover / Trending / Rising / Official views
- Category browsing and local search
- Task-to-skill router returning a Top 3 shortlist
- Skill detail cards with experimental score and safety grade
- Local `My Skills` state via `localStorage`
- Starter skill packs
- Codex plugin with `skill-router`, `find-skill`, `inspect-skill`, and `manage-skills`
- Local + GitHub raw registry fallback for the Codex plugin
- 12-field Design Radar with a curated Top 20 seed list per field
- 83 unique open-source design-related seed skills spanning UI, visual communication, operations, video, industrial, spatial, fashion, UX, digital media, craft, folk art and architecture
- 240 ranked seed positions across the 12 design fields
- Daily GitHub Radar workflow that discovers new `SKILL.md` candidates and commits `data/radar-latest.json`
- Chinese design-task routing in the Codex plugin (for example 海报、服装、建筑可视化、3D打印、视频动效)
- No build step for the website

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
│   ├── design-domains.json
│   └── radar-latest.json
├── packages/codex-plugin/
├── scripts/
│   ├── validate.mjs
│   └── update-design-radar.mjs
├── docs/
├── .github/workflows/
├── LICENSE
└── README.md
```

## Design Radar

The current fields are UI Design, Visual Communication, Operations Design, Video Design, Industrial Design, Environmental Design, Fashion Design, Experience Design, Digital Media & Film, Arts & Crafts, Folk Art, and Architecture Design.

The initial Top 20 lists are **SkillRadar seed rankings**, not an official global leaderboard. They use real open-source sources and public signals, then weight domain relevance, usage/install evidence and safety. Newly discovered skills first enter **New & Rising** rather than automatically displacing the seed baseline.

See [docs/DESIGN_RADAR.md](docs/DESIGN_RADAR.md).

## Codex plugin

The plugin contains four skills:

- `skill-router` — route a real task to the most relevant skills.
- `find-skill` — search by technology, category, design field, or task.
- `inspect-skill` — inspect purpose, provenance, risk, and maintenance signals.
- `manage-skills` — keep global and project skill sets compact.

The CLI helper uses the local registry when installed from this repository, falls back to the public GitHub raw registry when local data is absent, and can use a compatible hosted API when `SKILLRADAR_BASE_URL` is configured.

## Safety model

SkillRadar follows one hard rule:

> **Discovery is not execution.**

Popularity, stars, install counts, or an A/B label never grant permission to execute third-party scripts. Skills that touch shell commands, secrets, deployment, databases, or external networks must still be reviewed under the user's normal authorization and security policy.

The current grades and scores are experimental seed metadata, not a security audit.

## Roadmap

1. ✅ Daily GitHub `SKILL.md` discovery for 12 design fields
2. ✅ Seed ranking + New/Rising separation for design skills
3. Repository/version hashing and incremental refresh
4. Automated metadata extraction and categorization
5. Static + AI-assisted security scanner
6. GitHub + skills.sh install-growth metrics
7. Search API and semantic task matching
8. Persistent registry on PostgreSQL/Supabase
9. Hosted Codex router
10. Community curation and verified publishers

## Contributing

Issues, source corrections, new discovery adapters, ranking improvements, and safety rules are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT. See [LICENSE](LICENSE).
