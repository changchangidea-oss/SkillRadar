# SkillRadar Adoption Evidence

SkillRadar tracks adoption to learn whether the project is useful outside its maintainer workflow. Adoption metrics are evidence, not ranking inputs and not a reason to weaken security or routing quality gates.

## What counts

Public, independently verifiable signals may include:

- GitHub Stars and Forks;
- unique external issue authors and pull-request authors;
- public usage/feedback issues;
- public references from other repositories or documentation;
- package/plugin/skill install counts when the distribution platform exposes a real count;
- inclusion in public Agent Skills indexes or curated lists;
- public demos, posts, or discussions from people other than the maintainer.

## What does not count

Do not manufacture or inflate adoption evidence. In particular:

- do not buy or exchange Stars;
- do not create fake accounts or synthetic users;
- do not count CI smoke tests as user installs;
- do not count maintainer installs as external adoption;
- do not infer a numeric install count when a platform does not expose one;
- do not create fake Issues, PRs, comments, or testimonials;
- do not weaken D/Blocked filtering, security grades, routing specificity, or benchmark gates to make demos look better.

## skills.sh evidence

SkillRadar's standard Agent Skill can be discovered by the `skills` CLI from `skills/skillradar/SKILL.md`.

The skills.sh directory does not require a manual submission request. Its public documentation says Skills appear on the leaderboard automatically after real users install a repository with the `skills` CLI, and those anonymous install signals are used for leaderboard counts.

skills.sh also exposes an official API whose Skill objects include a deduplicated `installs` count. That API currently requires Vercel OIDC authentication. SkillRadar's GitHub Actions pipeline does not have that credential, so the daily adoption snapshot must leave `skillsShInstalls` as `unknown` rather than scrape, estimate, or manufacture a count.

Public references:

- directory: `https://skills.sh/changchangidea-oss/SkillRadar`
- install-count badge: `https://skills.sh/b/changchangidea-oss/SkillRadar`
- install command: `npx skills add changchangidea-oss/SkillRadar --skill skillradar`

A CI discovery/smoke test is not an external install and must not be counted as adoption.

## Public adoption snapshot

When an adoption snapshot is published, record:

- timestamp in UTC;
- repository Stars and Forks;
- number of distinct external Issue/PR/feedback authors;
- install counts only from sources that expose a verifiable number and are available to the evidence pipeline;
- index/list inclusions with a public source;
- links to public usage evidence.

The snapshot should distinguish `maintainer`, `automation`, and `external` activity wherever possible.

## First milestone

The initial external-use milestone is intentionally modest:

- 20–50 real GitHub Stars;
- at least 5 external users with public evidence where possible;
- at least 10 real plugin/release/skill installs when a platform exposes verifiable install data;
- at least 1–3 external Issues, PRs, or feedback reports.

These are project goals, not OpenAI eligibility requirements and not claims about any third-party program's acceptance threshold.

## Maintainer rule

If a metric cannot be verified by the evidence pipeline, publish `unknown` rather than estimating it. The project should prefer a small honest number over a large unverifiable one.
