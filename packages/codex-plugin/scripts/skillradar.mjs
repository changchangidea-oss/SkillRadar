#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const base = (process.env.SKILLRADAR_BASE_URL || '').replace(/\/$/, '')
const [cmd, ...rest] = process.argv.slice(2)
const value = rest.join(' ').trim()
const RAW = 'https://raw.githubusercontent.com/changchangidea-oss/SkillRadar/main/data'

if (!cmd || !value || !['search', 'match', 'inspect'].includes(cmd)) {
  console.error('Usage: skillradar.mjs search|match|inspect <query>')
  process.exit(2)
}

function readJson(paths) {
  for (const p of paths) {
    try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8')) } catch {}
  }
  return null
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'SkillRadar-Codex-Plugin/0.2' } })
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
  return r.json()
}

async function loadRegistry() {
  const localRoots = [path.resolve(here, '../data'), path.resolve(here, '../../../data')]
  let core = readJson(localRoots.map(r => path.join(r, 'skills.json')))
  let manifest = readJson(localRoots.map(r => path.join(r, 'design-skill-index.json')))
  let design = []
  if (manifest) {
    for (const file of manifest.chunks) {
      const part = readJson(localRoots.map(r => path.join(r, file)))
      if (part) design.push(...part)
    }
  }
  if (!core) core = await fetchJson(`${RAW}/skills.json`)
  if (!manifest) manifest = await fetchJson(`${RAW}/design-skill-index.json`)
  if (!design.length) {
    for (const file of manifest.chunks) design.push(...await fetchJson(`${RAW}/${file}`))
  }
  const mapped = design.map(s => ({
    id:s.id,name:s.name,source:s.source,category:'Design',tags:s.tags||[],summary:s.summary,
    security:s.security||'B',score:s.signalScore||70,installs:s.installs||0,installUrl:s.installUrl,skillsUrl:s.skillsUrl
  }))
  const seen = new Set()
  return [...core, ...mapped].filter(s => !seen.has(s.id) && seen.add(s.id))
}

function tokens(text) {
  const raw = String(text).toLowerCase()
  const out = new Set(raw.split(/[^a-z0-9+#.-]+/).filter(x=>x.length>1))
  const zh = {
    'ui':['ui','interface','design-system','layout'],'界面':['ui','interface','layout'],
    '视觉':['visual','graphic','typography','brand','layout'],'海报':['visual','graphic','typography','layout'],'品牌':['brand','visual','campaign'],
    '运营':['operations','campaign','marketing','brand'],'广告':['campaign','product','brand','video'],'电商':['ecommerce','product','photo'],
    '视频':['video','motion','editing','film'],'剪辑':['video','editing','montage'],'动效':['motion','animation','video'],'分镜':['storyboard','video','film'],
    '工业':['industrial','product','3d','cad'],'产品设计':['industrial','product','3d'],'3d打印':['3d-printing','fabrication','3d'],'建模':['3d','modeling','cad'],
    '环艺':['interior','environment','spatial','architecture'],'室内':['interior','spatial','lighting'],'景观':['landscape','environment','spatial'],
    '服装':['fashion','color','photo','campaign'],'时尚':['fashion','brand','photo'],
    '体验':['ux','product','research','interaction'],'用户体验':['ux','research','usability'],'交互':['interaction','ux','ui'],
    '数媒':['digital-media','creative-coding','video','3d'],'影视':['film','video','editing','vfx'],
    '工艺':['craft','fabrication','vector','3d-printing'],'民间艺术':['illustration','hand-drawn','collage','pattern','craft'],'纹样':['pattern','illustration','vector'],
    '建筑':['architecture','spatial','3d','rendering','diagram'],'建筑可视化':['architecture','rendering','3d','lighting']
  }
  for (const [needle,tags] of Object.entries(zh)) if (raw.includes(needle)) tags.forEach(t=>out.add(t))
  return out
}

function scoreSkill(s, query) {
  const q=tokens(query); const hay=`${s.name} ${s.category} ${(s.tags||[]).join(' ')} ${s.summary}`.toLowerCase()
  let hit=0, special=0
  const specialty=new Set(['fashion','industrial','architecture','interior','landscape','3d-printing','fabrication','cad','video','film','storyboard','vfx','ux','usability','digital-media','craft','pattern'])
  for (const t of q) if (hay.includes(t)) { const sp=specialty.has(t); hit+=sp?4:(t.length>5?2:1); if(sp) special++ }
  const sec=s.security==='A'?8:s.security==='B'?5:s.security==='C'?1:-8
  return { ...s, match_score:Math.max(0,Math.min(100,Math.round(hit*9+(s.score||70)*.30+sec))), specialty_hits:special }
}

async function localResult() {
  const registry=await loadRegistry()
  if (cmd==='inspect') {
    const id=value.toLowerCase(); const skill=registry.find(s=>s.id.toLowerCase()===id||s.name.toLowerCase()===id)
    if (!skill) throw new Error(`Skill not found: ${value}`)
    return {source:'skillradar-registry',skill}
  }
  const ranked=registry.map(s=>scoreSkill(s,value)).filter(s=>cmd==='match'||s.match_score>20).sort((a,b)=>b.match_score-a.match_score||b.specialty_hits-a.specialty_hits||(b.score||0)-(a.score||0))
  return cmd==='match'?{source:'skillradar-registry',matches:ranked.slice(0,3)}:{source:'skillradar-registry',skills:ranked.slice(0,8)}
}

async function remote() {
  if (!base) return null
  if (cmd==='match') {
    const r=await fetch(`${base}/api/router`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task:value,agent:'codex',limit:3})})
    if(!r.ok) throw new Error(`remote ${r.status}`); return r.json()
  }
  const endpoint=cmd==='inspect'?`/api/skill?id=${encodeURIComponent(value)}`:`/api/skills?q=${encodeURIComponent(value)}&limit=8`
  const r=await fetch(base+endpoint); if(!r.ok) throw new Error(`remote ${r.status}`); return r.json()
}

try {
  if (base) { try { console.log(JSON.stringify(await remote(),null,2)); process.exit(0) } catch(e){ console.error(`Remote lookup failed; falling back to registry: ${e.message}`) } }
  console.log(JSON.stringify(await localResult(),null,2))
} catch(e) { console.error(e.message); process.exit(1) }
