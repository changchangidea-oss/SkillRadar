#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root=path.resolve('.')
const router=path.join(root,'packages/codex-plugin/scripts/skillradar.mjs')
const spec=JSON.parse(fs.readFileSync(path.join(root,'data/router-eval-v2.json'),'utf8'))

function canon(value=''){
  return String(value).toLowerCase()
    .replace(/next\.js/g,'nextjs').replace(/shadcn\/ui/g,'shadcn')
    .replace(/tool[ -]calling/g,'tool-calling').replace(/function[ -]calling/g,'function-calling')
    .replace(/app[ -]router/g,'app-router').replace(/server[ -]components/g,'server-components')
    .replace(/design[ -]system/g,'design-system').replace(/react[ -]native/g,'react-native')
    .replace(/[^a-z0-9+#.-]+/g,'-')
}
function run(command,task){
  const raw=execFileSync(process.execPath,[router,command,task],{cwd:root,encoding:'utf8',env:{...process.env,SKILLRADAR_OFFLINE:'1',SKILLRADAR_PROJECT_CONTEXT:'0'},stdio:['ignore','pipe','pipe']})
  return JSON.parse(raw)
}
function featureSet(s){return new Set([...(s.tags||[]),...(s.domains||[]),s.category||''].map(canon).filter(Boolean))}
function similarity(a,b){const x=featureSet(a),y=featureSet(b);if(!x.size||!y.size)return 0;let hit=0;for(const t of x)if(y.has(t))hit++;return hit/(x.size+y.size-hit)}
function weights(s){return s.match_details?.matched_signal_weights||{}}

// Shadow candidate: production scoring stays untouched; only Top-3 reranking is evaluated.
// It is not used by normal SkillRadar routing and cannot promote itself.
function candidateRerank(ranked,limit=3){
  if(!ranked.length)return []
  const selected=[ranked[0]],pool=ranked.slice(1),covered=new Set(Object.keys(weights(ranked[0])))
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
function evaluate(test,matches,meta){
  const ids=new Set(matches.map(x=>x.id))
  const expectedHits=(test.expectedAnyIds||[]).filter(x=>ids.has(x)).length
  const signals=[...new Set(matches.flatMap(x=>x.match_details?.matched_signals||[]).map(canon))]
  const signalHits=(test.requiredSignalTerms||[]).filter(term=>signals.some(s=>s.includes(canon(term))||canon(term).includes(s))).length
  const unsafe=matches.filter(x=>['D','Blocked'].includes(x.security)).length
  const pass=meta.source==='skillradar-registry'&&meta.registryMode==='local-bundled'&&matches.length===3&&unsafe===0&&expectedHits>=Number(test.minExpectedHits||0)&&signalHits>=Number(test.minSignalHits||0)
  return {id:test.id,domain:test.domain,tier:test.tier,pass,top3:matches.map(x=>x.id),top1_score:Number(matches[0]?.match_score||0),expected_hits:expectedHits,signal_hits:signalHits,unsafe_top3:unsafe}
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
    expectedHitsTotal:sum('expected_hits'),
    signalHitsTotal:sum('signal_hits'),
    averageTop1Score:Number((sum('top1_score')/Math.max(1,rows.length)).toFixed(1))
  }
}

const productionRows=[],candidateRows=[],comparisons=[]
for(const test of spec.cases){
  const prod=run('match',test.task)
  const search=run('search',test.task)
  const production=evaluate(test,prod.matches||[],{source:prod.source,registryMode:prod.registry?.mode})
  const candidate=evaluate(test,candidateRerank(search.skills||[],3),{source:search.source,registryMode:search.registry?.mode})
  productionRows.push(production);candidateRows.push(candidate)
  comparisons.push({id:test.id,productionPass:production.pass,candidatePass:candidate.pass,productionTop3:production.top3,candidateTop3:candidate.top3,expectedHitDelta:candidate.expected_hits-production.expected_hits,signalHitDelta:candidate.signal_hits-production.signal_hits})
}
const production=summary(productionRows),candidate=summary(candidateRows)
const safetyPass=candidate.unsafeTop3===0
const contractNonRegression=candidate.contractPassed>=production.contractPassed
const coverageNonRegression=candidate.coveragePassed>=production.coveragePassed
const evidenceDelta=(candidate.expectedHitsTotal-production.expectedHitsTotal)+(candidate.signalHitsTotal-production.signalHitsTotal)
const clearWin=candidate.passed>production.passed||(candidate.passed===production.passed&&evidenceDelta>0)
const decision=!safetyPass||!contractNonRegression||!coverageNonRegression?'reject':clearWin?'promotion-eligible':'hold'
const output={
  generatedAt:new Date().toISOString(),
  evalVersion:spec.schemaVersion,
  production:{profile:'ranking-v2.1',...production},
  candidate:{profile:'facet-heavy-rerank-v0.6-shadow',...candidate},
  gates:{safetyPass,contractNonRegression,coverageNonRegression,evidenceDelta},
  decision,
  note:'Shadow output is evidence only. It never changes production weights or routing automatically.',
  comparisons
}
console.log(JSON.stringify(output,null,2))
if(process.env.SKILLRADAR_SHADOW_WRITE==='1')fs.writeFileSync(path.join(root,'data/router-shadow-latest.json'),JSON.stringify(output,null,2)+'\n')
if(!safetyPass||!contractNonRegression)process.exitCode=1
if(process.env.SKILLRADAR_SHADOW_STRICT==='1'&&decision!=='promotion-eligible')process.exitCode=1
