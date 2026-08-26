#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { applySpecificityPolicy, canon, evaluateRoutingCase, summarizeRoutingResults } from './lib/router-eval-policy.mjs'

const root=path.resolve('.')
const router=path.join(root,'packages/codex-plugin/scripts/skillradar.mjs')
const spec=JSON.parse(fs.readFileSync(path.join(root,'data/router-eval-v2.json'),'utf8'))
const specificity=JSON.parse(fs.readFileSync(path.join(root,'data/router-eval-specificity.json'),'utf8'))
const bundledRegistry=JSON.parse(fs.readFileSync(path.join(root,'packages/codex-plugin/data/registry.json'),'utf8'))

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

function shadowSummary(rows){
  const m=summarizeRoutingResults(rows)
  return {
    cases:m.cases,
    passed:m.passed,
    contractPassed:m.contract.passed,
    contractCases:m.contract.cases,
    coveragePassed:m.coverage.passed,
    coverageCases:m.coverage.cases,
    unsafeTop3:m.unsafeTop3,
    lowEvidenceTop3:m.lowEvidenceTop3,
    specificityFailures:m.specificityFailures,
    capabilityGapCases:m.capabilityGapCases,
    averageRecommendationCount:m.averageRecommendationCount,
    expectedHitsTotal:m.expectedHitsTotal,
    signalHitsTotal:m.signalHitsTotal,
    anchorSignalHitsTotal:m.anchorSignalHitsTotal,
    averageTop1Score:m.averageTop1Score
  }
}

const productionRows=[],candidateRows=[],comparisons=[]
let registrySnapshot=null
for(const rawTest of spec.cases){
  const test=applySpecificityPolicy(rawTest,specificity)
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
  const production=evaluateRoutingCase(test,prod.matches||[],{source:prod.source,registryMode:prod.registry?.mode,capabilityGap:prod.capability_gap})
  const candidate=evaluateRoutingCase(test,candidateMatches,{source:search.source,registryMode:search.registry?.mode,capabilityGap:inferredGap(candidateMatches,3)})
  productionRows.push(production);candidateRows.push(candidate)
  comparisons.push({
    id:test.id,
    productionPass:production.pass,
    candidatePass:candidate.pass,
    productionSpecificityPass:production.specificity_pass,
    candidateSpecificityPass:candidate.specificity_pass,
    productionTop3:production.top3,
    candidateTop3:candidate.top3,
    productionRecommendationCount:production.recommendation_count,
    candidateRecommendationCount:candidate.recommendation_count,
    expectedHitDelta:candidate.expected_hits-production.expected_hits,
    signalHitDelta:candidate.signal_hits-production.signal_hits,
    anchorSignalHitDelta:candidate.anchor_signal_hits-production.anchor_signal_hits,
    lowEvidenceDelta:candidate.low_evidence_top3-production.low_evidence_top3
  })
}
const production=shadowSummary(productionRows),candidate=shadowSummary(candidateRows)
const safetyPass=candidate.unsafeTop3===0
const contractNonRegression=candidate.contractPassed>=production.contractPassed
const coverageNonRegression=candidate.coveragePassed>=production.coveragePassed
const evidenceDelta=(candidate.expectedHitsTotal-production.expectedHitsTotal)+(candidate.signalHitsTotal-production.signalHitsTotal)+(candidate.anchorSignalHitsTotal-production.anchorSignalHitsTotal)+(production.lowEvidenceTop3-candidate.lowEvidenceTop3)
const clearWin=candidate.passed>production.passed||(candidate.passed===production.passed&&evidenceDelta>0)
const decision=!safetyPass||!contractNonRegression||!coverageNonRegression?'reject':clearWin?'snapshot-win':'hold'
const output={
  generatedAt:new Date().toISOString(),
  evalVersion:spec.schemaVersion,
  specificityPolicyVersion:specificity.qualityPolicyVersion||specificity.schemaVersion||1,
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
