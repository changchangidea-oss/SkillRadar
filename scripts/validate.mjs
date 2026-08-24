import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const html = fs.readFileSync('index.html','utf8')
const skills = JSON.parse(fs.readFileSync('data/skills.json','utf8'))
const designManifest = JSON.parse(fs.readFileSync('data/design-skill-index.json','utf8'))
const designSkills = designManifest.chunks.flatMap(f=>JSON.parse(fs.readFileSync(`data/${f}`,'utf8')))
const seedDomains = JSON.parse(fs.readFileSync('data/design-seed-baseline.json','utf8'))
const liveDomains = JSON.parse(fs.readFileSync('data/design-domains.json','utf8'))
const radar = JSON.parse(fs.readFileSync('data/radar-latest.json','utf8'))
const registry = JSON.parse(fs.readFileSync('data/radar-registry.json','utf8'))
const history = JSON.parse(fs.readFileSync('data/ranking-history.json','utf8'))
const manifest = JSON.parse(fs.readFileSync('packages/codex-plugin/.codex-plugin/plugin.json','utf8'))

const errors=[]
if(!html.includes('<title>SkillRadar')) errors.push('index.html: missing SkillRadar title')
if(!html.includes("id='designRadar'")) errors.push('index.html: missing Design Radar')
if(!Array.isArray(skills)||skills.length<10) errors.push('core registry unexpectedly small')
if(!Array.isArray(seedDomains)||seedDomains.length!==12) errors.push('seed baseline: expected 12 design fields')
if(!Array.isArray(liveDomains)||liveDomains.length!==12) errors.push('live domains: expected 12 design fields')
if(!designManifest.chunks.includes('design-skills-radar.json')) errors.push('manifest: missing generated radar chunk')
if(designSkills.length!==designManifest.count) errors.push(`manifest count mismatch ${designManifest.count} vs ${designSkills.length}`)
const ids=designSkills.map(x=>x.id)
if(new Set(ids).size!==ids.length) errors.push('design registry: duplicate ids')
const idSet=new Set(ids)
for(const d of liveDomains){
  if(!Array.isArray(d.seedTop20)||d.seedTop20.length!==20) errors.push(`${d.id}: expected live Top20`)
  for(const r of d.seedTop20||[]){
    const id=Array.isArray(r)?r[0]:r.skillId
    if(!idSet.has(id)) errors.push(`${d.id}: ranking references missing skill ${id}`)
    const score=Array.isArray(r)?r[1]:r.seedScore
    if(typeof score!=='number'||score<0||score>100) errors.push(`${d.id}: invalid score for ${id}`)
    const skill=designSkills.find(s=>s.id===id)
    if(skill&&['D','Blocked'].includes(skill.security)) errors.push(`${d.id}: unsafe skill entered Top20 ${id}`)
  }
}
for(const s of designSkills){
  for(const k of ['id','name','source','summary','security','signalScore','installUrl'])
    if(s[k]===undefined||s[k]===null||s[k]==='') errors.push(`design skill ${s.id||'<unknown>'}: missing ${k}`)
  if(!['A','B','C','D','Blocked'].includes(s.security)) errors.push(`design skill ${s.id}: invalid security ${s.security}`)
  if(s.discovery==='github-radar'&&['D','Blocked'].includes(s.security)) errors.push(`routing registry contains unsafe radar skill ${s.id}`)
}
if(!radar.generatedAt||!Array.isArray(radar.pipeline)) errors.push('radar-latest: invalid pipeline metadata')
if(!registry.generatedAt||!Array.isArray(registry.candidates)) errors.push('radar-registry: invalid')
if(!Array.isArray(history.snapshots)||history.snapshots.length<1) errors.push('ranking-history: expected at least one snapshot')
if(manifest.name!=='skillradar') errors.push('plugin manifest: invalid name')
if(manifest.version!=='0.3.0') errors.push('plugin manifest: expected 0.3.0')
if(!fs.existsSync('packages/codex-plugin/scripts/skillradar.mjs')) errors.push('plugin: missing router')
for(const x of ['skill-router','find-skill','inspect-skill','manage-skills'])
  if(!fs.existsSync(`packages/codex-plugin/skills/${x}/SKILL.md`)) errors.push(`plugin: missing ${x}`)

const routeCases=['设计UI界面和design system','制作Remotion视频动效','工业设计3D打印产品建模','建筑可视化和室内空间渲染']
for(const task of routeCases){
  try{
    const raw=execFileSync(process.execPath,['packages/codex-plugin/scripts/skillradar.mjs','match',task],{encoding:'utf8',stdio:['ignore','pipe','pipe']})
    const result=JSON.parse(raw)
    const matches=result.matches||[]
    if(matches.length<1) errors.push(`router: no matches for ${task}`)
    if(!matches.some(x=>x.category==='Design')) errors.push(`router: no design skill for ${task}`)
    if(matches.some(x=>['D','Blocked'].includes(x.security))) errors.push(`router: unsafe result for ${task}`)
  }catch(e){ errors.push(`router smoke failed for ${task}: ${String(e.message||e)}`) }
}

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`SkillRadar validation passed: ${skills.length} core, ${designSkills.length} design, ${registry.candidates.length} radar candidates, ${liveDomains.length} live domains, plugin ${manifest.version}, ${routeCases.length} Codex routes.`)
