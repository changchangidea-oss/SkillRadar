import fs from 'node:fs'

const html = fs.readFileSync('index.html', 'utf8')
const skills = JSON.parse(fs.readFileSync('data/skills.json', 'utf8'))
const designSkills = JSON.parse(fs.readFileSync('data/design-skills.json', 'utf8'))
const designDomains = JSON.parse(fs.readFileSync('data/design-domains.json', 'utf8'))
const radar = JSON.parse(fs.readFileSync('data/radar-latest.json', 'utf8'))
const manifest = JSON.parse(fs.readFileSync('packages/codex-plugin/.codex-plugin/plugin.json', 'utf8'))

const errors = []
if (!html.includes('<title>SkillRadar')) errors.push('index.html: missing SkillRadar title')
if (!html.includes("id='designRadar'")) errors.push('index.html: missing Design Radar view')
if (!Array.isArray(skills) || skills.length < 10) errors.push('data/skills.json: seed registry unexpectedly small')
if (!Array.isArray(designSkills) || designSkills.length < 50) errors.push('data/design-skills.json: design seed pool unexpectedly small')
if (!Array.isArray(designDomains) || designDomains.length < 12) errors.push('data/design-domains.json: expected 12 design fields')
const ids = skills.map((s) => s.id)
if (new Set(ids).size !== ids.length) errors.push('data/skills.json: duplicate ids')
const designIds = designSkills.map((s) => s.id)
if (new Set(designIds).size !== designIds.length) errors.push('data/design-skills.json: duplicate ids')
const designIdSet = new Set(designIds)
for (const d of designDomains) {
  if (!Array.isArray(d.seedTop20) || d.seedTop20.length !== 20) errors.push(`design domain ${d.id}: expected exactly 20 seed skills`)
  for (const r of d.seedTop20 || []) if (!designIdSet.has(r.skillId)) errors.push(`design domain ${d.id}: missing referenced skill ${r.skillId}`)
}
for (const s of skills) {
  for (const key of ['id','name','category','summary','security','score']) {
    if (s[key] === undefined || s[key] === null || s[key] === '') errors.push(`skill ${s.id || '<unknown>'}: missing ${key}`)
  }
  if (!['A','B','C','D','Blocked'].includes(s.security)) errors.push(`skill ${s.id}: invalid security grade`)
  if (typeof s.score !== 'number' || s.score < 0 || s.score > 100) errors.push(`skill ${s.id}: invalid score`)
}
for (const s of designSkills) {
  for (const key of ['id','name','source','summary','security','signalScore','installUrl']) if (s[key] === undefined || s[key] === null || s[key] === '') errors.push(`design skill ${s.id || '<unknown>'}: missing ${key}`)
}
if (!radar.generatedAt) errors.push('data/radar-latest.json: missing generatedAt')
if (manifest.name !== 'skillradar') errors.push('plugin manifest: invalid name')
if (manifest.version !== '0.2.0') errors.push('plugin manifest: expected 0.2.0')
for (const p of ['skill-router','find-skill','inspect-skill','manage-skills']) {
  if (!fs.existsSync(`packages/codex-plugin/skills/${p}/SKILL.md`)) errors.push(`plugin: missing ${p}`)
}
for (const p of ['design-skills.json','design-domains.json']) if (!fs.existsSync(`packages/codex-plugin/data/${p}`)) errors.push(`plugin: missing ${p}`)

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`SkillRadar validation passed: ${skills.length} core skills, ${designSkills.length} design seeds, ${designDomains.length} design fields, plugin ${manifest.version}.`)
