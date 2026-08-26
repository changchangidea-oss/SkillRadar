import crypto from 'node:crypto'

export const REGISTRY_CONTENT_HASH_VERSION=2

export function routingProjection(skill={}){
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

export function routingHashPayload({core=[],design=[],general=[]}={}){
  return JSON.stringify({
    core:core.map(routingProjection),
    design:design.map(routingProjection),
    general:general.map(routingProjection)
  })
}

export function routingContentHash(registry={}){
  return crypto.createHash('sha256').update(routingHashPayload(registry)).digest('hex')
}
