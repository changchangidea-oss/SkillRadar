import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillradar-plugin-offline-'))
const pluginSrc = path.resolve('packages/codex-plugin')
const pluginDst = path.join(tmp, 'plugin')
fs.cpSync(pluginSrc, pluginDst, { recursive: true })

function runMatch(query, extraEnv = {}) {
  const raw = execFileSync(process.execPath, [path.join(pluginDst, 'scripts/skillradar.mjs'), 'match', query], {
    cwd: tmp,
    encoding: 'utf8',
    env: { ...process.env, SKILLRADAR_OFFLINE: '1', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  return JSON.parse(raw)
}

const result = runMatch('Next.js React shadcn AI dashboard streaming tool calling App Router')
if (result.source !== 'skillradar-registry') throw new Error('offline plugin did not use SkillRadar registry')
if (result.registry?.mode !== 'local-bundled') throw new Error(`expected local-bundled mode, got ${result.registry?.mode}`)
if (!Array.isArray(result.matches) || result.matches.length !== 3) throw new Error('offline router did not return Top 3')
for (const item of result.matches) {
  for (const key of ['match_score', 'skillradar_score', 'security', 'source', 'reason']) {
    if (item[key] === undefined || item[key] === null || item[key] === '') throw new Error(`offline result missing ${key}`)
  }
  if (['D', 'Blocked'].includes(item.security)) throw new Error(`unsafe offline result: ${item.id}`)
}

const fixture = {
  schemaVersion: 1,
  generatedAt: 'test',
  source: 'test-fixture',
  coreCount: 3,
  designCount: 0,
  totalCount: 3,
  contentHash: 'fixture',
  core: [
    { id: 'c-risk', name: 'Dashboard Specialist', source: 'fixture/c-risk', category: 'Frontend', tags: ['dashboard', 'nextjs', 'react'], summary: 'Dashboard specialist', security: 'C', score: 100 },
    { id: 'b-safe', name: 'Dashboard Safe', source: 'fixture/b-safe', category: 'Frontend', tags: ['dashboard', 'nextjs', 'react'], summary: 'Dashboard safe alternative', security: 'B', score: 80 },
    { id: 'a-safe', name: 'Dashboard Conservative', source: 'fixture/a-safe', category: 'Frontend', tags: ['dashboard', 'nextjs', 'react'], summary: 'Dashboard conservative alternative', security: 'A', score: 70 }
  ],
  design: []
}
const fixturePath = path.join(tmp, 'fixture.json')
fs.writeFileSync(fixturePath, JSON.stringify(fixture))
const policy = runMatch('dashboard nextjs react', { SKILLRADAR_REGISTRY_PATH: fixturePath })
if (policy.matches?.[0]?.security !== 'C') throw new Error('policy fixture did not produce C-grade top match')
if (!policy.advisory || policy.advisory.level !== 'review') throw new Error('C-grade top match did not produce review advisory')
if (!['A', 'B'].includes(policy.advisory.alternative?.security)) throw new Error('C-grade advisory did not identify A/B alternative')
if (policy.matches[0].match_score - policy.advisory.alternative.match_score > 5) throw new Error('advisory alternative is not a nearby match')

fs.rmSync(tmp, { recursive: true, force: true })
console.log('Offline Codex plugin validation passed: plugin-only Top 3 + C-grade safety advisory.')
