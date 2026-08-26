#!/usr/bin/env node
import { evaluateHistory } from './shadow-history.mjs'

function snapshot(hash,decision='snapshot-win',evidenceDelta=1,overrides={},contentHashVersion=2){
  return {
    generatedAt:`2026-08-${String(hash).slice(-2).padStart(2,'0')}T00:00:00.000Z`,
    evalVersion:2,
    registrySnapshot:{contentHash:hash,contentHashVersion,totalCount:468,mode:'local-bundled'},
    production:{profile:'ranking-v2.1',passed:53,cases:54},
    candidate:{profile:'facet-heavy-rerank-v0.6-shadow',passed:53,cases:54},
    gates:{safetyPass:true,contractNonRegression:true,coverageNonRegression:true,evidenceDelta,...overrides},
    decision
  }
}
function assert(condition,message){if(!condition)throw new Error(message)}

let state={schemaVersion:2,snapshots:[]}
let r=evaluateHistory(state,snapshot('registry-01'),{required:3,limit:20})
assert(r.status.contentHashVersion===2,'current hash version should be reported')
assert(r.status.decision==='accumulating-evidence','one snapshot must not promote')
assert(r.status.uniqueRegistrySnapshots===1,'first snapshot count incorrect')
assert(r.status.legacyRegistrySnapshots===0,'fresh v2 history should have no legacy snapshots')
assert(r.status.windowComplete===false,'one snapshot must report an incomplete window')
assert(r.status.safetyPass===true&&r.status.contractNonRegression===true&&r.status.coverageNonRegression===true,'incomplete safe window must not be mislabeled as failed')
state=r.history

r=evaluateHistory(state,snapshot('registry-01','snapshot-win',2),{required:3,limit:20})
assert(r.status.uniqueRegistrySnapshots===1,'duplicate v2 registry hash must not add evidence')
assert(r.status.decision==='accumulating-evidence','duplicate snapshot must not promote')
state=r.history

r=evaluateHistory(state,snapshot('registry-02'),{required:3,limit:20})
assert(r.status.uniqueRegistrySnapshots===2,'second distinct v2 registry not counted')
state=r.history
r=evaluateHistory(state,snapshot('registry-03'),{required:3,limit:20})
assert(r.status.uniqueRegistrySnapshots===3,'third distinct v2 registry not counted')
assert(r.status.windowComplete===true,'three distinct v2 snapshots must complete the window')
assert(r.status.consecutiveWins===true,'three v2 wins should be consecutive')
assert(r.status.aggregateEvidenceDelta>=3,'aggregate improvement floor not met')
assert(r.status.decision==='promotion-eligible','three distinct safe v2 wins should become promotion eligible')

state={schemaVersion:2,snapshots:[snapshot('registry-11'),snapshot('registry-12','hold',0)]}
r=evaluateHistory(state,snapshot('registry-13'),{required:3,limit:20})
assert(r.status.decision==='hold','mixed three-snapshot v2 window must hold')

state={schemaVersion:2,snapshots:[]}
r=evaluateHistory(state,snapshot('registry-20','reject',1,{safetyPass:false}),{required:3,limit:20})
assert(r.status.decision==='reject','an unsafe snapshot must reject immediately even before the history window is full')
assert(r.status.windowComplete===false,'single unsafe snapshot should still report incomplete window')
assert(r.status.safetyPass===false,'unsafe gate was not preserved')

state={schemaVersion:2,snapshots:[snapshot('registry-21'),snapshot('registry-22')]}
r=evaluateHistory(state,snapshot('registry-23','reject',1,{safetyPass:false}),{required:3,limit:20})
assert(r.status.decision==='reject','unsafe full v2 window must reject')
assert(r.status.safetyPass===false,'unsafe full-window gate was not preserved')

state={schemaVersion:2,snapshots:[snapshot('registry-31','snapshot-win',0),snapshot('registry-32','snapshot-win',0)]}
r=evaluateHistory(state,snapshot('registry-33','snapshot-win',0),{required:3,limit:20})
assert(r.status.decision==='hold','zero-evidence v2 wins must not promote')

// Hash-version migration: legacy v1 evidence stays auditable but never counts toward a v2 promotion window.
const legacy=snapshot('legacy-v1','snapshot-win',5,{},1)
state={schemaVersion:1,snapshots:[legacy]}
r=evaluateHistory(state,snapshot('registry-41','snapshot-win',2),{required:3,limit:20})
assert(r.status.contentHashVersion===2,'migration should evaluate the current v2 hash version')
assert(r.status.uniqueRegistrySnapshots===1,'legacy v1 snapshot must not count as a v2 distinct snapshot')
assert(r.status.legacyRegistrySnapshots===1,'legacy v1 snapshot should remain auditable')
assert(r.status.windowComplete===false,'one v2 snapshot plus one v1 snapshot must not complete the v2 window')
assert(r.status.decision==='accumulating-evidence','hash-version migration must not promote')
state=r.history
r=evaluateHistory(state,snapshot('registry-42','snapshot-win',2),{required:3,limit:20})
assert(r.status.uniqueRegistrySnapshots===2,'two v2 snapshots should count as two regardless of legacy v1 history')
assert(r.status.legacyRegistrySnapshots===1,'legacy snapshot should still be retained')
assert(r.status.windowComplete===false,'v1 + two v2 snapshots must not satisfy the 3-v2 requirement')
assert(r.status.decision==='accumulating-evidence','v1 evidence must not bridge a v2 promotion window')
state=r.history
r=evaluateHistory(state,snapshot('registry-43','snapshot-win',2),{required:3,limit:20})
assert(r.status.uniqueRegistrySnapshots===3,'third v2 snapshot should complete the current-version window')
assert(r.status.legacyRegistrySnapshots===1,'legacy snapshot should remain audit-only')
assert(r.status.windowComplete===true,'three v2 snapshots should complete the current-version window')
assert(r.status.decision==='promotion-eligible','three distinct safe winning v2 snapshots can promote even with audit-only v1 history')

console.log('Shadow history validation passed: incomplete windows are not mislabeled as failed; duplicate hashes do not count; unsafe snapshots reject immediately; 3 distinct safe wins are required; and legacy contentHash versions remain audit-only and cannot bridge the current promotion window.')
