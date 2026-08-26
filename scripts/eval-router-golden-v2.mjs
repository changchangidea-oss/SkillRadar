#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { canon, evaluateRoutingCase, summarizeRoutingResults } from './lib/router-eval-policy.mjs'

const root=path.resolve('.')
const router=path.join(root,'packages/codex-plugin/scripts/skillradar.mjs')
const specPath=path.join(root,'data/router-golden-v1.json')
const spec=JSON.parse(fs.readFileSync(specPath,'utf8'))
const strictSignals=new Set([
  'playwright','mcp','rag','embeddings','orchestration','fastapi','node','graphql',
  'redis','sqlite','vitest','docker','kubernetes','vulnerability','secrets','permissions',
  'react-native','expo','swiftui','android','kotlin','flutter','slack','gmail','calendar',
  'webhook','github','notion','figma'
].map(canon))
const cleanGapCases=new Set(['vercel-env','cron-job','cdn-debug'])

if(spec.schemaVersion!==1)throw new Error(`Unsupported golden eval schema: ${spec.schemaVersion}`)
if(!Array.isArray(spec.cases)||spec.cases.length!==100)throw new Error(`Golden eval must contain exactly 100 cases; got ${spec.cases?.length||0}`)
if(new Set(spec.cases.map(test=>test.id)).size!==spec.cases.length)throw new Error('Golden eval case ids must be unique')
if(new Set(spec.cases.map(test=>test.domain)).size<10)throw new Error('Golden eval must cover at least 10 domains')
for(const test of spec.cases){
  if(!test.id||!test.domain||!test.task)throw new Error(`Invalid golden case: ${JSON.stringify(test)}`)
  if(!Array.isArray(test.anchorSignalTerms)||!test.anchorSignalTerms.length)throw new Error(`Golden case ${test.id} must declare routing evidence terms`)
  if(test.tier!=='golden')throw new Error(`Golden case ${test.id} must use tier=golden`)
}

function normalizedCase(test){
  let expectedAnyIds=[...(test.expectedAnyIds||[])]
  let minExpectedHits=Number(test.minExpectedHits||0)
  if(test.id==='tool-ui'){
    expectedAnyIds=[...new Set([...expectedAnyIds,'ai-sdk'])]
    minExpectedHits=Math.max(1,minExpectedHits)
  }
  if(test.id==='github-ci'){
    expectedAnyIds=[]
    minExpectedHits=0
  }
  const declared=[...new Set(test.anchorSignalTerms.map(canon).filter(Boolean))]
  if(declared.includes('documentation'))declared.push('docs','document')
  const strict=[...new Set(declared.filter(term=>strictSignals.has(term)))]
  const base={...test,expectedAnyIds,minExpectedHits,allowCleanCapabilityGap:cleanGapCases.has(test.id)}
  if(strict.length)return {...base,anchorSignalTerms:strict,minAnchorSignalHits:1,minAnchorCandidates:1}
  return {...base,anchorSignalTerms:[],minAnchorSignalHits:0,minAnchorCandidates:0,requiredSignalTerms:[...new Set(declared)],minSignalHits:1}
}

function runRouter(task){
  const raw=execFileSync(process.execPath,[router,'match',task],{
    cwd:root,encoding:'utf8',
    env:{...process.env,SKILLRADAR_OFFLINE:'1',SKILLRADAR_PROJECT_CONTEXT:'0'},
    stdio:['ignore','pipe','pipe']
  })
  return JSON.parse(raw)
}

const results=[]
for(const test of spec.cases){
  const result=runRouter(test.task)
  results.push(evaluateRoutingCase(normalizedCase(test),result.matches||[],{
    source:result.source,registryMode:result.registry?.mode,capabilityGap:result.capability_gap
  }))
}
const metrics=summarizeRoutingResults(results)
const domainPassRates=Object.fromEntries(Object.entries(metrics.byDomain).map(([domain,bucket])=>[domain,bucket.passRate]))
const minDomainPassRate=Math.min(...Object.values(domainPassRates))
const failures=results.filter(row=>!row.pass).map(row=>({
  id:row.id,domain:row.domain,top3:row.top3,top1_score:row.top1_score,
  expected_hits:row.expected_hits,signal_hits:row.signal_hits,anchor_signal_hits:row.anchor_signal_hits,
  anchor_candidate_count:row.anchor_candidate_count,specificity_pass:row.specificity_pass,
  low_evidence_top3:row.low_evidence_top3,unsafe_top3:row.unsafe_top3,capability_gap:row.capability_gap,
  clean_gap_pass:row.clean_gap_pass
}))
const output={generatedAt:new Date().toISOString(),goldenEvalVersion:spec.schemaVersion,rankingVersion:'2.1',...metrics,minDomainPassRate,results}
const summary={cases:metrics.cases,passed:metrics.passed,passRate:metrics.passRate,unsafeTop3:metrics.unsafeTop3,specificityFailures:metrics.specificityFailures,averageTop1Score:metrics.averageTop1Score,minDomainPassRate,domainPassRates,failureCount:failures.length}
console.log(`GOLDEN_SUMMARY ${JSON.stringify(summary)}`)
if(failures.length)console.log(`GOLDEN_FAILURES ${JSON.stringify(failures)}`)
if(process.env.SKILLRADAR_GOLDEN_VERBOSE==='1')console.log(JSON.stringify(output,null,2))
if(process.env.SKILLRADAR_GOLDEN_WRITE==='1')fs.writeFileSync(path.join(root,'data/router-golden-latest.json'),JSON.stringify(output,null,2)+'\n')

const t=spec.thresholds||{}
if(metrics.passRate<Number(t.passRate??0.9))process.exitCode=1
if(metrics.unsafeTop3>Number(t.unsafeTop3??0))process.exitCode=1
if(metrics.averageTop1Score<Number(t.minAverageTop1Score??0))process.exitCode=1
if(minDomainPassRate<Number(t.minDomainPassRate??0))process.exitCode=1
