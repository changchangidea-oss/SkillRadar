#!/usr/bin/env node
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const registryPath=path.join(root,'packages/codex-plugin/data/registry.json')
const snapshot=JSON.parse(fs.readFileSync(registryPath,'utf8'))

function projection(skill){
  return {
    id:skill.id||null,
    name:skill.name||null,
    source:skill.source||null,
    category:skill.category||null,
    tags:skill.tags||[],
    summary:skill.summary||null,
    security:skill.security||'B',
    score:skill.score??skill.signalScore??70,
    maintenance:skill.maintenance??skill.maintenanceScore??70,
    installs:skill.installs||0,
    installUrl:skill.installUrl||null,
    skillsUrl:skill.skillsUrl||null,
    discovery:skill.discovery||null,
    domains:skill.domains||[],
    uses:skill.uses||[]
  }
}
function routingHash(value){
  const payload=JSON.stringify({
    core:(value.core||[]).map(projection),
    design:(value.design||[]).map(projection),
    general:(value.general||[]).map(projection)
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}
function assert(condition,message){if(!condition)throw new Error(message)}

assert(snapshot.contentHashVersion===2,'bundled Registry must declare routing contentHashVersion=2')
assert(routingHash(snapshot)===snapshot.contentHash,'bundled Registry contentHash must equal routing projection hash')

const volatile=structuredClone(snapshot)
volatile.generatedAt='2099-12-31T23:59:59.999Z'
for(const list of [volatile.design||[],volatile.general||[]])for(const skill of list){
  skill.firstSeenAt='2099-01-01T00:00:00.000Z'
  skill.lastSeenAt='2099-12-31T23:59:59.999Z'
  skill.seenDays=9999
  skill.staleRuns=9999
  skill.pushedAt='2099-12-31T23:59:59.999Z'
  skill.contentHash='volatile-upstream-provenance'
  skill.discoveryScore=1
  skill.qualityScore=1
  skill.popularityScore=1
}
assert(routingHash(volatile)===snapshot.contentHash,'volatile Radar timestamps/provenance must not create a new routing Registry snapshot')

const changed=structuredClone(snapshot)
const target=(changed.general&&changed.general[0])||(changed.design&&changed.design[0])||(changed.core&&changed.core[0])
assert(target,'Registry must contain at least one skill for hash validation')
target.tags=[...(target.tags||[]),'__routing-hash-change__']
assert(routingHash(changed)!==snapshot.contentHash,'routing-relevant tag changes must create a new Registry contentHash')

console.log('Registry routing contentHash validation passed: volatile Radar metadata is ignored; routing-relevant changes produce a distinct hash.')
