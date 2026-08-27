import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { parseSkillFrontmatter } from './lib/skill-frontmatter.mjs'

const root = path.resolve(new URL('..', import.meta.url).pathname, '..')
const p = (...parts) => path.join(root, ...parts)
const token = process.env.GITHUB_TOKEN || ''
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'SkillRadar/0.3 (+https://github.com/changchangidea-oss/SkillRadar)',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  'X-GitHub-Api-Version': '2022-11-28',
}

const GENERATED_CHUNK = 'design-skills-radar.json'
const MAX_HISTORY_DAYS = 30
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clamp = (n, lo=0, hi=100) => Math.max(lo, Math.min(hi, n))
const round = (n) => Math.round(clamp(n))
const iso = () => new Date().toISOString()
const today = () => iso().slice(0,10)

async function readJson(file, fallback=null) {
  try { return JSON.parse(await fs.readFile(p(file), 'utf8')) } catch { return fallback }
}
async function writeJson(file, value) {
  await fs.writeFile(p(file), JSON.stringify(value, null, 2) + '\n')
}
async function gh(url, attempt=0) {
  const res = await fetch(url, { headers })
  if (res.ok) return res.json()
  const body = await res.text().catch(() => '')
  if ((res.status === 403 || res.status === 429 || res.status >= 500) && attempt < 2) {
    await sleep(1200 * (attempt + 1))
    return gh(url, attempt + 1)
  }
  throw new Error(`${res.status} ${res.statusText}: ${body.slice(0,220)}`)
}
async function ghText(repo, filePath, ref) {
  const data = await gh(`https://api.github.com/repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`)
  if (!data?.content || data.encoding !== 'base64') return ''
  return Buffer.from(data.content.replace(/\n/g,''), 'base64').toString('utf8')
}
function hash(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex').slice(0,20)
}
function words(text) {
  return [...new Set(String(text||'').toLowerCase().split(/[^a-z0-9+#.-]+/).filter(x=>x.length>2))]
}
function titleCase(s='') {
  return s.replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase())
}
function plainSummary(md='', fm={}) {
  if (fm.description) return String(fm.description).replace(/\s+/g,' ').trim().slice(0,320)
  let body=md.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/,'')
  body=body.replace(/```[\s\S]*?```/g,' ').replace(/^#+\s*/gm,'').replace(/\[(.*?)\]\(.*?\)/g,'$1')
  const para=body.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).find(x=>x.length>35)
  return (para||'Open-source agent skill discovered by SkillRadar.').slice(0,320)
}
function recency(date) {
  const age=Math.max(0,(Date.now()-new Date(date||0).getTime())/86400000)
  return round(100-Math.min(82,age*.8))
}
function popularity(stars=0) {
  return round(Math.log10(Math.max(1,stars)+1)*24)
}
function quality(md, fm, treePaths, baseDir) {
  let q=35
  if (fm.name) q+=10
  if (fm.description && fm.description.length>30) q+=14
  if (md.length>800) q+=8
  if (/when to use|use when|usage|workflow|examples?/i.test(md)) q+=8
  if (/safety|security|permission|never|avoid/i.test(md)) q+=6
  if (treePaths.some(x=>x.startsWith(baseDir+'references/'))) q+=7
  if (treePaths.some(x=>x.startsWith(baseDir+'scripts/'))) q+=4
  if (/https?:\/\//.test(md)) q+=4
  return round(q)
}

const BLOCKED = [
  ['destructive-root', /\brm\s+-rf\s+\/(?:\s|$)/i, 100],
  ['filesystem-format', /\b(?:mkfs|fdisk)\b/i, 100],
  ['fork-bomb', /:\(\)\s*\{\s*:\|:&\s*;\s*\}\s*;:/, 100],
  ['credential-exfil', /(?:curl|wget)[^\n]{0,180}(?:TOKEN|API[_-]?KEY|PASSWORD|SECRET)/i, 100],
]
const HIGH = [
  ['pipe-to-shell', /(?:curl|wget)[^\n|]{0,160}\|\s*(?:bash|sh|zsh)/i, 35],
  ['sudo', /\bsudo\b/i, 24],
  ['remote-shell', /\b(?:ssh|scp|rsync)\b/i, 20],
  ['dynamic-exec', /\b(?:eval|exec)\s*\(/i, 22],
  ['secret-access', /(?:\.env\b|process\.env|os\.environ|API[_-]?KEY|TOKEN|PASSWORD|SECRET)/i, 18],
]
const MED = [
  ['network', /\b(?:curl|wget|fetch\(|requests\.|axios|http[s]?:\/\/)/i, 10],
  ['package-install', /\b(?:npm|pnpm|yarn|pip|uv|brew|apt(?:-get)?)\s+(?:i|install|add)\b/i, 10],
  ['filesystem-write', /\b(?:rm|mv|cp|chmod|chown|tee)\b|writeFile|write_text|open\([^)]*,\s*['"]w/i, 9],
  ['git-write', /\bgit\s+(?:push|commit|reset|clean)\b/i, 8],
  ['deploy', /\b(?:vercel|wrangler|terraform|kubectl|docker)\b/i, 7],
]
function securityScan(text, scriptCount) {
  const findings=[]
  for (const [name,re,w] of BLOCKED) if (re.test(text)) findings.push({name,severity:'blocked',weight:w})
  for (const [name,re,w] of HIGH) if (re.test(text)) findings.push({name,severity:'high',weight:w})
  for (const [name,re,w] of MED) if (re.test(text)) findings.push({name,severity:'medium',weight:w})
  const blocked=findings.some(x=>x.severity==='blocked')
  const high=findings.filter(x=>x.severity==='high').reduce((a,x)=>a+x.weight,0)
  const med=findings.filter(x=>x.severity==='medium').reduce((a,x)=>a+x.weight,0)
  let grade='A'
  if (blocked) grade='Blocked'
  else if (high>=35 || findings.filter(x=>x.severity==='high').length>=2) grade='D'
  else if (high>0 || med>=18) grade='C'
  else if (med>0 || scriptCount>0) grade='B'
  const score=grade==='A'?100:grade==='B'?88:grade==='C'?66:grade==='D'?35:0
  return { grade, score, findings:findings.slice(0,12), capabilities:{
    shell:/\b(?:bash|sh|zsh|powershell|cmd\.exe)\b/i.test(text)||scriptCount>0,
    network:findings.some(x=>x.name==='network'||x.name==='pipe-to-shell'||x.name==='remote-shell'),
    secrets:findings.some(x=>x.name==='secret-access'||x.name==='credential-exfil'),
    packageInstall:findings.some(x=>x.name==='package-install'),
    filesystemWrite:findings.some(x=>x.name==='filesystem-write'||x.name==='git-write'),
  }}
}
function domainScores(skillText, domains, discoveryHints=[]) {
  const hay=String(skillText).toLowerCase()
  return domains.map(d=>{
    const terms=[...new Set([...words(d.en), ...(d.tags||[]).map(String)])]
    let raw=0; const matched=[]
    for (const t0 of terms) { const t=t0.toLowerCase(); if (t && hay.includes(t)) { raw += t.length>7?11:t.length>4?8:5; matched.push(t) } }
    if (discoveryHints.includes(d.id)) raw+=18
    return {domainId:d.id,domainName:d.name,relevance:round(Math.min(100,raw)),matched:matched.slice(0,8)}
  }).sort((a,b)=>b.relevance-a.relevance)
}
function seedEntry(x) {
  if (Array.isArray(x)) return {skillId:x[0], seedScore:Number(x[1])||0}
  return {skillId:x.skillId, seedScore:Number(x.seedScore ?? x.score ?? 0), ...x}
}

const liveDomains = await readJson('data/design-domains.json', [])
let baselineDomains = await readJson('data/design-seed-baseline.json', null)
if (!baselineDomains) { baselineDomains = JSON.parse(JSON.stringify(liveDomains)); await writeJson('data/design-seed-baseline.json', baselineDomains) }
const manifest = await readJson('data/design-skill-index.json', {chunks:[],count:0})
const seedChunks=(manifest.seedChunks||manifest.chunks||[]).filter(x=>x!==GENERATED_CHUNK)
const seedSkills=[]
for (const file of seedChunks) seedSkills.push(...(await readJson(`data/${file}`, [])))
const seedMap=new Map(seedSkills.map(s=>[s.id,s]))
const previousRegistry=await readJson('data/radar-registry.json',{candidates:[]})
const prevMap=new Map((previousRegistry.candidates||[]).map(x=>[x.id,x]))
const history=await readJson('data/ranking-history.json',{snapshots:[]})
const errors=[]; const coarse=new Map()

for (const domain of baselineDomains) {
  const qWords=[...new Set([...words(domain.en), ...(domain.tags||[]).map(x=>String(x).toLowerCase())])].slice(0,7)
  const query=`agent skills ${qWords.slice(0,4).join(' ')} in:name,description,readme`
  try {
    const data=await gh(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=6`)
    for (const repo of (data.items||[]).slice(0,5)) {
      try {
        const tree=await gh(`https://api.github.com/repos/${repo.full_name}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`)
        const paths=(tree.tree||[]).filter(x=>x.type==='blob').map(x=>x.path)
        const skillPaths=paths.filter(x=>/(^|\/)SKILL\.md$/i.test(x))
        for (const skillPath of skillPaths) {
          const slug=skillPath.split('/').slice(-2,-1)[0]||repo.name
          const hay=`${slug} ${skillPath} ${repo.name} ${repo.description||''}`.toLowerCase()
          const overlap=qWords.filter(w=>hay.includes(w)).length
          if (!overlap && skillPaths.length>8) continue
          const id=`${repo.full_name}/${slug}`; const key=`${repo.full_name}:${skillPath}`
          const item=coarse.get(key)||{id,key,slug,source:repo.full_name,skillPath,defaultBranch:repo.default_branch,githubUrl:`https://github.com/${repo.full_name}/blob/${repo.default_branch}/${skillPath}`,installUrl:`https://github.com/${repo.full_name}`,repoStars:repo.stargazers_count||0,pushedAt:repo.pushed_at,repoDescription:repo.description||'',treePaths:paths,hints:[]}
          if (!item.hints.includes(domain.id)) item.hints.push(domain.id); coarse.set(key,item)
        }
      } catch(e) { errors.push({stage:'tree',domain:domain.id,repo:repo.full_name,error:String(e.message||e)}) }
      await sleep(90)
    }
  } catch(e) { errors.push({stage:'search',domain:domain.id,error:String(e.message||e)}) }
  await sleep(250)
}

const coarseList=[...coarse.values()].sort((a,b)=>b.repoStars-a.repoStars).slice(0,140); const analyzed=[]
for (const item of coarseList) {
  try {
    const md=await ghText(item.source,item.skillPath,item.defaultBranch); if (!md || md.length<40) continue
    const fm=parseSkillFrontmatter(md); const baseDir=item.skillPath.replace(/SKILL\.md$/i,'')
    const scriptPaths=item.treePaths.filter(x=>x.startsWith(baseDir)&&/(^|\/)scripts\/.*\.(?:sh|bash|zsh|js|mjs|cjs|ts|py|ps1)$/i.test(x)).slice(0,4)
    const scriptTexts=[]
    for (const file of scriptPaths) { try { scriptTexts.push(await ghText(item.source,file,item.defaultBranch)) } catch(e) { errors.push({stage:'script-fetch',repo:item.source,path:file,error:String(e.message||e)}) }; await sleep(35) }
    const scanText=[md,...scriptTexts].join('\n\n'); const security=securityScan(scanText,scriptPaths.length)
    const name=fm.name||titleCase(item.slug); const summary=plainSummary(md,fm)
    const classInput=`${name} ${summary} ${fm.description||''} ${item.skillPath} ${item.repoDescription} ${md.slice(0,7000)}`
    const classifications=domainScores(classInput,baselineDomains,item.hints); const best=classifications[0]||{relevance:0}
    const q=quality(md,fm,item.treePaths,baseDir); const maint=recency(item.pushedAt); const pop=popularity(item.repoStars)
    const prev=prevMap.get(item.id); const firstSeenAt=prev?.firstSeenAt||iso(); const seenDays=Math.max(1,Math.floor((Date.now()-new Date(firstSeenAt).getTime())/86400000)+1)
    const baseScore=round(best.relevance*.34+q*.18+security.score*.20+maint*.15+pop*.08+Math.min(100,seenDays*12)*.05)
    const status=security.grade==='Blocked'?'blocked':security.grade==='D'?'review':best.relevance<24?'low-relevance':'active'
    analyzed.push({id:item.id,name,slug:item.slug,source:item.source,skillPath:item.skillPath,githubUrl:item.githubUrl,installUrl:item.installUrl,summary,tags:[...new Set(classifications.slice(0,3).flatMap(c=>c.matched))].slice(0,12),repoStars:item.repoStars,pushedAt:item.pushedAt,contentHash:hash(md),discovery:'github-radar',firstSeenAt,lastSeenAt:iso(),seenDays,qualityScore:q,maintenanceScore:maint,popularityScore:pop,security:security.grade,securityScore:security.score,securityFindings:security.findings,capabilities:security.capabilities,classifications:classifications.slice(0,4),signalScore:baseScore,status})
  } catch(e) { errors.push({stage:'analyze',repo:item.source,path:item.skillPath,error:String(e.message||e)}) }
  await sleep(45)
}

const analyzedMap=new Map(); for (const x of analyzed) { const old=analyzedMap.get(x.id); if (!old || x.signalScore>old.signalScore) analyzedMap.set(x.id,x) }
const candidates=[...analyzedMap.values()].sort((a,b)=>b.signalScore-a.signalScore||b.repoStars-a.repoStars)
const radarSkills=candidates.filter(x=>x.status!=='blocked' && x.classifications?.[0]?.relevance>=24).map(x=>({id:x.id,name:x.name,source:x.source,summary:x.summary,security:x.security,signalScore:x.signalScore,installs:0,repoStars:x.repoStars,tags:x.tags,installUrl:x.installUrl,skillsUrl:x.githubUrl,discovery:'github-radar',domains:x.classifications.map(c=>c.domainId),qualityScore:x.qualityScore,maintenanceScore:x.maintenanceScore,firstSeenAt:x.firstSeenAt,lastSeenAt:x.lastSeenAt}))
await writeJson(`data/${GENERATED_CHUNK}`,radarSkills)
const nextManifest={...manifest,seedChunks,chunks:[...seedChunks,GENERATED_CHUNK],seedCount:seedSkills.length,count:seedSkills.length+radarSkills.length,radarCount:radarSkills.length,generatedAt:today()}; await writeJson('data/design-skill-index.json',nextManifest)

const previousRanks=(history.snapshots||[]).at(-1)?.domains||{}; const liveOut=[]; const snapshotDomains={}
for (const baseDomain of baselineDomains) {
  const pool=new Map()
  for (const e0 of (baseDomain.seedTop20||[])) { const e=seedEntry(e0); const skill=seedMap.get(e.skillId); if (!skill) continue; pool.set(e.skillId,{skillId:e.skillId,seedScore:round(e.seedScore),source:'seed',security:skill.security||'B'}) }
  for (const c of candidates) { const cls=c.classifications.find(x=>x.domainId===baseDomain.id); if (!cls || cls.relevance<28 || ['Blocked','D'].includes(c.security) || c.status==='low-relevance') continue; const maturityPenalty=Math.max(0,8-Math.min(8,(c.seenDays-1)*2)); const score=round(c.signalScore*.72+cls.relevance*.28-maturityPenalty); const prev=pool.get(c.id); if (!prev || score>prev.seedScore) pool.set(c.id,{skillId:c.id,seedScore:score,source:'radar',security:c.security}) }
  const rows=[...pool.values()].sort((a,b)=>b.seedScore-a.seedScore).slice(0,20); const prevRows=previousRanks[baseDomain.id]||[]; const prevRank=new Map(prevRows.map((r,i)=>[typeof r==='string'?r:r.skillId,i+1]))
  const top=rows.map((r,i)=>{ const rank=i+1,before=prevRank.get(r.skillId),delta=before?before-rank:null; return {...r,rank,delta,status:before==null?'new':delta>0?'up':delta<0?'down':'steady'} })
  snapshotDomains[baseDomain.id]=top.map(x=>({skillId:x.skillId,score:x.seedScore,source:x.source})); liveOut.push({...baseDomain,rankingMode:'live',rankingUpdatedAt:iso(),seedTop20:top})
}
await writeJson('data/design-domains.json',liveOut)
const domainRadar={}
for (const d of baselineDomains) domainRadar[d.id]=candidates.filter(x=>x.classifications.some(c=>c.domainId===d.id&&c.relevance>=24)).map(x=>({...x,domainId:d.id,domainName:d.name,matchScore:x.classifications.find(c=>c.domainId===d.id)?.relevance||0})).sort((a,b)=>b.signalScore-a.signalScore).slice(0,20)
await writeJson('data/radar-registry.json',{generatedAt:iso(),version:1,candidateCount:candidates.length,activeCount:radarSkills.length,candidates})
const latest={generatedAt:iso(),status:candidates.length?'live':'degraded',source:'GitHub repository search + recursive SKILL.md parsing + static security scan + domain classification',pipeline:['discover','parse','security-scan','classify','rank','publish-to-registry','codex-route'],discoveryCount:candidates.length,activeCount:radarSkills.length,blockedCount:candidates.filter(x=>x.security==='Blocked').length,reviewCount:candidates.filter(x=>x.security==='D').length,errors:errors.slice(0,40),domainRadar,discoveries:candidates.slice(0,120)}
await writeJson('data/radar-latest.json',latest)
const nextHistory=[...(history.snapshots||[]),{date:today(),generatedAt:latest.generatedAt,domains:snapshotDomains}]; const dedupHist=[]; const seenDates=new Set(); for (const s of nextHistory.reverse()) if (!seenDates.has(s.date)) {seenDates.add(s.date);dedupHist.push(s)}
await writeJson('data/ranking-history.json',{snapshots:dedupHist.slice(0,MAX_HISTORY_DAYS).reverse()})
console.log(`SkillRadar pipeline complete: ${candidates.length} analyzed, ${radarSkills.length} active, ${latest.blockedCount} blocked, ${baselineDomains.length} domains ranked.`)
