#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { REGISTRY_CONTENT_HASH_VERSION, routingContentHash } from './lib/registry-routing-hash.mjs'

const root=process.cwd()
const registryPath=path.join(root,'packages/codex-plugin/data/registry.json')
const snapshot=JSON.parse(fs.readFileSync(registryPath,'utf8'))
function assert(condition,message){if(!condition)throw new Error(message)}

assert(snapshot.contentHashVersion===REGISTRY_CONTENT_HASH_VERSION,`bundled Registry must declare routing contentHashVersion=${REGISTRY_CONTENT_HASH_VERSION}`)
assert(routingContentHash(snapshot)===snapshot.contentHash,'bundled Registry contentHash must equal shared routing projection hash')

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
assert(routingContentHash(volatile)===snapshot.contentHash,'volatile Radar timestamps/provenance must not create a new routing Registry snapshot')

const changed=structuredClone(snapshot)
const target=(changed.general&&changed.general[0])||(changed.design&&changed.design[0])||(changed.core&&changed.core[0])
assert(target,'Registry must contain at least one skill for hash validation')
target.tags=[...(target.tags||[]),'__routing-hash-change__']
assert(routingContentHash(changed)!==snapshot.contentHash,'routing-relevant tag changes must create a new Registry contentHash')

console.log('Registry routing contentHash validation passed: shared hash semantics ignore volatile Radar metadata and detect routing-relevant changes.')
