import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { REGISTRY_CONTENT_HASH_VERSION, routingContentHash } from './lib/registry-routing-hash.mjs'

const root = process.cwd()
const dataDir = path.join(root, 'data')
const outDir = path.join(root, 'packages/codex-plugin/data')
const outFile = path.join(outDir, 'registry.json')

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
function canonical(skill) {
  return `${String(skill.source || '').toLowerCase()}::${String(skill.name || skill.id || '').toLowerCase().replace(/[^a-z0-9]+/g, '')}`
}
function uniqueInto(list, seen) {
  const out = []
  for (const skill of list || []) {
    const key = canonical(skill)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(skill)
  }
  return out
}

const rawCore = readJson(path.join(dataDir, 'skills.json'), [])
const manifest = readJson(path.join(dataDir, 'design-skill-index.json'), { chunks: [] })
const rawDesign = manifest.chunks.flatMap(file => readJson(path.join(dataDir, file), []))
const rawGeneral = readJson(path.join(dataDir, 'general-skills-radar.json'), [])

const unsafe = [...rawDesign, ...rawGeneral].filter(skill => ['D', 'Blocked'].includes(skill.security))
if (unsafe.length) {
  throw new Error(`Refusing to bundle ${unsafe.length} unsafe discovered skills: ${unsafe.map(x => x.id).join(', ')}`)
}

const seen = new Set()
const core = uniqueInto(rawCore, seen)
const design = uniqueInto(rawDesign, seen)
const general = uniqueInto(rawGeneral, seen)

// Preserve the existing contentHash contract for compatibility with current validators/clients.
const contentHash = crypto.createHash('sha256').update(JSON.stringify({core,design,general})).digest('hex')
// Shadow/history use a separate routing-only hash so volatile Radar metadata cannot fake a new Registry state.
const routingHash = routingContentHash({core,design,general})
const generalLatest = readJson(path.join(dataDir, 'general-radar-latest.json'), {})
const snapshot = {
  schemaVersion: 2,
  routingContentHashVersion: REGISTRY_CONTENT_HASH_VERSION,
  generatedAt: [manifest.generatedAt, generalLatest.generatedAt].filter(Boolean).sort().at(-1) || new Date().toISOString().slice(0, 10),
  source: 'skillradar-safety-gated-registry',
  coreCount: core.length,
  designCount: design.length,
  generalCount: general.length,
  totalCount: core.length + design.length + general.length,
  contentHash,
  routingContentHash: routingHash,
  core,
  design,
  general
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Bundled Codex registry: ${snapshot.totalCount} unique skills (${snapshot.coreCount} core + ${snapshot.designCount} design + ${snapshot.generalCount} general), content sha256 ${contentHash.slice(0, 12)}…, routing sha256 ${routingHash.slice(0, 12)}…`)
