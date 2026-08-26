import crypto from 'node:crypto'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const html = fs.readFileSync('index.html','utf8')
const rootPackage = JSON.parse(fs.readFileSync('package.json','utf8'))
const skills = JSON.parse(fs.readFileSync('data/skills.json','utf8'))
const designManifest = JSON.parse(fs.readFileSync('data/design-skill-index.json','utf8'))
const designSkills = designManifest.chunks.flatMap(f=>JSON.parse(fs.readFileSync(`data/${f}`,'utf8')))
const generalDomains = JSON.parse(fs.readFileSync('data/general-domains.json','utf8'))
const generalSkills = JSON.parse(fs.readFileSync('data/general-skills-radar.json','utf8'))
const generalLatest = JSON.parse(fs.readFileSync('data/general-radar-latest.json','utf8'))
const generalRegistry = JSON.parse(fs.readFileSync('data/general-radar-registry.json','utf8'))
const seedDomains = JSON.parse(fs.readFileSync('data/design-seed-baseline.json','utf8'))
const liveDomains = JSON.parse(fs.readFileSync('data/design-domains.json','utf8'))
const radar = JSON.parse(fs.readFileSync('data/radar-latest.json','utf8'))
const registry = JSON.parse(fs.readFileSync('data/radar-registry.json','utf8'))
const history = JSON.parse(fs.readFileSync('data/ranking-history.json','utf8'))
const manifest = JSON.parse(fs.readFileSync('packages/codex-plugin/.codex-plugin/plugin.json','utf8'))
const bundledPath = 'packages/codex-plugin/data/registry.json'
const bundled = fs.existsSync(bundledPath) ? JSON.parse(fs.readFileSync(bundledPath,'utf8')) : null

const errors=[]
const canonical=s=>`${String(s.source||'').toLowerCase()}::${String(s.name||s.id||'').toLowerCase().replace(/[^a-z0-9]+/g,'')}`
function uniqueInto(list,seen){const out=[];for(const s of list){const key=canonical(s);if(!key||seen.has(key))continue;seen.add(key);out.push(s)}return out}

if(!html.includes('<title>SkillRadar')) errors.push('index.html: missing SkillRadar title')
if(!html.includes("id='designRadar'")) errors.push('index.html: missing Design Radar')
if(!Array.isArray(skills)||skills.length<10) errors.push('core registry unexpectedly small')
if(!Array.isArray(seedDomains)||seedDomains.length!==12) errors.push('seed baseline: expected 12 design fields')
if(!Array.isArray(liveDomains)||liveDomains.length!==12) errors.push('live domains: expected 12 design fields')
if(!Array.isArray(generalDomains)||generalDomains.length!==11) errors.push('general taxonomy: expected 11 domains')
if(!generalDomains.some(domain=>domain.id==='design-media')) errors.push('general taxonomy: missing design-media domain')
if(!Array.isArray(generalSkills)) errors.push('general routing shard: expected array')
if(!Array.isArray(generalRegistry.candidates)) errors.push('general audit registry: expected candidates array')
const latestTaxonomyCount=Number(generalLatest.taxonomyDomains)
const taxonomyExpansionPending=latestTaxonomyCount===10&&generalDomains.length===11&&generalDomains.some(domain=>domain.id==='design-media')
if(latestTaxonomyCount!==generalDomains.length&&!taxonomyExpansionPending) errors.push('general coverage metrics: taxonomy domain count mismatch')
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
  for(const k of ['id','name','source','summary','security','signalScore','installUrl']) if(s[k]===undefined||s[k]===null||s[k]==='') errors.push(`design skill ${s.id||'<unknown>'}: missing ${k}`)
  if(!['A','B','C','D','Blocked'].includes(s.security)) errors.push(`design skill ${s.id}: invalid security ${s.security}`)
  if(s.discovery==='github-radar'&&['D','Blocked'].includes(s.security)) errors.push(`routing registry contains unsafe radar skill ${s.id}`)
}
const scanProvenanceEnforced=Object.prototype.hasOwnProperty.call(generalLatest,'unverifiedRetained')
for(const s of generalSkills){
  for(const k of ['id','name','source','summary','security','signalScore','installUrl']) if(s[k]===undefined||s[k]===null||s[k]==='') errors.push(`general skill ${s.id||'<unknown>'}: missing ${k}`)
  if(!['A','B','C'].includes(s.security)) errors.push(`general routing shard contains unsafe grade ${s.security} for ${s.id}`)
  if(s.discovery!=='github-general-radar') errors.push(`general skill ${s.id}: unexpected discovery channel ${s.discovery}`)
  if(scanProvenanceEnforced){
    if(s.scriptScan?.complete!==true) errors.push(`general skill ${s.id}: live routing requires complete script scan provenance`)
    if(Number(s.scriptScan?.total)!==Number(s.scriptScan?.scanned)) errors.push(`general skill ${s.id}: script scan count mismatch ${s.scriptScan?.scanned}/${s.scriptScan?.total}`)
  }
}
if(!radar.generatedAt||!Array.isArray(radar.pipeline)) errors.push('radar-latest: invalid pipeline metadata')
if(!registry.generatedAt||!Array.isArray(registry.candidates)) errors.push('radar-registry: invalid')
if(!Array.isArray(history.snapshots)||history.snapshots.length<1) errors.push('ranking-history: expected at least one snapshot')
if(manifest.name!=='skillradar') errors.push('plugin manifest: invalid name')
if(manifest.version!==rootPackage.version) errors.push(`plugin manifest version ${manifest.version} does not match package version ${rootPackage.version}`)
for(const p of ['packages/codex-plugin/scripts/skillradar.mjs','packages/codex-plugin/scripts/skill-budget.mjs']) if(!fs.existsSync(p)) errors.push(`plugin: missing ${p}`)
for(const x of ['skill-router','find-skill','inspect-skill','manage-skills']) if(!fs.existsSync(`packages/codex-plugin/skills/${x}/SKILL.md`)) errors.push(`plugin: missing ${x}`)

