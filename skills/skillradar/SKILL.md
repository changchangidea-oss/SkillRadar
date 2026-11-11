---
name: skillradar
description: Discover, inspect, safety-check, and rank open Agent Skills before installing them. Use when an agent needs to find a skill for a task, compare candidate skills, inspect provenance or risk, or avoid loading large numbers of irrelevant skills.
---

# SkillRadar

Use SkillRadar as a **read-first discovery and safety layer** for Agent Skills.

## Core rule

**Discovery is not execution.** Never execute scripts, install packages, expose secrets, or write to external systems merely because a skill is popular or highly ranked.

## Workflow

1. Understand the user's explicit task and extract the smallest useful capability set.
2. Search the public SkillRadar safety-gated data, using all relevant shards rather than only the design index:
   - curated core: `https://raw.githubusercontent.com/changchangidea-oss/SkillRadar/main/data/skills.json`
   - design manifest: `https://raw.githubusercontent.com/changchangidea-oss/SkillRadar/main/data/design-skill-index.json`
   - general Agent Skills shard: `https://raw.githubusercontent.com/changchangidea-oss/SkillRadar/main/data/general-skills-radar.json`
   - discovery coverage: `https://raw.githubusercontent.com/changchangidea-oss/SkillRadar/main/data/general-radar-latest.json`
3. Prefer candidates with strong task relevance, recent maintenance, clear documentation, and acceptable safety grades. For multi-capability tasks, prefer a small set that covers distinct explicit task facets instead of three generic near-matches.
4. Treat `D` and `Blocked` candidates as audit-only. Do not recommend them for automatic routing.
5. For `C` candidates, clearly state why review is required before installation or use and prefer a nearby A/B alternative when task coverage is comparable.
6. Return at most three recommended skills unless the user explicitly asks for a broader list.
7. Before installation, show the source repository and explain any shell, network, secret, package-install, filesystem-write, git-write, or deploy capability that matters.

## Full Codex Plugin

The full Codex Plugin adds the bundled offline registry, Matching v2.1, bounded project-context evidence, the Router Quality Benchmark, and the Skill Budget Doctor. Follow the repository README for the current pinned release.

## Installation

For standard Agent Skills, use the ecosystem's normal installer only after user approval, for example:

```bash
npx skills add <owner/repo> --skill <skill-name>
```

For the full Codex Plugin, use the repository marketplace documented in the SkillRadar README.

## What not to do

- Do not equate GitHub stars with trust.
- Do not install dozens of skills “just in case.”
- Do not bypass the user's normal permission model.
- Do not execute a discovered skill as part of evaluating it.
- Do not recommend `D` or `Blocked` skills for automatic routing.
- Do not let inferred project context override the user's explicit task.

## 中文使用指导与工作流 (Chinese Usage & Workflow)

在中文环境或与中文编程智能体协同工作时：

1. **核心原则**：**发现 ≠ 执行**。严禁仅因为技能流行或得分高就自动执行脚本、安装依赖或读取系统机密。
2. **任务理解**：准确提炼中文任务中的技术栈（如 React、Next.js、FastAPI、Redis、Postgres、Flutter 等）与核心诉求（如“鉴权”、“数据库调优”、“端到端测试”、“海报设计”）。
3. **精准匹配 Top 3**：优先返回具备明确本体或任务证据支持的高信号技能组合。多能力复合任务应覆盖不同技术分面，而非 3 个泛化近义项。
4. **安全审查与缺口提示**：
   - A / B 级：推荐并可供安装前阅读；
   - C 级：必须明确提醒用户包含敏感操作（如网络、Shell、文件写入），若有相近的 A/B 候选优先提供安全替代；
   - D / Blocked 级：禁止自动推荐；
   - 当契合的专用技能不足 3 个时，诚实呈现能力缺口（Capability Gap），绝不使用无关技能填充。
5. **规范安装命令**：
   ```bash
   npx skills add <owner/repo> --skill <skill-name>
   ```

