import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dataDir = path.join(root, 'data')
const outDir = path.join(root, 'packages/codex-plugin/data')
const outFile = path.join(outDir, 'registry.json')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

const core = readJson(path.join(dataDir, 'skills.json'))
const manifest = readJson(path.join(dataDir, 'design-skill-index.json'))
const design = manifest.chunks.flatMap(file => readJson(path.join(dataDir, file)))

const unsafe = design.filter(skill => ['D', 'Blocked'].includes(skill.security))
if (unsafe.length) {
  throw new Error(`Refusing to bundle ${unsafe.length} unsafe design skills: ${unsafe.map(x => x.id).join(', ')}`)
}

const payloadForHash = JSON.stringify({ core, design })
const contentHash = crypto.createHash('sha256').update(payloadForHash).digest('hex')
const snapshot = {
  schemaVersion: 1,
  generatedAt: manifest.generatedAt || new Date().toISOString().slice(0, 10),
  source: 'skillradar-safety-gated-registry',
  coreCount: core.length,
  designCount: design.length,
  totalCount: core.length + design.length,
  contentHash,
  core,
  design
}

fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(outFile, `${JSON.stringify(snapshot, null, 2)}\n`)
console.log(`Bundled Codex registry: ${snapshot.totalCount} skills (${snapshot.coreCount} core + ${snapshot.designCount} design), sha256 ${contentHash.slice(0, 12)}…`)
