#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { applySpecificityPolicy, evaluateRoutingCase, summarizeRoutingResults } from './lib/router-eval-policy.mjs'

const root=path.resolve('.')
const router=path.join(root,'packages/codex-plugin/scripts/skillradar.mjs')
const spec=JSON.parse(fs.readFileSync(path.join(root,'data/router-eval-v2.json'),'utf8'))
const specificity=JSON.parse(fs.readFileSync(path.join(root,'data/router-eval-specificity.json'),'utf8'))

function runRouter(command,task,extraEnv={}){
  const raw=execFileSync(process.execPath,[router,command,task],{
    cwd:root,
    encoding:'utf8',
    env:{...process.env,SKILLRADAR_OFFLINE:'1',SKILLRADAR_PROJECT_CONTEXT:'0',...extraEnv},
    stdio:['ignore','pipe','pipe']
  })
  return JSON.parse(raw)
}

const results=[]
for(const rawTest of spec.cases){
  const test=applySpecificityPolicy(rawTest,specificity)
  const result=runRouter('match',test.task)
  results.push(evaluateRoutingCase(test,result.matches||[],{
    source:result.source,
    registryMode:result.registry?.mode,
    capabilityGap:result.capability_gap
  }))
}
const metrics=summarizeRoutingResults(results)
const output={
  generatedAt:new Date().toISOString(),
  evalVersion:spec.schemaVersion,
  specificityPolicyVersion:specificity.qualityPolicyVersion||specificity.schemaVersion||1,
  rankingVersion:'2.1',
  ...metrics,
  results
}
console.log(JSON.stringify(output,null,2))
if(process.env.SKILLRADAR_EVAL_WRITE==='1')fs.writeFileSync(path.join(root,'data/router-eval-latest.json'),JSON.stringify(output,null,2)+'\n')

const t=spec.thresholds||{}
if(metrics.contract.passRate<Number(t.contractPassRate??1))process.exitCode=1
if(metrics.coverage.passRate<Number(t.coveragePassRate??0))process.exitCode=1
if(metrics.unsafeTop3>Number(t.unsafeTop3??0))process.exitCode=1
if(metrics.lowEvidenceTop3>Number(t.lowEvidenceTop3??0))process.exitCode=1
if(metrics.candidateEvidenceFailures>Number(t.candidateEvidenceFailures??0))process.exitCode=1
if(metrics.averageTop1Score<Number(t.minAverageTop1Score??0))process.exitCode=1
