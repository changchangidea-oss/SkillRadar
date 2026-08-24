# SkillRadar

**Find the right agent skill for the task — without installing hundreds of skills.**

SkillRadar is an open-source skill registry, discovery UI, safety-aware ranking experiment, and Codex routing plugin. The long-term goal is to continuously discover high-signal `SKILL.md` repositories, classify and inspect them, and help coding agents load the smallest useful set of skills for each task.

> V0.2 is local-first but no longer static-only: the website ships with a seed registry and a 12-field Design Radar, while GitHub Actions performs a daily public `SKILL.md` discovery pass. Persistent metrics and the hosted registry API remain future work.

## What is included

- Discover / Trending / Rising / Official views
- Category browsing and local search
- Task-to-skill router returning a Top 3 shortlist
- Skill detail cards with experimental score and safety grade
- Local `My Skills` state via `localStorage`
- Starter skill packs
- Codex plugin with `skill-router`, `find-skill`, `inspect-skill`, and `manage-skills`
- Local registry fallback for the Codex plugin
- 12-field Design Radar with a curated Top 20 seed list per field
- 90 open-source design-related seed skills spanning UI, visual communication, video, industrial, spatial, fashion, UX, digital media, craft, folk art and architecture
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

You can also open `index.html` directly in a browser, though serving it locally gives behavior closer to GitHub Pages.

## Repository structure

```text
SkillRadar/
├── index.html                  # V1 static web app
├── data/skills.json            # Core coding seed registry
├── data/design-skills.json     # Open-source design skill seed pool
├── data/design-domains.json    # 12 design fields + Top 20 seed rankings
├── data/radar-latest.json      # Daily GitHub discovery snapshot
├── packages/codex-plugin/      # Codex plugin source
├── scripts/validate.mjs        # Zero-dependency validation
├── docs/
├── .github/
├── LICENSE
└── README.md
```

## Codex plugin

The plugin contains four skills:

- `skill-router` — route a real task to the most relevant skills.
- `find-skill` — search by technology, category, or task.
- `inspect-skill` — inspect purpose, provenance, risk, and maintenance signals.
- `manage-skills` — keep global and project skill sets compact.

The CLI helper uses both the embedded coding registry and design registry by default. Chinese design-domain terms are expanded into routing tags before matching. Set `SKILLRADAR_BASE_URL` when a compatible hosted API is available.

## Safety model

SkillRadar follows one hard rule:

> **Discovery is not execution.**

Popularity, stars, install counts, or an A/B label never grant permission to execute third-party scripts. Skills that touch shell commands, secrets, deployment, databases, or external networks must still be reviewed under the user's normal authorization and security policy.

The current V1 grades and scores are experimental seed metadata, not a security audit.

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

See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/DESIGN_RADAR.md](docs/DESIGN_RADAR.md).

## Contributing

Issues, source corrections, new discovery adapters, ranking improvements, and safety rules are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

MIT. See [LICENSE](LICENSE).
