#!/usr/bin/env node
import { evaluateHistory } from './shadow-history.mjs'

function snapshot(hash,decision='snapshot-win',evidenceDelta=1,overrides={}){
  return {
    generatedAt:`2026-08-${hash.slice(-2).padStart(2,'0')}T00:00:00.000Z`,
    evalVersion:2,
    registrySnapshot:{contentHash:hash,totalCount:468,mode:'local-bundled'},
    production:{profile:'ranking-v2.1',passed:53,cases:54},
    candidate:{profile:'facet-heavy-rerank-v0.6-shadow',passed:53,cases:54},
    gates:{safetyPass:true,contractNonRegression:true,coverageNonRegression:true,evidenceDelta,...overrides},
    decision
  }
}
function assert(condition,message){if(!condition)throw new Error(message)}

let state={schemaVersion:1,snapshots:[]}
let r=evaluateHistory(state,snapshot('registry-01'),{required:3,limit:20})
assert(r.status.decision==='accumulating-evidence','one snapshot must not promote')
assert(r.status.uniqueRegistrySnapshots===1,'first snapshot count incorrect')
state=r.history

r=evaluateHistory(state,snapshot('registry-01','snapshot-win',2),{required:3,limit:20})
assert(r.status.uniqueRegistrySnapshots===1,'duplicate registry hash must not add evidence')
assert(r.status.decision==='accumulating-evidence','duplicate snapshot must not promote')
state=r.history

r=evaluateHistory(state,snapshot('registry-02'),{required:3,limit:20})
assert(r.status.uniqueRegistrySnapshots===2,'second distinct registry not counted')
state=r.history
r=evaluateHistory(state,snapshot('registry-03'),{required:3,limit:20})
assert(r.status.uniqueRegistrySnapshots===3,'third distinct registry not counted')
assert(r.status.consecutiveWins===true,'three wins should be consecutive')
assert(r.status.aggregateEvidenceDelta>=3,'aggregate improvement floor not met')
assert(r.status.decision==='promotion-eligible','three distinct safe wins should become promotion eligible')

state={schemaVersion:1,snapshots:[snapshot('registry-11'),snapshot('registry-12','hold',0)]}
r=evaluateHistory(state,snapshot('registry-13'),{required:3,limit:20})
assert(r.status.decision==='hold','mixed three-snapshot window must hold')

state={schemaVersion:1,snapshots:[snapshot('registry-21'),snapshot('registry-22')]}
r=evaluateHistory(state,snapshot('registry-23','reject',1,{safetyPass:false}),{required:3,limit:20})
assert(r.status.decision==='reject','unsafe latest window must reject')
assert(r.status.safetyPass===false,'unsafe gate was not preserved')

state={schemaVersion:1,snapshots:[snapshot('registry-31','snapshot-win',0),snapshot('registry-32','snapshot-win',0)]}
r=evaluateHistory(state,snapshot('registry-33','snapshot-win',0),{required:3,limit:20})
assert(r.status.decision==='hold','zero-evidence wins must not promote')

console.log('Shadow history validation passed: duplicate Registry snapshots do not count; one win cannot promote; 3 distinct safe wins are required; mixed/unsafe/zero-evidence windows cannot promote.')
