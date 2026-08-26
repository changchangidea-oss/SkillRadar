#!/usr/bin/env node
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = path.resolve('.')
const router = path.join(root, 'packages/codex-plugin/scripts/skillradar.mjs')
const benchmarkPath = path.join(root, 'data/router-benchmark.json')
const spec = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'))

function canon(value='') {
  return String(value).toLowerCase()
    .replace(/next\.js/g, 'nextjs')
    .replace(/shadcn\/ui/g, 'shadcn')
    .replace(/tool[ -]calling/g, 'tool-calling')
    .replace(/function[ -]calling/g, 'function-calling')
    .replace(/app[ -]router/g, 'app-router')
    .replace(/server[ -]components/g, 'server-components')
    .replace(/design[ -]system/g, 'design-system')
    .replace(/[^a-z0-9+#.-]+/g, '-')
}

function runMatch(task, cwd=root, extraEnv={}) {
  const raw = execFileSync(process.execPath, [router, 'match', task], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, SKILLRADAR_OFFLINE: '1', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  return JSON.parse(raw)
}

const results=[]
let unsafeTop3=0
let top1ScoreTotal=0
let capabilityGapCases=0
let recommendationTotal=0
for (const test of spec.cases) {
  const result=runMatch(test.task, root, {SKILLRADAR_PROJECT_CONTEXT:'0'})
  const matches=result.matches||[]
  const ids=new Set(matches.map(x=>x.id))
  const expectedHits=(test.expectedAnyIds||[]).filter(x=>ids.has(x)).length
  const signals=[...new Set(matches.flatMap(x=>x.match_details?.matched_signals||[]).map(canon))]
  const signalHits=(test.requiredSignalTerms||[]).filter(term=>signals.some(s=>s.includes(canon(term)))).length
  const unsafe=matches.filter(x=>['D','Blocked'].includes(x.security)).length
  const gap=result.capability_gap||null
  const gapConsistent=matches.length===3
    ? !gap?.detected
    : Boolean(gap?.detected)&&Number(gap?.returned)===matches.length&&Number(gap?.missing)===3-matches.length
  unsafeTop3+=unsafe
  if(gap?.detected)capabilityGapCases++
  recommendationTotal+=matches.length
  top1ScoreTotal+=Number(matches[0]?.match_score||0)
  const pass = result.source==='skillradar-registry'
    && result.registry?.mode==='local-bundled'
    && result.ranking?.version==='2.1'
    && matches.length<=3
    && gapConsistent
    && unsafe===0
    && expectedHits>=Number(test.minExpectedHits||0)
    && signalHits>=Number(test.minSignalHits||0)
  results.push({id:test.id,pass,top3:matches.map(x=>x.id),recommendation_count:matches.length,capability_gap:Boolean(gap?.detected),top1_score:matches[0]?.match_score||0,expected_hits:expectedHits,signal_hits:signalHits,signals,context:result.context})
}

// Project context must be a bounded secondary signal, not a replacement for task evidence.
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'skillradar-context-benchmark-'))
fs.writeFileSync(path.join(tmp,'package.json'), JSON.stringify({
  name:'fixture-next-app',
  dependencies:{next:'16.0.0',react:'19.0.0','@ai-sdk/react':'1.0.0'}
},null,2))
fs.writeFileSync(path.join(tmp,'components.json'), '{}')
const fixture={
  schemaVersion:2,generatedAt:'test',source:'context-fixture',coreCount:3,designCount:0,generalCount:0,totalCount:3,contentHash:'context-fixture',
  core:[
    {id:'next-context',name:'Next Context',source:'fixture/next',category:'Frontend',tags:['nextjs','react','app-router','shadcn','ai-sdk'],summary:'Next.js application architecture',security:'A',score:80,maintenance:80},
    {id:'python-context',name:'Python Context',source:'fixture/python',category:'Backend',tags:['python','fastapi'],summary:'Python service architecture',security:'A',score:80,maintenance:80},
    {id:'generic-context',name:'Generic Context',source:'fixture/generic',category:'Architecture',tags:['architecture'],summary:'Generic application architecture',security:'A',score:80,maintenance:80}
  ],design:[],general:[]
}
const fixturePath=path.join(tmp,'registry.json')
fs.writeFileSync(fixturePath,JSON.stringify(fixture))
const contextual=runMatch('improve this application architecture',tmp,{SKILLRADAR_REGISTRY_PATH:fixturePath,SKILLRADAR_PROJECT_CONTEXT:'1'})
const contextPass=contextual.context?.mode==='project-aware'
  && contextual.context?.signals?.includes('nextjs')
  && contextual.context?.signals?.includes('shadcn')
  && contextual.matches?.[0]?.id==='next-context'
  && Number(contextual.matches?.[0]?.match_details?.project_context_bonus||0)>0
  && Number(contextual.matches?.[0]?.match_details?.project_context_bonus||0)<=6
fs.rmSync(tmp,{recursive:true,force:true})

const passCount=results.filter(x=>x.pass).length
const passRate=results.length?passCount/results.length:0
const avgTop1=results.length?top1ScoreTotal/results.length:0
const avgRecommendations=results.length?recommendationTotal/results.length:0
const summary={
  generatedAt:new Date().toISOString(),
  benchmarkVersion:spec.schemaVersion,
  rankingVersion:'2.1',
  cases:results.length,
  passed:passCount,
  passRate:Number(passRate.toFixed(3)),
  unsafeTop3,
  capabilityGapCases,
  averageRecommendationCount:Number(avgRecommendations.toFixed(2)),
  averageTop1Score:Number(avgTop1.toFixed(1)),
  projectContextFixture:contextPass?'passed':'failed',
  results
}
console.log(JSON.stringify(summary,null,2))
if(process.env.SKILLRADAR_BENCHMARK_WRITE==='1') fs.writeFileSync(path.join(root,'data/router-benchmark-latest.json'),JSON.stringify(summary,null,2)+'\n')

const thresholds=spec.thresholds||{}
if(passRate<Number(thresholds.passRate??1)) process.exitCode=1
if(unsafeTop3>Number(thresholds.unsafeTop3??0)) process.exitCode=1
if(avgTop1<Number(thresholds.minAverageTop1Score??0)) process.exitCode=1
if(!contextPass) process.exitCode=1
