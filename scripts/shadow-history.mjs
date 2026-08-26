#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function hashVersion(snapshot){return Number(snapshot.registrySnapshot?.contentHashVersion||1)}
function fingerprint(snapshot){
  const hash=snapshot.registrySnapshot?.contentHash||''
  return [hashVersion(snapshot),hash,snapshot.evalVersion||'',snapshot.production?.profile||'',snapshot.candidate?.profile||''].join('::')
}
function compact(snapshot){
  return {
    generatedAt:snapshot.generatedAt,
    registrySnapshot:snapshot.registrySnapshot||null,
    evalVersion:snapshot.evalVersion,
    production:snapshot.production,
    candidate:snapshot.candidate,
    gates:snapshot.gates,
    decision:snapshot.decision
  }
}
export function evaluateHistory(existing,current,{required=3,limit=20}={}){
  const history=Array.isArray(existing?.snapshots)?existing.snapshots.slice():[]
  const candidate=compact(current)
  const key=fingerprint(candidate)
  const currentHashVersion=hashVersion(candidate)
  if(!candidate.registrySnapshot?.contentHash)throw new Error('shadow snapshot missing registrySnapshot.contentHash')
  if(!['snapshot-win','hold','reject'].includes(candidate.decision))throw new Error(`invalid single-snapshot decision: ${candidate.decision}`)
  const idx=history.findIndex(x=>fingerprint(x)===key)
  if(idx>=0)history[idx]=candidate
  else history.push(candidate)
  history.sort((a,b)=>String(a.generatedAt||'').localeCompare(String(b.generatedAt||'')))
  const activeHistory=history.filter(x=>hashVersion(x)===currentHashVersion)
  const legacyCount=history.length-activeHistory.length
  const uniqueCount=activeHistory.length
  const window=activeHistory.slice(-required)
  const windowComplete=window.length===required
  const safetyPass=window.every(x=>x.gates?.safetyPass===true)
  const contractPass=window.every(x=>x.gates?.contractNonRegression===true)
  const coveragePass=window.every(x=>x.gates?.coverageNonRegression===true)
  const consecutiveWins=windowComplete&&window.every(x=>x.decision==='snapshot-win')
  const aggregateEvidenceDelta=window.reduce((n,x)=>n+Number(x.gates?.evidenceDelta||0),0)
  const hasReject=window.some(x=>x.decision==='reject')
  let decision='accumulating-evidence'
  if(hasReject||!safetyPass||!contractPass||!coveragePass)decision='reject'
  else if(windowComplete){
    if(consecutiveWins&&aggregateEvidenceDelta>=required)decision='promotion-eligible'
    else decision='hold'
  }
  return {
    history:{schemaVersion:2,updatedAt:current.generatedAt,requiredSnapshots:required,currentContentHashVersion:currentHashVersion,snapshots:history.slice(-limit)},
    status:{
      generatedAt:current.generatedAt,
      contentHashVersion:currentHashVersion,
      requiredSnapshots:required,
      uniqueRegistrySnapshots:uniqueCount,
      legacyRegistrySnapshots:legacyCount,
      evaluatedWindow:window.length,
      windowComplete,
      safetyPass,
      contractNonRegression:contractPass,
      coverageNonRegression:coveragePass,
      consecutiveWins,
      aggregateEvidenceDelta,
      decision,
      note:'Promotion eligibility uses only snapshots with the current Registry contentHashVersion and requires the latest 3 distinct routing-content snapshots to all be snapshot-win with safety, contract and coverage non-regression. Re-running the same routing contentHash does not add evidence. Legacy hash versions remain auditable but never count toward the current promotion window. This gate never changes production automatically.'
    }
  }
}

export function runCli(){
  const root=path.resolve('.')
  const historyPath=process.env.SKILLRADAR_SHADOW_HISTORY_PATH||path.join(root,'data/router-shadow-history.json')
  const latestPath=process.env.SKILLRADAR_SHADOW_LATEST_PATH||path.join(root,'data/router-shadow-latest.json')
  const statusPath=process.env.SKILLRADAR_SHADOW_HISTORY_STATUS_PATH||path.join(root,'data/router-shadow-history-latest.json')
  const write=process.env.SKILLRADAR_SHADOW_HISTORY_WRITE==='1'
  const requiredSnapshots=Number(process.env.SKILLRADAR_SHADOW_REQUIRED_SNAPSHOTS||3)
  const maxSnapshots=Number(process.env.SKILLRADAR_SHADOW_HISTORY_LIMIT||20)
  const latest=readJson(latestPath,null)
  if(!latest)throw new Error(`missing latest shadow snapshot: ${latestPath}`)
  const existing=readJson(historyPath,{schemaVersion:2,snapshots:[]})
  const result=evaluateHistory(existing,latest,{required:requiredSnapshots,limit:maxSnapshots})
  console.log(JSON.stringify(result.status,null,2))
  if(write){
    fs.writeFileSync(historyPath,JSON.stringify(result.history,null,2)+'\n')
    fs.writeFileSync(statusPath,JSON.stringify(result.status,null,2)+'\n')
  }
  return result
}

const direct=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href
if(direct)runCli()
