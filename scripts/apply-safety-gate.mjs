import fs from 'node:fs/promises'

const read = async (p) => JSON.parse(await fs.readFile(p, 'utf8'))
const write = async (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2) + '\n')

const skillsPath = 'data/design-skills-radar.json'
const indexPath = 'data/design-skill-index.json'
const latestPath = 'data/radar-latest.json'

const all = await read(skillsPath)
const safe = all.filter((s) => !['D', 'Blocked'].includes(s.security))
const removed = all.filter((s) => ['D', 'Blocked'].includes(s.security))
await write(skillsPath, safe)

const index = await read(indexPath)
index.radarCount = safe.length
index.count = Number(index.seedCount || 0) + safe.length
index.safetyGatedCount = removed.length
await write(indexPath, index)

const latest = await read(latestPath)
latest.activeCount = safe.length
latest.safetyGate = {
  policy: 'D and Blocked candidates remain auditable but are excluded from the Codex routing registry',
  excludedCount: removed.length,
  excluded: removed.map((s) => ({ id: s.id, security: s.security }))
}
await write(latestPath, latest)

console.log(`Safety gate: ${safe.length} routable, ${removed.length} excluded.`)
