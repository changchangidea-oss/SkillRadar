#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here=path.dirname(fileURLToPath(import.meta.url))
const base=(process.env.SKILLRADAR_BASE_URL||'').replace(/\/$/,'')
const offline=process.env.SKILLRADAR_OFFLINE==='1'
const explicitRegistry=process.env.SKILLRADAR_REGISTRY_PATH||''
const [cmd,...rest]=process.argv.slice(2)
const value=rest.join(' ').trim()
const RAW='https://raw.githubusercontent.com/changchangidea-oss/SkillRadar/main/data'
if(!cmd||!value||!['search','match','inspect'].includes(cmd)){console.error('Usage: skillradar.mjs search|match|inspect <query>');process.exit(2)}

function readJson(paths){for(const p of paths){try{if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p,'utf8'))}catch{}}return null}
function normalizeCore(s){return {...s,tags:s.tags||[],domains:s.domains||[],uses:s.uses||[],security:s.security||'B',score:s.score??s.signalScore??70,maintenance:s.maintenance??s.maintenanceScore??70}}
function normalizeDiscovered(s,fallbackCategory){return {id:s.id,name:s.name,source:s.source,category:s.category||fallbackCategory,tags:s.tags||[],summary:s.summary,security:s.security||'B',score:s.signalScore??s.score??70,maintenance:s.maintenanceScore??s.maintenance??70,installs:s.installs||0,installUrl:s.installUrl,skillsUrl:s.skillsUrl,discovery:s.discovery||'radar',domains:s.domains||[],uses:s.uses||[],routingEvidence:s.routingEvidence||[]}}
function dedupeAndGate(skills){const seen=new Set();return skills.filter(s=>!['D','Blocked'].includes(s.security)).filter(s=>{const key=`${String(s.source||'').toLowerCase()}::${String(s.name||s.id||'').toLowerCase().replace(/[^a-z0-9]+/g,'')}`;if(seen.has(key))return false;seen.add(key);return true})}
function loadBundledRegistry(){
  const snapshot=readJson([explicitRegistry,path.resolve(here,'../data/registry.json')].filter(Boolean))
  if(!snapshot||![1,2].includes(snapshot.schemaVersion)||!Array.isArray(snapshot.core)||!Array.isArray(snapshot.design))return null
  const general=Array.isArray(snapshot.general)?snapshot.general:[]
  return {skills:dedupeAndGate([...snapshot.core.map(normalizeCore),...snapshot.design.map(x=>normalizeDiscovered(x,'Design')),...general.map(x=>normalizeDiscovered(x,'General'))]),meta:{mode:'local-bundled',schemaVersion:snapshot.schemaVersion,generatedAt:snapshot.generatedAt,totalCount:snapshot.totalCount,coreCount:snapshot.coreCount,designCount:snapshot.designCount,generalCount:snapshot.generalCount||0,contentHash:snapshot.contentHash,source:snapshot.source}}
}
function loadLegacyLocalRegistry(){
  const localRoots=[path.resolve(here,'../data'),path.resolve(here,'../../../data')]
  const core=readJson(localRoots.map(r=>path.join(r,'skills.json'))),manifest=readJson(localRoots.map(r=>path.join(r,'design-skill-index.json'))),design=[]
  if(manifest)for(const file of manifest.chunks||[]){const part=readJson(localRoots.map(r=>path.join(r,file)));if(part)design.push(...part)}
  const general=readJson(localRoots.map(r=>path.join(r,'general-skills-radar.json')))||[]
  if(!core||!manifest||!design.length)return null
  return {skills:dedupeAndGate([...core.map(normalizeCore),...design.map(x=>normalizeDiscovered(x,'Design')),...general.map(x=>normalizeDiscovered(x,'General'))]),meta:{mode:'local-repository',generatedAt:manifest.generatedAt,totalCount:core.length+design.length+general.length,source:'repository-data'}}
}
async function fetchJson(url){if(offline)throw new Error('network disabled by SKILLRADAR_OFFLINE=1');const r=await fetch(url,{headers:{accept:'application/json','user-agent':'SkillRadar-Codex-Plugin/0.5.0'}});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}
async function loadNetworkRegistry(){const core=await fetchJson(`${RAW}/skills.json`),manifest=await fetchJson(`${RAW}/design-skill-index.json`),design=[];for(const file of manifest.chunks||[])design.push(...await fetchJson(`${RAW}/${file}`));let general=[];try{general=await fetchJson(`${RAW}/general-skills-radar.json`)}catch{}return {skills:dedupeAndGate([...core.map(normalizeCore),...design.map(x=>normalizeDiscovered(x,'Design')),...general.map(x=>normalizeDiscovered(x,'General'))]),meta:{mode:'network-fallback',generatedAt:manifest.generatedAt,totalCount:core.length+design.length+general.length,source:RAW}}}
async function loadRegistry(){return loadBundledRegistry()||loadLegacyLocalRegistry()||(offline?(()=>{throw new Error('Bundled SkillRadar registry is missing; offline routing cannot continue.')})():await loadNetworkRegistry())}

