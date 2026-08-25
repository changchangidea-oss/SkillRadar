---
name: manage-skills
description: Audit Codex skill-context pressure, detect duplicate capabilities, and produce a read-only pruning plan for global, project and plugin-provided skills.
---
# Manage Skills

Use SkillRadar's **Skill Budget Doctor** to keep the model-visible skill catalog compact without blindly deleting useful capabilities.

## Required workflow
1. Run the bundled read-only doctor first:
   `node ../../scripts/skill-budget.mjs audit '<current project or task focus>'`
2. Report these fields before recommending changes:
   - `budget.pressure`, `budget.used`, `budget.limit`, and `budget.ratio`;
   - active/discovered skill counts;
   - near-duplicate groups and which skill is the preferred keeper;
   - the projected ratio after the proposed pruning plan.
3. Use the doctor's `recommendations` as a plan, not as permission to edit configuration.
4. Prefer disabling a redundant skill with `[[skills.config]]` over uninstalling a whole plugin when other capabilities from that plugin remain useful.
5. Only suggest `codex plugin remove ...` when the doctor reports a `plugin_suggestion`, and make clear that plugin removal requires explicit user approval.
6. If the user explicitly approves applying the plan, back up `~/.codex/config.toml`, reconcile the recommended `[[skills.config]]` entries, and do not change unrelated settings.
7. Re-run the audit after changes and start a fresh Codex thread so the model-visible skills catalog is rebuilt.

## Codex budget reference
The doctor mirrors current Codex behavior conservatively: the fallback metadata budget is 8,000 characters; when `skills.max_context_tokens` is configured it uses that token budget up to Codex's 10,000-token cap; individual descriptions are capped at 1,024 characters for the estimate.

## Scope guidance
- Keep broadly reusable skills global only when they are actually used across projects.
- Prefer project scope for stack-specific or discipline-specific skills.
- Keep one strong skill instead of several near-duplicates that solve the same task.
- Local/project relevance is a pruning signal, not proof that a skill is useless globally.
- Use `find-skill` before adding a capability and `inspect-skill` before trusting third-party scripts.

## Safety
The doctor is read-only. It does not disable skills, edit config, uninstall plugins, install skills, or execute discovered third-party scripts. Discovery and diagnosis are not execution permissions.
