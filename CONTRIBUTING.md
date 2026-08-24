# Contributing to SkillRadar

Contributions are welcome for skill sources, design-field classification, ranking signals, security rules, discovery adapters, UI improvements, and Codex routing behavior.

## Principles

1. Use real public skill sources. Do not invent repositories, install counts, or security claims.
2. Treat seed rankings as experimental and explain the ranking signal when changing them.
3. New radar discoveries should enter New & Rising before displacing stable Top 20 seeds unless there is strong evidence.
4. Discovery never authorizes execution. Do not add workflows that execute arbitrary third-party skill scripts.
5. Keep the active Codex skill set small; SkillRadar is a retrieval layer, not a reason to install everything.

## Before opening a PR

```bash
npm run validate
```

For changes to the daily discovery pipeline, also run:

```bash
GITHUB_TOKEN=... npm run radar
npm run validate
```

Do not commit personal access tokens or other secrets.
