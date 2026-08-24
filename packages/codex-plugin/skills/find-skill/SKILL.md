---
name: find-skill
description: Search SkillRadar for agent skills by task, technology, design field, category, or tool. Use when the user asks to find, compare, discover, or recommend a skill.
---
# Find Skill

Run `node ../../scripts/skillradar.mjs search '<query>'`.

Return a concise shortlist with name, purpose, SkillRadar score, security grade, source and install URL. For design tasks, preserve the user's field intent (for example 海报、服装、建筑可视化、3D打印、视频动效) rather than collapsing everything into generic UI design. Prefer original or verified sources when equivalent copies exist. Do not install anything unless the user asked for installation.
