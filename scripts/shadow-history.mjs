#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function hashVersion(snapshot){return Number(snapshot.registrySnapshot?.contentHashVersion||1)}
function registryFingerprint(snapshot){
  const hash=snapshot.registrySnapshot?.contentHash||''
  return [hashVersion(snapshot),hash].join('::')
}
function compact(snapshot){
  return {
    generatedAt:snapshot.generatedAt,
    registrySnapshot:snapshot.registrySnapshot||null,
    evalVersion:snapshot.evalVersion,
    specificityPolicyVersion:snapshot.specificityPolicyVersion,
    production:snapshot.production,
    candidate:snapshot.candidate,
    gates:snapshot.gates,
    decision:snapshot.decision
  }
}
export function evaluateHistory(existing,current,{required=3,limit=20}={}){
  const candidate=compact(current)
  if(!candidate.registrySnapshot?.contentHash)throw new Error('shadow snapshot missing registrySnapshot.contentHash')
  if(!['snapshot-win','hold','reject'].includes(candidate.decision))throw new Error(`invalid single-snapshot decision: ${candidate.decision}`)

  // Promotion evidence is a property of distinct routing Registry states, not of
  // how many times the same Registry was evaluated. Re-evaluating one Registry
  // under a newer Eval/policy/profile replaces its audit result and cannot add
  // another snapshot toward the promotion window.
  const byRegistry=new Map()
  const existingSnapshots=Array.isArray(existing?.snapshots)?existing.snapshots.slice():[]
  existingSnapshots.sort((a,b)=>String(a.generatedAt||'').localeCompare(String(b.generatedAt||'')))
  for(const raw of existingSnapshots){
    const snapshot=compact(raw)
    if(snapshot.registrySnapshot?.contentHash)byRegistry.set(registryFingerprint(snapshot),snapshot)
  }
  byRegistry.set(registryFingerprint(candidate),candidate)

  const history=[...byRegistry.values()].sort((a,b)=>String(a.generatedAt||'').localeCompare(String(b.generatedAt||'')))
  const currentHashVersion=hashVersion(candidate)
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
      note:'Promotion eligibility is keyed only by routing Registry contentHashVersion + contentHash. Re-evaluating the same Registry under a different Eval, specificity policy, or ranking profile replaces that Registry snapshot and never adds evidence. Only the latest 3 distinct current-version Registry states can qualify, and all must be snapshot-win with safety, contract and coverage non-regression. Legacy hash versions remain auditable but never count toward the current promotion window. This gate never changes production automatically.'
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
