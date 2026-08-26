# Contributing to SkillRadar

Contributions are welcome for skill sources, design-field classification, ranking signals, security rules, discovery adapters, UI improvements, Codex routing behavior, installation reports, and real-world routing feedback.

You do not need to write code to contribute. A reproducible install failure, an irrelevant Top-3 result, an explicit capability gap, or a short report explaining how SkillRadar behaved on a real task is useful project evidence.

## Fastest ways to help

- **Install problem:** open the `Install problem` issue template with your environment, command, and safe-to-share error text.
- **Routing gap or wrong match:** open the `Routing gap or wrong match` template with the task and returned Top-3/capability-gap output.
- **Real usage feedback:** open the `User feedback` template and say what you tried, what happened, and what would make you use SkillRadar again.
- **Code/data contribution:** open a PR for discovery sources, safety fixtures, routing benchmarks, taxonomy, UI, docs, or compatibility improvements.

Do not paste API keys, tokens, credentials, private source code, or other sensitive data into public Issues or PRs.

## Principles

1. Use real public skill sources. Do not invent repositories, install counts, users, or security claims.
2. Treat ranking changes as evidence-driven and explain the signal being changed.
3. New radar discoveries should enter the normal safety and quality pipeline before displacing stable candidates.
4. Discovery never authorizes execution. Do not add workflows that execute arbitrary third-party skill scripts.
5. Keep the active Codex skill set small; SkillRadar is a retrieval layer, not a reason to install everything.
6. Never relax D/Blocked filtering or technology-specific routing evidence just to make a demo, benchmark, or adoption metric look better.

## Before opening a PR

```bash
npm run validate
npm run benchmark:router
```

For changes to the daily discovery pipeline, also run:

```bash
GITHUB_TOKEN=... npm run radar
npm run validate
```

Do not commit personal access tokens or other secrets.

## Adoption evidence

See [`docs/ADOPTION.md`](docs/ADOPTION.md) for the project's rules on public adoption metrics. Maintainer activity, CI smoke tests, fake accounts, estimated install counts, and synthetic feedback do not count as external adoption.
