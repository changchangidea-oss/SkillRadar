import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { canonicalCandidateKeys, prioritizeAnalysisCandidates, prioritizeCanonicalCandidates } from './lib/canonical-seeds.mjs'
import { parseSkillFrontmatter } from './lib/skill-frontmatter.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const p=(...parts)=>path.join(root,...parts)
const token=process.env.GITHUB_TOKEN||''
const headers={Accept:'application/vnd.github+json','User-Agent':'SkillRadar/0.4 (+https://github.com/changchangidea-oss/SkillRadar)',...(token?{Authorization:`Bearer ${token}`}:{ }),'X-GitHub-Api-Version':'2022-11-28'}
const MAX_ANALYZE=180
const MAX_SCRIPT_SCAN=24
const RETAIN_DAYS=14
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const clamp=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,n))
const round=n=>Math.round(clamp(n))
const iso=()=>new Date().toISOString()

async function readJson(file,fallback=null){try{return JSON.parse(await fs.readFile(p(file),'utf8'))}catch{return fallback}}
async function writeJson(file,value){await fs.writeFile(p(file),JSON.stringify(value,null,2)+'\n')}
async function gh(url,attempt=0){
  const res=await fetch(url,{headers})
  if(res.ok)return res.json()
  const body=await res.text().catch(()=> '')
  if((res.status===403||res.status===429||res.status>=500)&&attempt<2){await sleep(1000*(attempt+1));return gh(url,attempt+1)}
  throw new Error(`${res.status} ${res.statusText}: ${body.slice(0,180)}`)
}
async function ghText(repo,filePath,ref){
  const u=`https://api.github.com/repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`
  const data=await gh(u)
  if(!data?.content||data.encoding!=='base64')return ''
  return Buffer.from(data.content.replace(/\n/g,''),'base64').toString('utf8')
}
function hash(text){return crypto.createHash('sha256').update(text||'').digest('hex').slice(0,20)}
function words(text){return [...new Set(String(text||'').toLowerCase().replace(/next\.js/g,'nextjs').split(/[^a-z0-9+#.-]+/).filter(x=>x.length>2))]}
function titleCase(s=''){return s.replace(/[-_]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase())}
const ROUTING_PHRASES=[
  ['app-router',/\bapp[ -]router\b/i],
  ['server-components',/\bserver[ -]components?\b/i],
  ['tool-calling',/\btool[ -]calling\b/i],
  ['function-calling',/\bfunction[ -]calling\b/i],
  ['design-system',/\bdesign[ -]systems?\b/i],
  ['react-native',/\breact[ -]native\b/i],
  ['ci-cd',/\bci\s*\/\s*cd\b/i],
  ['e2e',/\bend[ -]to[ -]end\b|\be2e\b/i]
]
function routingEvidence(contract='',classes=[],skillBody=''){
  const text=String(contract).toLowerCase().replace(/next\.js/g,'nextjs'),tokens=new Set(text.split(/[^a-z0-9+#.-]+/).filter(Boolean))
  const appears=term=>{const t=String(term||'').toLowerCase().replace(/next\.js/g,'nextjs').replace(/[^a-z0-9+#.-]+/g,'-').replace(/^-+|-+$/g,'');return t&&(tokens.has(t)||(t.length>=5&&text.includes(t)))}
  const phrases=ROUTING_PHRASES.filter(([,pattern])=>pattern.test(skillBody)).map(([term])=>term)
  return [...new Set([...classes.slice(0,3).flatMap(c=>c.matched||[]).filter(appears),...phrases])].slice(0,24)
}
function summary(md='',fm={}){
  if(fm.description)return String(fm.description).replace(/\s+/g,' ').trim().slice(0,320)
  const body=md.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/,'').replace(/```[\s\S]*?```/g,' ').replace(/^#+\s*/gm,'').replace(/\[(.*?)\]\(.*?\)/g,'$1')
  return (body.split(/\n\s*\n/).map(x=>x.replace(/\s+/g,' ').trim()).find(x=>x.length>35)||'Open-source agent skill discovered by SkillRadar.').slice(0,320)
}
function recency(date){const age=Math.max(0,(Date.now()-new Date(date||0).getTime())/86400000);return round(100-Math.min(85,age*.75))}
function popularity(stars=0){return round(Math.log10(Math.max(1,stars)+1)*24)}
function quality(md,fm,treePaths,baseDir){let q=32;if(fm.name)q+=10;if(fm.description?.length>30)q+=14;if(md.length>800)q+=8;if(/when to use|use when|usage|workflow|examples?/i.test(md))q+=10;if(/safety|security|permission|never|avoid/i.test(md))q+=6;if(treePaths.some(x=>x.startsWith(baseDir+'references/')))q+=7;if(treePaths.some(x=>x.startsWith(baseDir+'scripts/')))q+=4;if(/https?:\/\//.test(md))q+=4;return round(q)}
const BLOCKED=[['destructive-root',/\brm\s+-rf\s+\/(?:\s|$)/i,100],['filesystem-format',/\b(?:mkfs|fdisk)\b/i,100],['fork-bomb',/:\(\)\s*\{\s*:\|:&\s*;\s*\}\s*;:/,100],['credential-exfil',/(?:curl|wget)[^\n]{0,180}(?:TOKEN|API[_-]?KEY|PASSWORD|SECRET)/i,100]]
const HIGH=[['pipe-to-shell',/(?:curl|wget)[^\n|]{0,160}\|\s*(?:bash|sh|zsh)/i,35],['sudo',/\bsudo\b/i,24],['remote-shell',/\b(?:ssh|scp|rsync)\b/i,20],['dynamic-exec',/\b(?:eval|exec)\s*\(/i,22],['secret-access',/(?:\.env\b|process\.env|os\.environ|API[_-]?KEY|TOKEN|PASSWORD|SECRET)/i,18]]
const MED=[['network',/\b(?:curl|wget|fetch\(|requests\.|axios|http[s]?:\/\/)/i,10],['package-install',/\b(?:npm|pnpm|yarn|pip|uv|brew|apt(?:-get)?)\s+(?:i|install|add)\b/i,10],['filesystem-write',/\b(?:rm|mv|cp|chmod|chown|tee)\b|writeFile|write_text|open\([^)]*,\s*['"]w/i,9],['git-write',/\bgit\s+(?:push|commit|reset|clean)\b/i,8],['deploy',/\b(?:vercel|wrangler|terraform|kubectl|docker)\b/i,7]]
function securityScan(text,scriptCount,scanComplete=true){
  const findings=[];for(const [name,re,w] of BLOCKED)if(re.test(text))findings.push({name,severity:'blocked',weight:w});for(const [name,re,w] of HIGH)if(re.test(text))findings.push({name,severity:'high',weight:w});for(const [name,re,w] of MED)if(re.test(text))findings.push({name,severity:'medium',weight:w});if(!scanComplete)findings.push({name:'partial-script-scan',severity:'high',weight:40})
  const blocked=findings.some(x=>x.severity==='blocked'),high=findings.filter(x=>x.severity==='high').reduce((a,x)=>a+x.weight,0),med=findings.filter(x=>x.severity==='medium').reduce((a,x)=>a+x.weight,0)
  let grade='A';if(blocked)grade='Blocked';else if(!scanComplete)grade='D';else if(high>=35||findings.filter(x=>x.severity==='high').length>=2)grade='D';else if(high>0||med>=18)grade='C';else if(med>0||scriptCount>0)grade='B'
  const score=grade==='A'?100:grade==='B'?88:grade==='C'?66:grade==='D'?35:0
  return {grade,score,scanComplete,findings:findings.slice(0,12),capabilities:{shell:/\b(?:bash|sh|zsh|powershell|cmd\.exe)\b/i.test(text)||scriptCount>0,network:findings.some(x=>['network','pipe-to-shell','remote-shell'].includes(x.name)),secrets:findings.some(x=>['secret-access','credential-exfil'].includes(x.name)),packageInstall:findings.some(x=>x.name==='package-install'),filesystemWrite:findings.some(x=>['filesystem-write','git-write'].includes(x.name))}}
}
function retainWithScanProvenance(old){
  const total=Number(old?.scriptScan?.total),scanned=Number(old?.scriptScan?.scanned)
  const verified=old?.scriptScan?.complete===true&&Number.isFinite(total)&&Number.isFinite(scanned)&&total===scanned
  if(verified)return {...old,staleRuns:(old.staleRuns||0)+1}
  const findings=[...(old.securityFindings||[]).filter(x=>x?.name!=='legacy-unverified-script-scan'),{name:'legacy-unverified-script-scan',severity:'high',weight:40}].slice(0,12)
  return {...old,staleRuns:(old.staleRuns||0)+1,status:'review',security:'D',securityScore:35,securityFindings:findings,scriptScan:{total:Number.isFinite(total)?total:null,scanned:Number.isFinite(scanned)?scanned:null,complete:false,provenance:'unverified-retained'}}
}
if(process.env.SKILLRADAR_SECURITY_SELFTEST==='1'){
  const partial=securityScan('safe script',5,false),blocked=securityScan('rm -rf /',1,true)
  const legacy=retainWithScanProvenance({security:'A',status:'active'}),verified=retainWithScanProvenance({security:'A',status:'active',scriptScan:{total:0,scanned:0,complete:true}})
  if(partial.grade!=='D'||!partial.findings.some(x=>x.name==='partial-script-scan'))throw new Error('partial script scan must fail closed as D')
  if(blocked.grade!=='Blocked')throw new Error('destructive script self-test must be Blocked')
  if(legacy.security!=='D'||legacy.status!=='review'||legacy.scriptScan?.complete!==false)throw new Error('retained candidate without scan provenance must fail closed as D/review')
  if(verified.security!=='A'||verified.status!=='active')throw new Error('verified retained candidate must preserve routing status')
  console.log('General Radar security self-test passed: incomplete and unverified retained scans fail closed; destructive commands block routing.')
  process.exit(0)
}
if(process.env.SKILLRADAR_ROUTING_EVIDENCE_SELFTEST==='1'){
  const evidence=routingEvidence('TelemedX frontend patterns for a Next.js application',[{matched:['nextjs','frontend']}],'Use App Router data fetching with React Server Components.')
  if(!['nextjs','app-router','server-components'].every(term=>evidence.includes(term)))throw new Error('full candidate SKILL body must retain exact compound routing evidence beyond the public summary')
  if(evidence.includes('poster'))throw new Error('routing evidence must never be borrowed from repository or unrelated classification context')
  console.log('General Radar routing evidence self-test passed: exact candidate-owned compound phrases survive summary truncation without repository-context pollution.')
  process.exit(0)
}
function classify(text,domains,hints=[]){
  const hay=String(text).toLowerCase().replace(/next\.js/g,'nextjs')
  return domains.map(d=>{const terms=[...new Set([...(d.tags||[]),...words(d.en)])].map(x=>String(x).toLowerCase());let raw=0;const matched=[];for(const t of terms){if(t&&hay.includes(t)){raw+=t.length>8?12:t.length>4?8:5;matched.push(t)}}if(hints.includes(d.id))raw+=20;return {domainId:d.id,domainName:d.name,relevance:round(Math.min(100,raw)),matched:matched.slice(0,10)}}).sort((a,b)=>b.relevance-a.relevance)
}
async function repoMeta(fullName,cache){if(cache.has(fullName))return cache.get(fullName);const data=await gh(`https://api.github.com/repos/${fullName}`);cache.set(fullName,data);return data}
async function repoTree(repo,cache){const key=repo.full_name;if(cache.has(key))return cache.get(key);const data=await gh(`https://api.github.com/repos/${key}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`);const paths=(data.tree||[]).filter(x=>x.type==='blob').map(x=>x.path);cache.set(key,paths);return paths}

const domains=await readJson('data/general-domains.json',[])
const canonicalSeeds=await readJson('data/general-canonical-seeds.json',[])
const canonicalKeys=canonicalCandidateKeys(canonicalSeeds)
const previous=await readJson('data/general-radar-registry.json',{candidates:[]})
const prevMap=new Map((previous.candidates||[]).map(x=>[`${x.source}:${x.skillPath}`,x]))
const coarse=new Map(),errors=[],repoCache=new Map(),treeCache=new Map()
const metrics={repository_queries:0,code_queries:0,repositories_seen:new Set(),skill_files_seen:new Set(),partial_script_scans:0,unverified_retained:0,channels:{repository_search:0,code_search:0,ecosystem_search:0}}
function addCandidate(repo,skillPath,hint,channel,treePaths){
  const key=`${repo.full_name}:${skillPath}`;const slug=skillPath.split('/').slice(-2,-1)[0]||repo.name
  const existing=coarse.get(key)||{key,source:repo.full_name,skillPath,slug,defaultBranch:repo.default_branch,repoStars:repo.stargazers_count||0,pushedAt:repo.pushed_at,repoDescription:repo.description||'',treePaths:treePaths||[],hints:[],channels:[],githubUrl:`https://github.com/${repo.full_name}/blob/${repo.default_branch}/${skillPath}`,installUrl:`https://github.com/${repo.full_name}`}
  if(hint&&!existing.hints.includes(hint))existing.hints.push(hint);if(!existing.channels.includes(channel))existing.channels.push(channel);if((treePaths||[]).length>existing.treePaths.length)existing.treePaths=treePaths
  coarse.set(key,existing);metrics.repositories_seen.add(repo.full_name);metrics.skill_files_seen.add(key);metrics.channels[channel]=(metrics.channels[channel]||0)+1
}
async function discoverRepoQuery(query,hint,channel='repository_search'){
  metrics.repository_queries++
  const data=await gh(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=8`)
  for(const r0 of (data.items||[]).slice(0,6)){
    try{const repo=await repoMeta(r0.full_name,repoCache);const paths=await repoTree(repo,treeCache);for(const skillPath of paths.filter(x=>/(^|\/)SKILL\.md$/i.test(x)).slice(0,30))addCandidate(repo,skillPath,hint,channel,paths)}catch(e){errors.push({stage:'repo-discovery',query,repo:r0.full_name,error:String(e.message||e)})}
    await sleep(55)
  }
}
async function discoverCodeQuery(query,hint){
  metrics.code_queries++
  try{
    const data=await gh(`https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=10`)
    for(const item of (data.items||[]).slice(0,8)){
      try{const repo=await repoMeta(item.repository.full_name,repoCache);const paths=await repoTree(repo,treeCache);addCandidate(repo,item.path,hint,'code_search',paths)}catch(e){errors.push({stage:'code-result',query,repo:item.repository?.full_name,error:String(e.message||e)})}
      await sleep(45)
    }
  }catch(e){errors.push({stage:'code-search',query,error:String(e.message||e)})}
}

for(const domain of domains){
  const terms=(domain.tags||[]).slice(0,4).join(' ')
  const queries=[...(domain.queries||[]),`agent skills ${terms} in:name,description,readme`,`codex skills ${terms} in:name,description,readme`]
  for(const q of [...new Set(queries)].slice(0,3)){try{await discoverRepoQuery(q,domain.id)}catch(e){errors.push({stage:'repo-search',domain:domain.id,query:q,error:String(e.message||e)})};await sleep(120)}
  await discoverCodeQuery(`filename:SKILL.md ${terms.split(' ').slice(0,2).join(' ')}`,domain.id);await sleep(140)
}
for(const q of ['agent skills in:name,description,readme','claude skills in:name,description,readme','codex skills in:name,description,readme']){try{await discoverRepoQuery(q,null,'ecosystem_search')}catch(e){errors.push({stage:'ecosystem-search',query:q,error:String(e.message||e)})};await sleep(140)}

// Canonical seeds guarantee analysis, not acceptance. Put only their configured
// source:path pairs ahead of the global cap, then run the exact same content,
// script, relevance, and D/Blocked safety gates as every organic candidate.
const coarseList=prioritizeAnalysisCandidates([...coarse.values()],canonicalKeys).slice(0,MAX_ANALYZE)
const analyzed=[]
for(const item of coarseList){
  try{
    const md=await ghText(item.source,item.skillPath,item.defaultBranch);if(!md||md.length<40)continue
    const fm=parseSkillFrontmatter(md),baseDir=item.skillPath.replace(/SKILL\.md$/i,'')
    const executablePaths=item.treePaths.filter(x=>x.startsWith(baseDir)&&/(^|\/)scripts\/.*\.(?:sh|bash|zsh|js|mjs|cjs|ts|py|ps1)$/i.test(x))
    const scriptPaths=executablePaths.slice(0,MAX_SCRIPT_SCAN),scriptTexts=[];let scriptScanComplete=scriptPaths.length===executablePaths.length
    for(const file of scriptPaths){try{scriptTexts.push(await ghText(item.source,file,item.defaultBranch))}catch(e){scriptScanComplete=false;errors.push({stage:'script-fetch',repo:item.source,path:file,error:String(e.message||e)})};await sleep(25)}
    if(!scriptScanComplete)metrics.partial_script_scans++
    const sec=securityScan([md,...scriptTexts].join('\n\n'),executablePaths.length,scriptScanComplete),name=fm.name||titleCase(item.slug),sum=summary(md,fm)
    const classes=classify(`${name} ${sum} ${fm.description||''} ${item.skillPath} ${item.repoDescription} ${md.slice(0,8000)}`,domains,item.hints),best=classes[0]||{relevance:0,domainName:'General'}
    const q=quality(md,fm,item.treePaths,baseDir),maint=recency(item.pushedAt),pop=popularity(item.repoStars),discoveryScore=round(Math.min(100,item.channels.length*24+item.hints.length*8+(item.repoStars>20?12:0)))
    const contractEvidence=routingEvidence(`${name} ${item.slug} ${fm.description||''}`,classes,md)
    const prior=prevMap.get(item.key),firstSeenAt=prior?.firstSeenAt||iso(),seenDays=Math.max(1,Math.floor((Date.now()-new Date(firstSeenAt).getTime())/86400000)+1)
    const signalScore=round(best.relevance*.30+q*.19+sec.score*.19+maint*.14+pop*.07+discoveryScore*.07+Math.min(100,seenDays*12)*.04)
    const status=sec.grade==='Blocked'?'blocked':sec.grade==='D'?'review':best.relevance<18?'low-relevance':'active'
    analyzed.push({id:`${item.source}/${item.slug}-${hash(item.skillPath).slice(0,6)}`,name,slug:item.slug,source:item.source,skillPath:item.skillPath,githubUrl:item.githubUrl,installUrl:item.installUrl,summary:sum,routingEvidence:contractEvidence,category:best.domainName,tags:[...new Set(classes.slice(0,3).flatMap(c=>c.matched))].slice(0,14),domains:classes.filter(c=>c.relevance>=18).slice(0,4).map(c=>c.domainId),repoStars:item.repoStars,pushedAt:item.pushedAt,contentHash:hash(md),discovery:'github-general-radar',discoveryChannels:item.channels,discoveryScore,firstSeenAt,lastSeenAt:iso(),seenDays,qualityScore:q,maintenanceScore:maint,popularityScore:pop,security:sec.grade,securityScore:sec.score,securityFindings:sec.findings,scriptScan:{total:executablePaths.length,scanned:scriptTexts.length,complete:scriptScanComplete},capabilities:sec.capabilities,classifications:classes.slice(0,4),signalScore,status})
  }catch(e){errors.push({stage:'analyze',repo:item.source,path:item.skillPath,error:String(e.message||e)})}
  await sleep(35)
}
const currentKeys=new Set(analyzed.map(x=>`${x.source}:${x.skillPath}`)),retained=[]
for(const old of previous.candidates||[]){
  const key=`${old.source}:${old.skillPath}`;if(currentKeys.has(key))continue
  const age=(Date.now()-new Date(old.lastSeenAt||old.firstSeenAt||0).getTime())/86400000
  if(age<=RETAIN_DAYS){const item=retainWithScanProvenance(old);if(item.security==='D'&&item.securityFindings?.some(x=>x.name==='legacy-unverified-script-scan'))metrics.unverified_retained++;retained.push(item)}
}
const all=[...analyzed,...retained].sort((a,b)=>b.signalScore-a.signalScore)
const eligible=all.filter(x=>x.status==='active'&&['A','B','C'].includes(x.security)&&x.scriptScan?.complete===true)
// A configured canonical path that passed every normal gate must not disappear
// behind the 260-entry publication cap. This only changes ordering of eligible
// candidates; review, D, Blocked, incomplete, or low-relevance entries remain out.
const live=prioritizeCanonicalCandidates(eligible,canonicalKeys).slice(0,260)
await writeJson('data/general-skills-radar.json',live)
await writeJson('data/general-radar-registry.json',{generatedAt:iso(),candidateCount:all.length,candidates:all,errors:errors.slice(0,80)})
await writeJson('data/general-radar-latest.json',{generatedAt:iso(),taxonomyDomains:domains.length,repositoryQueries:metrics.repository_queries,codeQueries:metrics.code_queries,repositoriesSeen:metrics.repositories_seen.size,skillFilesSeen:metrics.skill_files_seen.size,analyzed:analyzed.length,retained:retained.length,active:live.length,review:all.filter(x=>x.status==='review').length,blocked:all.filter(x=>x.status==='blocked').length,lowRelevance:all.filter(x=>x.status==='low-relevance').length,partialScriptScans:metrics.partial_script_scans,unverifiedRetained:metrics.unverified_retained,channels:metrics.channels,errorCount:errors.length})
console.log(`General Radar: ${live.length} active skills from ${metrics.repositories_seen.size} repos / ${metrics.skill_files_seen.size} SKILL.md files; ${metrics.partial_script_scans} incomplete script scans + ${metrics.unverified_retained} unverified retained candidates failed closed; ${errors.length} errors.`)
