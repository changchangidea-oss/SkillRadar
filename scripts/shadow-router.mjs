#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root=path.resolve('.')
const router=path.join(root,'packages/codex-plugin/scripts/skillradar.mjs')
const spec=JSON.parse(fs.readFileSync(path.join(root,'data/router-eval-v2.json'),'utf8'))
const bundledRegistry=JSON.parse(fs.readFileSync(path.join(root,'packages/codex-plugin/data/registry.json'),'utf8'))

function canon(value=''){
  return String(value).toLowerCase()
    .replace(/next\.js/g,'nextjs').replace(/shadcn\/ui/g,'shadcn')
    .replace(/tool[ -]calling/g,'tool-calling').replace(/function[ -]calling/g,'function-calling')
    .replace(/app[ -]router/g,'app-router').replace(/server[ -]components/g,'server-components')
    .replace(/design[ -]system/g,'design-system').replace(/react[ -]native/g,'react-native')
    .replace(/test[ -]driven[ -]development/g,'tdd')
    .replace(/[^a-z0-9+#.-]+/g,'-')
}
function run(command,task){
  const raw=execFileSync(process.execPath,[router,command,task],{cwd:root,encoding:'utf8',env:{...process.env,SKILLRADAR_OFFLINE:'1',SKILLRADAR_PROJECT_CONTEXT:'0'},stdio:['ignore','pipe','pipe']})
  return JSON.parse(raw)
}
function featureSet(s){return new Set([...(s.tags||[]),...(s.domains||[]),s.category||''].map(canon).filter(Boolean))}
function similarity(a,b){const x=featureSet(a),y=featureSet(b);if(!x.size||!y.size)return 0;let hit=0;for(const t of x)if(y.has(t))hit++;return hit/(x.size+y.size-hit)}
function weights(s){return s.match_details?.matched_signal_weights||{}}
function inferredGap(matches,limit=3){return matches.length<limit?{detected:true,requested:limit,returned:matches.length,missing:limit-matches.length}:{detected:false,requested:limit,returned:matches.length,missing:0}}

// Shadow candidate: production scoring stays untouched; only reranking is evaluated.
// The candidate must obey the same strong-match output contract as production:
// at most three results, with no weak backfill below the existing relative floor.
function candidateRerank(ranked,limit=3){
  if(!ranked.length)return []
  const floor=Math.max(20,Number(ranked[0].match_score||0)-28)
  const selected=[ranked[0]],pool=ranked.slice(1).filter(x=>Number(x.match_score||0)>=floor),covered=new Set(Object.keys(weights(ranked[0])))
  while(selected.length<limit&&pool.length){
    let bestIndex=0,best=-Infinity
    for(let i=0;i<pool.length;i++){
      const c=pool[i];let uncovered=0
      for(const [label,weight] of Object.entries(weights(c)))if(!covered.has(label))uncovered+=Number(weight)||0
      const complement=Math.min(26,uncovered*4.5)
      const maxSim=Math.max(...selected.map(s=>similarity(c,s)))
      const sameSource=selected.some(s=>s.source===c.source)?1:0
      const adjusted=Number(c.match_score||0)+complement-maxSim*5-sameSource*.75
      if(adjusted>best){best=adjusted;bestIndex=i}
    }
    const chosen=pool.splice(bestIndex,1)[0]
    selected.push(chosen)
    for(const label of Object.keys(weights(chosen)))covered.add(label)
  }
  return selected.slice(0,limit)
}
function evidenceSignals(matches){
  return [...new Set(matches.flatMap(x=>[
    ...(x.match_details?.matched_signals||[]),
    x.id||'',
    x.name||''
  ]).map(canon).filter(Boolean))]
}
function evaluate(test,matches,meta){
  const ids=new Set(matches.map(x=>x.id))
  const expectedHits=(test.expectedAnyIds||[]).filter(x=>ids.has(x)).length
  const signals=evidenceSignals(matches)
  const signalHits=(test.requiredSignalTerms||[]).filter(term=>signals.some(s=>s.includes(canon(term))||canon(term).includes(s))).length
  const unsafe=matches.filter(x=>['D','Blocked'].includes(x.security)).length
  const gap=meta.capabilityGap||inferredGap(matches,3)
  const gapConsistent=matches.length===3?!gap.detected:Boolean(gap.detected)&&Number(gap.returned)===matches.length&&Number(gap.missing)===3-matches.length
  const pass=meta.source==='skillradar-registry'&&meta.registryMode==='local-bundled'&&matches.length<=3&&gapConsistent&&unsafe===0&&expectedHits>=Number(test.minExpectedHits||0)&&signalHits>=Number(test.minSignalHits||0)
  return {id:test.id,domain:test.domain,tier:test.tier,pass,top3:matches.map(x=>x.id),recommendation_count:matches.length,capability_gap:Boolean(gap.detected),top1_score:Number(matches[0]?.match_score||0),expected_hits:expectedHits,signal_hits:signalHits,unsafe_top3:unsafe}
}
function summary(rows){
  const contract=rows.filter(x=>x.tier==='contract'),coverage=rows.filter(x=>x.tier!=='contract')
  const sum=(key)=>rows.reduce((n,x)=>n+Number(x[key]||0),0)
  return {
    cases:rows.length,
    passed:rows.filter(x=>x.pass).length,
    contractPassed:contract.filter(x=>x.pass).length,
    contractCases:contract.length,
    coveragePassed:coverage.filter(x=>x.pass).length,
    coverageCases:coverage.length,
    unsafeTop3:sum('unsafe_top3'),
    capabilityGapCases:rows.filter(x=>x.capability_gap).length,
    averageRecommendationCount:Number((sum('recommendation_count')/Math.max(1,rows.length)).toFixed(2)),
    expectedHitsTotal:sum('expected_hits'),
    signalHitsTotal:sum('signal_hits'),
    averageTop1Score:Number((sum('top1_score')/Math.max(1,rows.length)).toFixed(1))
  }
}

const productionRows=[],candidateRows=[],comparisons=[]
let registrySnapshot=null
for(const test of spec.cases){
  const prod=run('match',test.task)
  if(!registrySnapshot){
    if(prod.registry?.contentHash&&prod.registry.contentHash!==bundledRegistry.contentHash)throw new Error('router Registry contentHash does not match bundled Registry file')
    registrySnapshot={
      // Internal Shadow identity uses the stable routing hash. Legacy contentHash remains unchanged for compatibility.
      contentHash:bundledRegistry.routingContentHash||prod.registry?.contentHash||bundledRegistry.contentHash||null,
      contentHashVersion:Number(bundledRegistry.routingContentHashVersion||1),
      generatedAt:prod.registry?.generatedAt||bundledRegistry.generatedAt||null,
      totalCount:Number(prod.registry?.totalCount||bundledRegistry.totalCount||0),
      mode:prod.registry?.mode||'local-bundled'
    }
  }
  const search=run('search',test.task)
  const candidateMatches=candidateRerank(search.skills||[],3)
  const production=evaluate(test,prod.matches||[],{source:prod.source,registryMode:prod.registry?.mode,capabilityGap:prod.capability_gap})
  const candidate=evaluate(test,candidateMatches,{source:search.source,registryMode:search.registry?.mode,capabilityGap:inferredGap(candidateMatches,3)})
  productionRows.push(production);candidateRows.push(candidate)
  comparisons.push({id:test.id,productionPass:production.pass,candidatePass:candidate.pass,productionTop3:production.top3,candidateTop3:candidate.top3,productionRecommendationCount:production.recommendation_count,candidateRecommendationCount:candidate.recommendation_count,expectedHitDelta:candidate.expected_hits-production.expected_hits,signalHitDelta:candidate.signal_hits-production.signal_hits})
}
const production=summary(productionRows),candidate=summary(candidateRows)
const safetyPass=candidate.unsafeTop3===0
const contractNonRegression=candidate.contractPassed>=production.contractPassed
const coverageNonRegression=candidate.coveragePassed>=production.coveragePassed
const evidenceDelta=(candidate.expectedHitsTotal-production.expectedHitsTotal)+(candidate.signalHitsTotal-production.signalHitsTotal)
const clearWin=candidate.passed>production.passed||(candidate.passed===production.passed&&evidenceDelta>0)
const decision=!safetyPass||!contractNonRegression||!coverageNonRegression?'reject':clearWin?'snapshot-win':'hold'
const output={
  generatedAt:new Date().toISOString(),
  evalVersion:spec.schemaVersion,
  registrySnapshot,
  production:{profile:'ranking-v2.1',...production},
  candidate:{profile:'facet-heavy-rerank-v0.6-shadow',...candidate},
  gates:{safetyPass,contractNonRegression,coverageNonRegression,evidenceDelta},
  decision,
  note:'This is one shadow snapshot only. snapshot-win is evidence, not promotion eligibility. Promotion requires the separate multi-snapshot history gate and never changes production automatically.',
  comparisons
}
console.log(JSON.stringify(output,null,2))
if(process.env.SKILLRADAR_SHADOW_WRITE==='1')fs.writeFileSync(path.join(root,'data/router-shadow-latest.json'),JSON.stringify(output,null,2)+'\n')
if(!safetyPass||!contractNonRegression||!coverageNonRegression)process.exitCode=1
if(process.env.SKILLRADAR_SHADOW_STRICT==='1'&&decision!=='snapshot-win')process.exitCode=1
