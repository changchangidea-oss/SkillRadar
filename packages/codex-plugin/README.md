# SkillRadar Codex Plugin

The full Codex integration for SkillRadar. It routes tasks to a small, safety-aware skill shortlist using the same registry published by the open-source web UI.

## Install from GitHub

```bash
codex plugin marketplace add changchangidea-oss/SkillRadar --ref v0.3.0 && codex plugin add skillradar@skillradar
```

This repository contains `.agents/plugins/marketplace.json`, so Codex can materialize the plugin directly from GitHub.

After installation, start a **new Codex thread** so the newly installed plugin/skills are discovered cleanly.

## Included skills

- `skill-router` — task → Top-3 skill shortlist
- `find-skill` — search registry by task, technology or design domain
- `inspect-skill` — provenance, quality and safety inspection
- `manage-skills` — keep project/global skill sets intentionally small

## Safety

The plugin never treats discovery as permission to execute. D and Blocked Radar candidates are excluded from the generated routing shard and filtered again at runtime.
