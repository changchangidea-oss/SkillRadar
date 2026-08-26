#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { evaluateRoutingCase, summarizeRoutingResults } from './lib/router-eval-policy.mjs'

const root=path.resolve('.')
const router=path.join(root,'packages/codex-plugin/scripts/skillradar.mjs')
const specPath=path.join(root,'data/router-golden-v1.json')
const spec=JSON.parse(fs.readFileSync(specPath,'utf8'))

if(spec.schemaVersion!==1)throw new Error(`Unsupported golden eval schema: ${spec.schemaVersion}`)
if(!Array.isArray(spec.cases)||spec.cases.length!==100)throw new Error(`Golden eval must contain exactly 100 cases; got ${spec.cases?.length||0}`)
const ids=new Set(spec.cases.map(test=>test.id))
if(ids.size!==spec.cases.length)throw new Error('Golden eval case ids must be unique')
const domains=new Set(spec.cases.map(test=>test.domain))
if(domains.size<10)throw new Error(`Golden eval must cover at least 10 domains; got ${domains.size}`)
for(const test of spec.cases){
  if(!test.id||!test.domain||!test.task)throw new Error(`Invalid golden case: ${JSON.stringify(test)}`)
  if(!Array.isArray(test.anchorSignalTerms)||test.anchorSignalTerms.length===0)throw new Error(`Golden case ${test.id} must declare anchorSignalTerms`)
  if(test.tier!=='golden')throw new Error(`Golden case ${test.id} must use tier=golden`)
}

function runRouter(task){
  const raw=execFileSync(process.execPath,[router,'match',task],{
    cwd:root,
    encoding:'utf8',
    env:{...process.env,SKILLRADAR_OFFLINE:'1',SKILLRADAR_PROJECT_CONTEXT:'0'},
    stdio:['ignore','pipe','pipe']
  })
  return JSON.parse(raw)
}

const results=[]
for(const test of spec.cases){
  const result=runRouter(test.task)
  results.push(evaluateRoutingCase(test,result.matches||[],{
    source:result.source,
    registryMode:result.registry?.mode,
    capabilityGap:result.capability_gap
  }))
}

const metrics=summarizeRoutingResults(results)
const domainPassRates=Object.fromEntries(Object.entries(metrics.byDomain).map(([domain,bucket])=>[domain,bucket.passRate]))
const minDomainPassRate=Math.min(...Object.values(domainPassRates))
const output={
  generatedAt:new Date().toISOString(),
  goldenEvalVersion:spec.schemaVersion,
  rankingVersion:'2.1',
  cases:metrics.cases,
  passed:metrics.passed,
  passRate:metrics.passRate,
  unsafeTop3:metrics.unsafeTop3,
  lowEvidenceTop3:metrics.lowEvidenceTop3,
  specificityFailures:metrics.specificityFailures,
  capabilityGapCases:metrics.capabilityGapCases,
  averageRecommendationCount:metrics.averageRecommendationCount,
  averageRelevantTop3:metrics.averageRelevantTop3,
  averageTop1Score:metrics.averageTop1Score,
  minDomainPassRate,
  byDomain:metrics.byDomain,
  results
}
console.log(JSON.stringify(output,null,2))
if(process.env.SKILLRADAR_GOLDEN_WRITE==='1')fs.writeFileSync(path.join(root,'data/router-golden-latest.json'),JSON.stringify(output,null,2)+'\n')

const t=spec.thresholds||{}
if(metrics.passRate<Number(t.passRate??0.9))process.exitCode=1
if(metrics.unsafeTop3>Number(t.unsafeTop3??0))process.exitCode=1
if(metrics.averageTop1Score<Number(t.minAverageTop1Score??0))process.exitCode=1
if(minDomainPassRate<Number(t.minDomainPassRate??0))process.exitCode=1