const STOP=new Set('the a an and or for to of in on with from by is are be as this that use using build create make develop development app application modern include includes including need needs want please skill skills best top recommend recommended'.split(' '))
const PHRASES={
  'next.js':['nextjs'],'app router':['app-router'],'server components':['server-components','rsc'],
  'shadcn/ui':['shadcn'],'ai sdk':['ai-sdk'],'tool calling':['tool-calling','function-calling'],'function calling':['function-calling','tool-calling'],
  'design system':['design-system'],'cloudflare workers':['cloudflare-workers','workers'],'react native':['react-native'],
  'ci/cd':['ci-cd'],'end to end':['e2e']
}
const ZH_FACETS=[
  ['用户体验',['ux','research','usability']],['工业设计',['industrial-design','industrial','product','cad']],['产品设计',['product','industrial']],['3d打印',['3d-printing','fabrication','3d']],
  ['建筑可视化',['architecture','rendering']],['室内空间',['interior','spatial']],['空间渲染',['spatial','rendering']],['建筑',['architecture']],['室内',['interior','spatial']],['景观',['landscape','environment','spatial']],
  ['界面',['ui','interface','layout']],['视觉',['visual','graphic','typography']],['海报',['poster','graphic','typography','layout']],['品牌',['brand','campaign']],
  ['视频',['video','motion','editing']],['剪辑',['video','editing']],['动效',['motion','animation','video']],['分镜',['storyboard','video','film']],
  ['服装',['fashion','campaign']],['时尚',['fashion','brand']],['交互',['interaction','ux','ui']],['数媒',['digital-media','creative-coding']],['影视',['film','video','editing','vfx']],
  ['工艺',['craft','fabrication']],['民间艺术',['illustration','hand-drawn','collage','pattern','craft']],['纹样',['pattern','illustration','vector']]
]
function canon(t){return String(t).toLowerCase().replace(/next\.js/g,'nextjs').replace(/node\.?js/g,'node').replace(/shadcn\/ui/g,'shadcn').replace(/tool[- ]calling/g,'tool-calling').replace(/function[- ]calling/g,'function-calling').replace(/server[- ]components/g,'server-components').replace(/app[- ]router/g,'app-router').replace(/design[- ]system/g,'design-system').replace(/vulnerabilities/g,'vulnerability').replace(/[^a-z0-9+#.-]+/g,'').trim()}
function querySignals(text){
  const raw=String(text).toLowerCase(),concepts=[],consumed=new Set()
  for(const [phrase,aliases] of Object.entries(PHRASES)){
    if(!raw.includes(phrase))continue
    const terms=[canon(phrase),...aliases.map(canon)].filter(Boolean)
    concepts.push({label:phrase,terms:[...new Set(terms)],weight:3,kind:'phrase'})
    for(const w of phrase.split(/[^a-z0-9+#.-]+/).map(canon).filter(Boolean))consumed.add(w)
  }
  const rawTokens=raw.replace(/next\.js/g,'nextjs').replace(/shadcn\/ui/g,'shadcn').split(/[^a-z0-9+#.-]+/).map(canon).filter(Boolean)
  for(const t of rawTokens){if(!t||STOP.has(t)||t.length<2||consumed.has(t))continue;if(concepts.some(c=>c.terms.includes(t)))continue;concepts.push({label:t,terms:[t],weight:t.length>7?1.5:1.15,kind:'token'})}
  const facets=new Map()
  for(const [needle,terms] of ZH_FACETS){
    if(!raw.includes(needle))continue
    for(const rawTerm of terms){const term=canon(rawTerm);if(term&&!facets.has(term))facets.set(term,needle)}
  }
  for(const [term,needle] of facets)concepts.push({label:`${needle}:${term}`,terms:[term],weight:2.25,kind:'zh-facet'})
  return concepts
}

const DEP_SIGNALS=[
  [/^next$/,['nextjs','react']],[/^react$/,['react']],[/^typescript$/,['typescript']],[/^tailwindcss$/,['tailwind']],
  [/^@ai-sdk\//,['ai-sdk','ai']],[/^ai$/,['ai-sdk','ai']],[/^@supabase\//,['supabase','postgres','database']],
  [/^prisma$/,['prisma','database']],[/^drizzle-orm$/,['drizzle','database']],[/^@cloudflare\//,['cloudflare-workers','workers']],
  [/^wrangler$/,['cloudflare-workers','workers']],[/^@playwright\//,['playwright','e2e','testing']],[/^vitest$/,['vitest','testing']],
  [/^expo$/,['expo','react-native','mobile']],[/^react-native$/,['react-native','mobile']],[/^vite$/,['vite']],[/^svelte$/,['svelte']],[/^vue$/,['vue']]
]
function projectContext(){
  if(process.env.SKILLRADAR_PROJECT_CONTEXT==='0')return {mode:'task-only',signals:[],evidence:[]}
  const cwd=process.cwd(),signals=new Set(),evidence=[]
  const add=(terms,why)=>{let changed=false;for(const t of terms){const c=canon(t);if(c&&!signals.has(c)){signals.add(c);changed=true}}if(changed)evidence.push(why)}
  try{
    const pkg=JSON.parse(fs.readFileSync(path.join(cwd,'package.json'),'utf8'))
    const deps={...(pkg.dependencies||{}),...(pkg.devDependencies||{}),...(pkg.peerDependencies||{})}
    for(const name of Object.keys(deps))for(const [pattern,terms] of DEP_SIGNALS)if(pattern.test(name)){add(terms,`dependency:${name}`);break}
  }catch{}
  const files=new Set();try{for(const name of fs.readdirSync(cwd).slice(0,200))files.add(name)}catch{}
  if(files.has('components.json'))add(['shadcn','design-system'],'file:components.json')
  if([...files].some(x=>/^wrangler\.(toml|jsonc?|yaml|yml)$/i.test(x)))add(['cloudflare-workers','workers'],'file:wrangler')
  if([...files].some(x=>/^tailwind\.config\./i.test(x)))add(['tailwind'],'file:tailwind-config')
  if([...files].some(x=>/^playwright\.config\./i.test(x)))add(['playwright','e2e','testing'],'file:playwright-config')
  if([...files].some(x=>/^vitest\.config\./i.test(x)))add(['vitest','testing'],'file:vitest-config')
  if(fs.existsSync(path.join(cwd,'app')))add(['app-router'],'dir:app')
  if(fs.existsSync(path.join(cwd,'supabase')))add(['supabase','postgres','database'],'dir:supabase')
  return signals.size?{mode:'project-aware',signals:[...signals],evidence:evidence.slice(0,20)}:{mode:'task-only',signals:[],evidence:[]}
}

function fieldText(s){return {identity:`${s.id||''} ${s.name||''}`.toLowerCase(),tags:`${(s.tags||[]).join(' ')} ${(s.uses||[]).join(' ')} ${(s.routingEvidence||[]).join(' ')}`.toLowerCase(),domains:`${(s.domains||[]).join(' ')} ${s.category||''}`.toLowerCase(),summary:String(s.summary||'').toLowerCase(),source:String(s.source||'').toLowerCase()}}
function fieldContains(text,term){const normalized=String(text).toLowerCase().replace(/next\.js/g,'nextjs').replace(/node\.?js/g,'node').replace(/shadcn\/ui/g,'shadcn').replace(/tool[ -]calling/g,'tool-calling').replace(/function[ -]calling/g,'function-calling').replace(/app[ -]router/g,'app-router').replace(/design[ -]system/g,'design-system').replace(/vulnerabilities/g,'vulnerability');const set=new Set(normalized.split(/[^a-z0-9+#.]+/).map(canon).filter(Boolean));return set.has(term)||(term.length>=5&&normalized.includes(term))}
function projectEvidence(fields,context){
  if(context.mode!=='project-aware'||!context.signals.length)return {matched:[],coverage:0,bonus:0}
  const matched=[]
  for(const signal of context.signals){if(Object.values(fields).some(text=>fieldContains(text,signal)))matched.push(signal)}
  const coverage=matched.length/context.signals.length
  const bonus=Math.min(6,matched.length*1.35+coverage*1.5)
  return {matched:[...new Set(matched)].slice(0,10),coverage:Number(coverage.toFixed(2)),bonus:Number(bonus.toFixed(1))}
}
function scoreSkill(s,query,context){
  const signals=querySignals(query),fields=fieldText(s),totalWeight=Math.max(1,signals.reduce((n,x)=>n+x.weight,0));let matchedWeight=0,evidence=0;const matched=[],matchedSignalWeights={},fieldHits={identity:0,tags:0,domains:0,summary:0,source:0}
  for(const sig of signals){
    let best=0,bestField=null,bestTerm=null
    for(const term of sig.terms){for(const [field,text] of Object.entries(fields)){if(!fieldContains(text,term))continue;const weight=field==='identity'?4.5:field==='tags'?3.7:field==='domains'?2.8:field==='summary'?2.1:.7;if(weight>best){best=weight;bestField=field;bestTerm=term}}}
    if(!bestField)continue
    const label=sig.label||bestTerm
    matchedWeight+=sig.weight;evidence+=sig.weight*best;fieldHits[bestField]++;matched.push(label);matchedSignalWeights[label]=Math.max(Number(matchedSignalWeights[label]||0),Number(sig.weight||0))
  }
  const coverage=matchedWeight/totalWeight
  const skillradar=s.score||70,securityBonus=s.security==='A'?4:s.security==='B'?2:s.security==='C'?0:-100,freshness=Math.max(0,Math.min(100,s.maintenance??70))*.04
  const coverageScore=coverage*55,evidenceScore=Math.min(22,evidence*1.45),qualityPrior=skillradar*.15,rawProject=projectEvidence(fields,context)
  const project={...rawProject,bonus:Number((coverage>0?rawProject.bonus:Math.min(2,rawProject.bonus)).toFixed(1))}
  const matchScore=Math.max(0,Math.min(100,Math.round(coverageScore+evidenceScore+qualityPrior+securityBonus+freshness+project.bonus)))
  const taskReason=matched.length?`Matched task signals: ${[...new Set(matched)].slice(0,8).join(', ')}; coverage ${Math.round(coverage*100)}%`:'No strong lexical task signal'
  const projectReason=project.matched.length?`; project context: ${project.matched.join(', ')} (+${project.bonus})`:''
  return {...s,match_score:matchScore,skillradar_score:skillradar,specialty_hits:fieldHits.identity+fieldHits.tags,match_details:{ranking_version:'2.1',matched_signals:[...new Set(matched)].slice(0,12),matched_signal_weights:matchedSignalWeights,coverage:Number(coverage.toFixed(2)),field_hits:fieldHits,quality_prior:Number(qualityPrior.toFixed(1)),security_bonus:securityBonus,freshness_bonus:Number(freshness.toFixed(1)),project_context_signals:project.matched,project_context_coverage:project.coverage,project_context_bonus:project.bonus},reason:`${taskReason}${projectReason}; security ${s.security}; SkillRadar score ${skillradar}.`}
}
function featureSet(s){return new Set([...(s.tags||[]),...(s.domains||[]),s.category||''].map(canon).filter(Boolean))}
function similarity(a,b){const x=featureSet(a),y=featureSet(b);if(!x.size||!y.size)return 0;let hit=0;for(const t of x)if(y.has(t))hit++;return hit/(x.size+y.size-hit)}
function taskSignalWeights(s){return s.match_details?.matched_signal_weights||{}}
const SPECIFICITY_SIGNALS=new Set(['playwright','mcp','rag','embeddings','orchestration','fastapi','node','graphql','postgres','redis','sqlite','vitest','docker','kubernetes','vulnerability','secrets','permissions','reactnative','expo','swiftui','android','kotlin','flutter','slack','gmail','calendar','webhook','documentation','github','notion','figma','poster'])
const CANDIDATE_EVIDENCE_RULES={
  mcp:{identity:['mcp'],minSignals:2},orchestration:{identity:['agent','orchestration'],minSignals:1},
  postgres:{identity:['postgres','postgresql'],minSignals:2},
  sqlite:{identity:['sqlite'],minSignals:2},vitest:{identity:['vitest'],minSignals:2},
  flutter:{identity:['flutter'],minSignals:2},webhook:{identity:['webhook','automation'],minSignals:2},
  poster:{evidence:['poster'],minSignals:2}
}
function requestedSpecificitySignals(query){
  return [...new Set(querySignals(query).map(x=>canon(x.label)).filter(x=>SPECIFICITY_SIGNALS.has(x)))]
}
function candidateEvidencePass(skill,required=[]){
  const matched=new Set((skill.match_details?.matched_signals||[]).map(canon)),identity=new Set(String(skill.name||'').toLowerCase().split(/[^a-z0-9+#.]+/).map(canon).filter(Boolean)),taskEvidence=new Set([...(skill.tags||[]),...(skill.uses||[]),...(skill.routingEvidence||[])].map(canon).filter(Boolean))
  const matchedRequired=required.filter(signal=>matched.has(signal))
  if(matchedRequired.some(signal=>!CANDIDATE_EVIDENCE_RULES[signal]))return true
  const applicable=matchedRequired.map(signal=>({signal,rule:CANDIDATE_EVIDENCE_RULES[signal]})).filter(x=>x.rule)
  if(!applicable.length)return true
  return applicable.some(({signal,rule})=>matched.has(signal)&&matched.size>=rule.minSignals&&(!rule.identity?.length||rule.identity.some(term=>identity.has(canon(term))))&&(!rule.evidence?.length||rule.evidence.some(term=>taskEvidence.has(canon(term)))))
}
function enforceSpecificity(ranked,required=[]){
  if(!required.length)return ranked
  const wanted=new Set(required)
  return ranked.filter(skill=>(skill.match_details?.matched_signals||[]).some(signal=>wanted.has(canon(signal)))&&candidateEvidencePass(skill,required))
}
function diversify(ranked,limit=3){
  if(!ranked.length)return[]
  const selected=[ranked[0]],pool=ranked.slice(1).filter(x=>x.match_score>Math.max(20,ranked[0].match_score-28)),covered=new Set(Object.keys(taskSignalWeights(ranked[0])))
  while(selected.length<limit&&pool.length){
    let bestIndex=0,bestScore=-Infinity
    for(let i=0;i<pool.length;i++){
      const c=pool[i],weights=taskSignalWeights(c);let uncoveredWeight=0
      for(const [label,weight] of Object.entries(weights))if(!covered.has(label))uncoveredWeight+=Number(weight)||0
      const complementBonus=Math.min(22,uncoveredWeight*4)
      const maxSim=Math.max(...selected.map(s=>similarity(c,s))),sameSource=selected.some(s=>s.source===c.source)?1:0
      const adjusted=c.match_score+complementBonus-maxSim*6-sameSource*.5
      if(adjusted>bestScore){bestScore=adjusted;bestIndex=i}
    }
    const chosen=pool.splice(bestIndex,1)[0];selected.push(chosen);for(const label of Object.keys(taskSignalWeights(chosen)))covered.add(label)
  }
  return selected.slice(0,limit)
}
function capabilityGap(matches,limit=3,required=[]){
  const returned=matches.length
  const reason=required.length
    ?`Fewer than 3 candidates had explicit evidence for the requested named technology/service signals (${required.join(', ')}); unrelated generic candidates were not backfilled.`
    :'Fewer than 3 candidates met the strong-match floor; weak candidates were not backfilled.'
  return returned<limit?{detected:true,requested:limit,returned,missing:limit-returned,reason}:{detected:false,requested:limit,returned,missing:0}
}
function safetyAdvisory(matches){const top=matches[0];if(!top||top.security!=='C')return null;const alternative=matches.slice(1).find(x=>['A','B'].includes(x.security)&&top.match_score-x.match_score<=5);if(!alternative)return {level:'review',message:'Top match is security grade C. Review its SKILL.md and scripts before installation or execution.'};return {level:'review',message:`Top match is security grade C. Prefer the nearby ${alternative.security}-grade alternative when task coverage is comparable.`,alternative:{id:alternative.id,name:alternative.name,match_score:alternative.match_score,skillradar_score:alternative.skillradar_score,security:alternative.security,source:alternative.source}}}
async function registryResult(){
  const loaded=await loadRegistry(),registry=loaded.skills,context=projectContext()
  if(cmd==='inspect'){const id=value.toLowerCase();const skill=registry.find(s=>String(s.id).toLowerCase()===id||String(s.name).toLowerCase()===id);if(!skill)throw new Error(`Skill not found or blocked by safety gate: ${value}`);return {source:'skillradar-registry',registry:loaded.meta,context,skill:{...skill,skillradar_score:skill.score||70}}}
  const ranked=registry.map(s=>scoreSkill(s,value,context)).filter(s=>cmd==='match'||s.match_score>24).sort((a,b)=>b.match_score-a.match_score||b.specialty_hits-a.specialty_hits||b.skillradar_score-a.skillradar_score)
  const requiredSpecificitySignals=requestedSpecificitySignals(value)
  const relevantRanked=enforceSpecificity(ranked,requiredSpecificitySignals)
  const specificity={enforced:requiredSpecificitySignals.length>0,required_signals:requiredSpecificitySignals,eligible_candidates:relevantRanked.length,filtered_candidates:ranked.length-relevantRanked.length}
  if(cmd==='match'){const matches=diversify(relevantRanked,3);return {source:'skillradar-registry',registry:loaded.meta,context,ranking:{version:'2.1',strategy:'task-first field-weighted evidence + coverage + quality/security/freshness prior + bounded project-context bonus + complementary task-facet coverage rerank; named technologies/services require explicit per-candidate evidence; weak candidates are not backfilled'},specificity,matches,capability_gap:capabilityGap(matches,3,requiredSpecificitySignals),advisory:safetyAdvisory(matches)}}
  return {source:'skillradar-registry',registry:loaded.meta,context,ranking:{version:'2.1'},specificity,skills:relevantRanked.slice(0,8)}
}
async function remote(){if(!base||offline)return null;if(cmd==='match'){const r=await fetch(`${base}/api/router`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({task:value,agent:'codex',limit:3})});if(!r.ok)throw new Error(`remote ${r.status}`);return r.json()}const endpoint=cmd==='inspect'?`/api/skill?id=${encodeURIComponent(value)}`:`/api/skills?q=${encodeURIComponent(value)}&limit=8`;const r=await fetch(base+endpoint);if(!r.ok)throw new Error(`remote ${r.status}`);return r.json()}
try{try{console.log(JSON.stringify(await registryResult(),null,2))}catch(localError){if(offline)throw localError;if(base){try{const result=await remote();if(result){console.log(JSON.stringify(result,null,2));process.exit(0)}}catch(remoteError){console.error(`Remote API fallback failed: ${remoteError.message}`)}}throw localError}}catch(e){console.error(e.message);process.exit(1)}
