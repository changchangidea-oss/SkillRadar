#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { REGISTRY_CONTENT_HASH_VERSION, routingContentHash } from './lib/registry-routing-hash.mjs'

const root=process.cwd()
const registryPath=path.join(root,'packages/codex-plugin/data/registry.json')
const snapshot=JSON.parse(fs.readFileSync(registryPath,'utf8'))
function assert(condition,message){if(!condition)throw new Error(message)}

assert(snapshot.routingContentHashVersion===REGISTRY_CONTENT_HASH_VERSION,`bundled Registry must declare routingContentHashVersion=${REGISTRY_CONTENT_HASH_VERSION}`)
assert(routingContentHash(snapshot)===snapshot.routingContentHash,'bundled Registry routingContentHash must equal shared routing projection hash')

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
assert(routingContentHash(volatile)===snapshot.routingContentHash,'volatile Radar timestamps/provenance must not create a new routing Registry snapshot')

const changed=structuredClone(snapshot)
const target=(changed.general&&changed.general[0])||(changed.design&&changed.design[0])||(changed.core&&changed.core[0])
assert(target,'Registry must contain at least one skill for hash validation')
target.tags=[...(target.tags||[]),'__routing-hash-change__']
assert(routingContentHash(changed)!==snapshot.routingContentHash,'routing-relevant tag changes must create a new routingContentHash')

console.log('Registry routing hash validation passed: legacy contentHash remains compatible; shared routingContentHash ignores volatile Radar metadata and detects routing-relevant changes.')