if(!bundled){
  errors.push('plugin: bundled registry missing; run npm run sync:plugin-registry')
}else{
  const seen=new Set(),expectedCore=uniqueInto(skills,seen),expectedDesign=uniqueInto(designSkills,seen),expectedGeneral=uniqueInto(generalSkills,seen)
  const expectedHash=crypto.createHash('sha256').update(JSON.stringify({core:expectedCore,design:expectedDesign,general:expectedGeneral})).digest('hex')
  if(bundled.schemaVersion!==2) errors.push(`plugin bundle: expected schema v2, got ${bundled.schemaVersion}`)
  if(bundled.coreCount!==expectedCore.length) errors.push(`plugin bundle: core count mismatch ${bundled.coreCount} vs ${expectedCore.length}`)
  if(bundled.designCount!==expectedDesign.length) errors.push(`plugin bundle: design count mismatch ${bundled.designCount} vs ${expectedDesign.length}`)
  if(bundled.generalCount!==expectedGeneral.length) errors.push(`plugin bundle: general count mismatch ${bundled.generalCount} vs ${expectedGeneral.length}`)
  if(bundled.totalCount!==expectedCore.length+expectedDesign.length+expectedGeneral.length) errors.push('plugin bundle: total count mismatch')
  if(bundled.contentHash!==expectedHash) errors.push('plugin bundle: content hash does not match deduplicated source registry')
  if([...(bundled.design||[]),...(bundled.general||[])].some(x=>['D','Blocked'].includes(x.security))) errors.push('plugin bundle: unsafe discovered skill included')
  if(scanProvenanceEnforced&&(bundled.general||[]).some(x=>x.scriptScan?.complete!==true||Number(x.scriptScan?.total)!==Number(x.scriptScan?.scanned))) errors.push('plugin bundle: general skill without complete script scan provenance included')
}

const routeCases=['设计UI界面和design system','制作Remotion视频动效','工业设计3D打印产品建模','建筑可视化和室内空间渲染','Next.js React shadcn/ui AI dashboard streaming tool calling App Router']
for(const task of routeCases){
  try{
    const raw=execFileSync(process.execPath,['packages/codex-plugin/scripts/skillradar.mjs','match',task],{encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,SKILLRADAR_OFFLINE:'1',SKILLRADAR_PROJECT_CONTEXT:'0'}})
    const result=JSON.parse(raw),matches=result.matches||[]
    if(result.source!=='skillradar-registry') errors.push(`router: wrong source for ${task}`)
    if(result.registry?.mode!=='local-bundled') errors.push(`router: expected local-bundled mode for ${task}`)
    if(result.ranking?.version!=='2.1') errors.push(`router: expected ranking v2.1 for ${task}`)
    if(result.context?.mode!=='task-only') errors.push(`router: task-only validation unexpectedly used project context for ${task}`)
    if(matches.length<1) errors.push(`router: no matches for ${task}`)
    if(matches.some(x=>['D','Blocked'].includes(x.security))) errors.push(`router: unsafe result for ${task}`)
    for(const x of matches){
      for(const key of ['match_score','skillradar_score','security','source','reason','match_details']) if(x[key]===undefined||x[key]===null||x[key]==='') errors.push(`router: ${x.id} missing ${key}`)
      if(x.match_details?.ranking_version!=='2.1') errors.push(`router: ${x.id} missing ranking v2.1 details`)
      if(x.match_details?.project_context_bonus===undefined) errors.push(`router: ${x.id} missing project context evidence`)
    }
    const top=matches[0],closeSafe=matches.slice(1).find(x=>['A','B'].includes(x.security)&&top&&top.match_score-x.match_score<=5)
    if(top?.security==='C'&&closeSafe&&!result.advisory) errors.push(`router: C-grade Top1 missing safer alternative advisory for ${task}`)
  }catch(e){ errors.push(`router smoke failed for ${task}: ${String(e.message||e)}`) }
}

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log(`SkillRadar validation passed: ${skills.length} core, ${designSkills.length} design, ${generalSkills.length} general, ${registry.candidates.length} design Radar candidates, plugin ${manifest.version}, ranking v2.1, ${routeCases.length} offline routes.`)
