# Design Skill Radar

SkillRadar 0.2 adds a design-focused discovery layer for Codex and other Agent Skills compatible tools.

## Design fields

The UI currently maintains 12 independent fields:

1. UI Design
2. Visual Communication
3. Operations Design
4. Video Design
5. Industrial Design
6. Environmental Design
7. Fashion Design
8. Experience Design
9. Digital Media & Film
10. Arts & Crafts
11. Folk Art
12. Architecture Design

Each field starts with a curated Top 20 seed set drawn from real open-source Agent Skills. The seed pool is deliberately reusable across fields: a strong color, typography, Blender, Remotion, SVG or UX skill can legitimately rank in more than one design discipline.

## Seed ranking

The first ranking is not presented as an official global ranking. It is a SkillRadar bootstrap score combining:

- Domain relevance — 65% of the ranking formula before safety bonus
- Usage / install signal — 25%
- Safety grade bonus — 10 points for A, lower for other grades

The seed pool uses public evidence collected from skills.sh and GitHub on 2026-08-24. Install counts change continuously and are used as a signal, not as proof of quality.

## Daily Radar

`.github/workflows/design-radar.yml` runs every day at 02:20 UTC (10:20 Beijing time).

The job executes `scripts/update-design-radar.mjs`, which:

1. Searches public GitHub repositories for each design field.
2. Prioritizes recently maintained repositories whose README mentions `SKILL.md`.
3. Recursively discovers actual `SKILL.md` files inside candidate repositories.
4. Scores candidates by domain keyword match, repository stars, and recency.
5. Writes the snapshot to `data/radar-latest.json`.
6. Commits the new snapshot only when data changed.

Radar candidates are intentionally separated from the trusted Seed Top 20. New skills first appear in **New & Rising**. They should only displace seed skills once future ranking versions have accumulated enough usage, safety and maintenance evidence.

## Future ranking inputs

When the hosted Vercel registry is enabled, SkillRadar can add the authenticated skills.sh API signals documented at `https://skills.sh/docs/api`, including all-time installs, trending, hot, detailed skill hashes and security audit partners.
