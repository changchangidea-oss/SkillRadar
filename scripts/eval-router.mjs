#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root=path.resolve('.')
const router=path.join(root,'packages/codex-plugin/scripts/skillradar.mjs')
const spec=JSON.parse(fs.readFileSync(path.join(root,'data/router-eval-v2.json'),'utf8'))

function canon(value=''){
  return String(value).toLowerCase()
    .replace(/next\.js/g,'nextjs')
    .replace(/shadcn\/ui/g,'shadcn')
    .replace(/tool[ -]calling/g,'tool-calling')
    .replace(/function[ -]calling/g,'function-calling')
    .replace(/app[ -]router/g,'app-router')
    .replace(/server[ -]components/g,'server-components')
    .replace(/design[ -]system/g,'design-system')
    .replace(/reverse[ -]engineering/g,'reverse-engineering')
    .replace(/react[ -]native/g,'react-native')
    .replace(/[^a-z0-9+#.-]+/g,'-')
}

function runRouter(command,task,extraEnv={}){
  const raw=execFileSync(process.execPath,[router,command,task],{
    cwd:root,
    encoding:'utf8',
    env:{...process.env,SKILLRADAR_OFFLINE:'1',SKILLRADAR_PROJECT_CONTEXT:'0',...extraEnv},
    stdio:['ignore','pipe','pipe']
  })
  return JSON.parse(raw)
}

export function evaluateCase(test,matches,meta={}){
  const ids=new Set((matches||[]).map(x=>x.id))
  const expectedHits=(test.expectedAnyIds||[]).filter(x=>ids.has(x)).length
  const signals=[...new Set((matches||[]).flatMap(x=>x.match_details?.matched_signals||[]).map(canon))]
  const signalHits=(test.requiredSignalTerms||[]).filter(term=>signals.some(s=>s.includes(canon(term))||canon(term).includes(s))).length
  const unsafe=(matches||[]).filter(x=>['D','Blocked'].includes(x.security)).length
  const structural=meta.source==='skillradar-registry'&&meta.registryMode==='local-bundled'&&(matches||[]).length===3
  const pass=structural&&unsafe===0&&expectedHits>=Number(test.minExpectedHits||0)&&signalHits>=Number(test.minSignalHits||0)
  return {
    id:test.id,
    domain:test.domain,
    tier:test.tier,
    pass,
    top3:(matches||[]).map(x=>x.id),
    top1_score:Number(matches?.[0]?.match_score||0),
    expected_hits:expectedHits,
    signal_hits:signalHits,
    unsafe_top3:unsafe,
    signals
  }
}

export function summarize(results){
  const contract=results.filter(x=>x.tier==='contract')
  const coverage=results.filter(x=>x.tier!=='contract')
  const unsafeTop3=results.reduce((n,x)=>n+x.unsafe_top3,0)
  const avgTop1=results.length?results.reduce((n,x)=>n+x.top1_score,0)/results.length:0
  const byDomain={}
  for(const row of results){
    const bucket=byDomain[row.domain]||{cases:0,passed:0}
    bucket.cases++;if(row.pass)bucket.passed++
    byDomain[row.domain]=bucket
  }
  for(const bucket of Object.values(byDomain))bucket.passRate=Number((bucket.passed/Math.max(1,bucket.cases)).toFixed(3))
  return {
    cases:results.length,
    passed:results.filter(x=>x.pass).length,
    passRate:Number((results.filter(x=>x.pass).length/Math.max(1,results.length)).toFixed(3)),
    contract:{cases:contract.length,passed:contract.filter(x=>x.pass).length,passRate:Number((contract.filter(x=>x.pass).length/Math.max(1,contract.length)).toFixed(3))},
    coverage:{cases:coverage.length,passed:coverage.filter(x=>x.pass).length,passRate:Number((coverage.filter(x=>x.pass).length/Math.max(1,coverage.length)).toFixed(3))},
    unsafeTop3,
    averageTop1Score:Number(avgTop1.toFixed(1)),
    byDomain
  }
}

const results=[]
for(const test of spec.cases){
  const result=runRouter('match',test.task)
  results.push(evaluateCase(test,result.matches||[],{source:result.source,registryMode:result.registry?.mode}))
}
const metrics=summarize(results)
const output={generatedAt:new Date().toISOString(),evalVersion:spec.schemaVersion,rankingVersion:'2.1',...metrics,results}
console.log(JSON.stringify(output,null,2))
if(process.env.SKILLRADAR_EVAL_WRITE==='1')fs.writeFileSync(path.join(root,'data/router-eval-latest.json'),JSON.stringify(output,null,2)+'\n')

const t=spec.thresholds||{}
if(metrics.contract.passRate<Number(t.contractPassRate??1))process.exitCode=1
if(metrics.coverage.passRate<Number(t.coveragePassRate??0))process.exitCode=1
if(metrics.unsafeTop3>Number(t.unsafeTop3??0))process.exitCode=1
if(metrics.averageTop1Score<Number(t.minAverageTop1Score??0))process.exitCode=1
