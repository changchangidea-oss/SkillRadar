#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'

const [cmd='audit', ...rest] = process.argv.slice(2)
if (!['audit','plan'].includes(cmd)) {
  console.error('Usage: skill-budget.mjs audit|plan [project/task focus]')
  process.exit(2)
}
const focus = rest.join(' ').trim()
const home = os.homedir()
const codexHome = process.env.CODEX_HOME || path.join(home, '.codex')
const cwd = process.cwd()
const MAX_DESCRIPTION_CHARS = 1024
const DEFAULT_CHAR_BUDGET = 8000
const MAX_TOKEN_BUDGET = 10000
const BYTES_PER_TOKEN = 4
const stop = new Set('the a an and or for to of in on with from by is are be as this that use using skill skills agent codex plugin plugins when can should'.split(' '))
const protectedNames = new Set(['skill-router','find-skill','inspect-skill','manage-skills'])

function readText(file) { try { return fs.readFileSync(file, 'utf8') } catch { return '' } }
function uniq(xs) { return [...new Set(xs.filter(Boolean))] }
function hash(text) { return crypto.createHash('sha256').update(text).digest('hex').slice(0,16) }
function parseFrontmatter(md='') {
  const out={}; const m=md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/)
  if (!m) return out
  for (const line of m[1].split('\n')) {
    const x=line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/); if(!x) continue
    let v=x[2].trim(); if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1)
    out[x[1]]=v
  }
  return out
}
function tokens(text='') {
  return new Set(String(text).toLowerCase().replace(/next\.js/g,'nextjs').replace(/shadcn\/ui/g,'shadcn').split(/[^a-z0-9+#.-]+/).filter(x=>x.length>1&&!stop.has(x)))
}
function jaccard(a,b) {
  if(!a.size||!b.size) return 0
  let hit=0; for(const x of a) if(b.has(x)) hit++
  return hit/(a.size+b.size-hit)
}
function findSkillFiles(root, maxDepth=8) {
  const out=[]
  if(!root||!fs.existsSync(root)) return out
  const walk=(dir,depth)=>{
    if(depth>maxDepth) return
    let entries=[]; try{entries=fs.readdirSync(dir,{withFileTypes:true})}catch{return}
    for(const e of entries){
      if(['.git','node_modules','dist','build','.next'].includes(e.name)) continue
      const p=path.join(dir,e.name)
      if(e.isDirectory()) walk(p,depth+1)
      else if(e.isFile()&&/^SKILL\.md$/i.test(e.name)) out.push(p)
    }
  }
  walk(root,0); return out
}
function installedPluginRoots() {
  if(process.env.SKILLRADAR_SKILL_ROOTS) return []
  try {
    const raw=execFileSync('codex',['plugin','list'],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:12000})
    const rows=[]
    for(const line of raw.split('\n')){
      const parts=line.trim().split(/\s{2,}/)
      if(parts.length<3||parts[1]!=='installed, enabled'||!parts[0].includes('@')) continue
      const pluginId=parts[0]
      const pluginPath=parts.at(-1)
      if(pluginPath&&path.isAbsolute(pluginPath)&&fs.existsSync(pluginPath)) rows.push({pluginId,path:pluginPath})
    }
    return rows
  } catch { return [] }
}
function explicitRoots() {
  const raw=process.env.SKILLRADAR_SKILL_ROOTS
  if(!raw) return null
  return raw.split(path.delimiter).map(x=>x.trim()).filter(Boolean).map((p,i)=>({path:path.resolve(p),scope:'explicit',pluginId:null,label:`explicit-${i+1}`}))
}
function defaultRoots() {
  const roots=[
    {path:path.join(codexHome,'skills'),scope:'user',pluginId:null,label:'user-skills'},
    {path:path.join(cwd,'.codex','skills'),scope:'project',pluginId:null,label:'project-codex-skills'},
    {path:path.join(cwd,'.agents','skills'),scope:'project',pluginId:null,label:'project-agent-skills'}
  ]
  for(const p of installedPluginRoots()) roots.push({path:p.path,scope:'plugin',pluginId:p.pluginId,label:p.pluginId})
  const seen=new Set(); return roots.filter(r=>fs.existsSync(r.path)&&!seen.has(path.resolve(r.path))&&seen.add(path.resolve(r.path)))
}
function disabledConfig() {
  const text=readText(path.join(codexHome,'config.toml'))
  const disabledNames=new Set(); const disabledPaths=new Set()
  for(const block of text.split(/\[\[skills\.config\]\]/g).slice(1)){
    const enabled=block.match(/\benabled\s*=\s*(true|false)/)?.[1]
    if(enabled!=='false') continue
    const name=block.match(/\bname\s*=\s*["']([^"']+)["']/)?.[1]
    const p=block.match(/\bpath\s*=\s*["']([^"']+)["']/)?.[1]
    if(name) disabledNames.add(name); if(p) disabledPaths.add(path.resolve(p))
  }
  const maxTokens=Number(text.match(/\bmax_context_tokens\s*=\s*(\d+)/)?.[1]||0)
  return {disabledNames,disabledPaths,maxTokens:maxTokens>0?Math.min(MAX_TOKEN_BUDGET,maxTokens):null}
}
function projectFingerprint() {
  const parts=[focus,path.basename(cwd)]
  try {
    const pkg=JSON.parse(readText(path.join(cwd,'package.json'))||'{}')
    parts.push(pkg.name||'',...Object.keys(pkg.dependencies||{}),...Object.keys(pkg.devDependencies||{}))
  } catch {}
  try { parts.push(...fs.readdirSync(cwd).slice(0,80)) } catch {}
  return tokens(parts.join(' '))
}
function scopeFor(file,roots) {
  const abs=path.resolve(file)
  const matches=roots.filter(r=>abs===r.path||abs.startsWith(r.path+path.sep)).sort((a,b)=>b.path.length-a.path.length)
  return matches[0]||{scope:'unknown',pluginId:null,label:'unknown',path:''}
}
function lineCosts(name,description,file) {
  const d=String(description||'').slice(0,MAX_DESCRIPTION_CHARS)
  const line=`- ${name}: ${d} (file: ${file})\n`
  return {chars:[...line].length,tokens:Math.ceil(Buffer.byteLength(line,'utf8')/BYTES_PER_TOKEN),descriptionChars:[...d].length}
}
function configSnippet(skill,nameCounts) {
  const usePath=(nameCounts.get(skill.name)||0)>1
  if(usePath) return `[[skills.config]]\npath = ${JSON.stringify(skill.path)}\nenabled = false`
  return `[[skills.config]]\nname = ${JSON.stringify(skill.name)}\nenabled = false`
}

const roots=explicitRoots()||defaultRoots()
const cfg=disabledConfig()
const files=uniq(roots.flatMap(r=>findSkillFiles(r.path)))
const all=[]
for(const file of files){
  const md=readText(file); if(!md) continue
  const fm=parseFrontmatter(md); const name=String(fm.name||path.basename(path.dirname(file))).trim(); const description=String(fm.description||'').trim()
  const owner=scopeFor(file,roots); const contentHash=hash(md)
  const item={name,description,path:path.resolve(file),scope:owner.scope,plugin_id:owner.pluginId,root:owner.label,content_hash:contentHash,signalTokens:[...tokens(`${name} ${description}`)]}
  Object.assign(item,lineCosts(name,description,item.path))
  item.enabled=!(cfg.disabledNames.has(name)||cfg.disabledPaths.has(item.path))
  all.push(item)
}
const active=all.filter(x=>x.enabled)
const nameCounts=new Map(); for(const s of active) nameCounts.set(s.name,(nameCounts.get(s.name)||0)+1)
const focusTokens=projectFingerprint()
for(const s of active){const st=new Set(s.signalTokens);s.relevance=focusTokens.size?Math.round(jaccard(st,focusTokens)*100):0}
const duplicateGroups=[]; const duplicateDisablePaths=new Set(); const usedPairs=new Set()
for(let i=0;i<active.length;i++) for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j]; const key=`${i}:${j}`; if(usedPairs.has(key)) continue
  const sim=a.content_hash===b.content_hash?1:jaccard(new Set(a.signalTokens),new Set(b.signalTokens))
  if(sim<0.72&&a.name!==b.name) continue
  const ordered=[a,b].sort((x,y)=>y.relevance-x.relevance || x.chars-y.chars || (x.scope==='project'?-1:1))
  duplicateDisablePaths.add(ordered[1].path)
  duplicateGroups.push({similarity:Number(sim.toFixed(2)),keep:{name:ordered[0].name,path:ordered[0].path,scope:ordered[0].scope},disable_candidate:{name:ordered[1].name,path:ordered[1].path,scope:ordered[1].scope}})
}
const budget=cfg.maxTokens?{mode:'tokens',limit:cfg.maxTokens,reference:'Codex skills.max_context_tokens (capped at 10,000 tokens)'}:{mode:'characters',limit:DEFAULT_CHAR_BUDGET,reference:'Codex default skill metadata budget (8,000 characters when no token budget is available)'}
const used=active.reduce((n,s)=>n+(budget.mode==='tokens'?s.tokens:s.chars),0)
const ratio=budget.limit?used/budget.limit:0
const pressure=ratio>1?'overflow':ratio>0.8?'high':ratio>0.6?'moderate':'healthy'
const candidates=active.filter(s=>!protectedNames.has(s.name)).map(s=>{
  let priority=0; const reasons=[]
  if(duplicateDisablePaths.has(s.path)){priority+=8;reasons.push('near-duplicate capability; another active skill is the preferred keeper')}
  if(focusTokens.size&&s.relevance===0){priority+=5;reasons.push('no current project/task signal')}
  else if(focusTokens.size&&s.relevance<8){priority+=3;reasons.push('weak current project/task relevance')}
  const cost=budget.mode==='tokens'?s.tokens:s.chars
  priority+=Math.min(4,cost/Math.max(1,budget.limit)*18)
  if(s.scope==='project') priority-=3
  if(s.plugin_id==='skillradar@skillradar') priority-=100
  return {...s,priority,reasons,cost}
}).filter(x=>x.priority>0).sort((a,b)=>b.priority-a.priority||b.cost-a.cost)
let projected=used; const recommendations=[]; const target=Math.round(budget.limit*0.65)
for(const s of candidates){
  if(projected<=target&&recommendations.length>=3) break
  projected-=s.cost
  recommendations.push({action:'disable-skill',name:s.name,path:s.path,scope:s.scope,plugin_id:s.plugin_id,relevance:s.relevance,estimated_savings:s.cost,budget_unit:budget.mode==='tokens'?'approx_tokens':'characters',reason:s.reasons.join('; ')||'high metadata cost relative to current focus',config_snippet:configSnippet(s,nameCounts)})
  if(recommendations.length>=20) break
}
const pluginMap=new Map()
for(const r of recommendations){
  if(!r.plugin_id||r.plugin_id==='skillradar@skillradar') continue
  if(!pluginMap.has(r.plugin_id)) pluginMap.set(r.plugin_id,{plugin_id:r.plugin_id,recommended:0,total:active.filter(x=>x.plugin_id===r.plugin_id).length,savings:0})
  const x=pluginMap.get(r.plugin_id); x.recommended++; x.savings+=r.estimated_savings
}
const pluginSuggestions=[...pluginMap.values()].filter(x=>x.total>=2&&x.recommended/x.total>=0.7).map(x=>({...x,action:'consider-remove-plugin',command:`codex plugin remove ${x.plugin_id}`,requires_user_approval:true}))
const out={
  source:'skillradar-skill-budget',version:1,mode:'read-only',focus:focus||null,
  codex_reference:{default_metadata_char_budget:DEFAULT_CHAR_BUDGET,context_window_percent:2,max_configured_token_budget:MAX_TOKEN_BUDGET,max_description_chars:MAX_DESCRIPTION_CHARS,approx_bytes_per_token:BYTES_PER_TOKEN},
  budget:{...budget,used,ratio:Number(ratio.toFixed(2)),pressure,projected_after_plan:Math.max(0,projected),projected_ratio:Number((Math.max(0,projected)/budget.limit).toFixed(2))},
  catalog:{roots:roots.map(r=>({path:r.path,scope:r.scope,plugin_id:r.pluginId})),discovered:all.length,active:active.length,disabled:all.length-active.length,estimated_description_chars:active.reduce((n,s)=>n+s.descriptionChars,0)},
  duplicate_groups:duplicateGroups.slice(0,20),recommendations,plugin_suggestions:pluginSuggestions,
  apply_policy:'No configuration or plugin changes were made. Apply only after explicit user approval, then re-run the audit in a new Codex thread.'
}
console.log(JSON.stringify(out,null,2))
