import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillradar-plugin-offline-'))
const pluginSrc = path.resolve('packages/codex-plugin')
const pluginDst = path.join(tmp, 'plugin')
fs.cpSync(pluginSrc, pluginDst, { recursive: true })

const routerSkillPath = path.join(pluginDst, 'skills/skill-router/SKILL.md')
const routerSkill = fs.readFileSync(routerSkillPath, 'utf8')
const requiredRouterContract = [
  'you MUST query SkillRadar\'s bundled registry before choosing skills',
  "node ../../scripts/skillradar.mjs match '<user task>'",
  'source: skillradar-registry',
  'registry.mode: local-bundled',
  'ranking.version: 2.1',
  'context.mode: project-aware',
  'match_score',
  'skillradar_score',
  'Local availability is supplemental metadata, not a replacement ranking.'
]
for (const phrase of requiredRouterContract) {
  if (!routerSkill.includes(phrase)) throw new Error(`skill-router contract missing required phrase: ${phrase}`)
}
const forbiddenBypassPatterns = [
  /If one precise local skill clearly covers the task, use it without remote lookup/i,
  /local skill.*without.*registry/i
]
for (const pattern of forbiddenBypassPatterns) {
  if (pattern.test(routerSkill)) throw new Error(`skill-router contract reintroduced local-first bypass: ${pattern}`)
}

const manageSkill = fs.readFileSync(path.join(pluginDst, 'skills/manage-skills/SKILL.md'), 'utf8')
for (const phrase of ["node ../../scripts/skill-budget.mjs audit '<current project or task focus>'", 'budget.pressure', 'read-only']) {
  if (!manageSkill.includes(phrase)) throw new Error(`manage-skills contract missing required phrase: ${phrase}`)
}
if (!fs.existsSync(path.join(pluginDst, 'scripts/skill-budget.mjs'))) throw new Error('plugin-only copy missing Skill Budget Doctor')

function runMatch(query, extraEnv = {}, cwd = tmp) {
  const raw = execFileSync(process.execPath, [path.join(pluginDst, 'scripts/skillradar.mjs'), 'match', query], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, SKILLRADAR_OFFLINE: '1', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  return JSON.parse(raw)
}

const result = runMatch('Next.js React shadcn AI dashboard streaming tool calling App Router')
if (result.source !== 'skillradar-registry') throw new Error('offline plugin did not use SkillRadar registry')
if (result.registry?.mode !== 'local-bundled') throw new Error(`expected local-bundled mode, got ${result.registry?.mode}`)
if (result.ranking?.version !== '2.1') throw new Error(`expected ranking v2.1, got ${result.ranking?.version}`)
if (!['task-only','project-aware'].includes(result.context?.mode)) throw new Error('router did not expose context mode')
if (!Array.isArray(result.matches) || result.matches.length < 1 || result.matches.length > 3) throw new Error('offline router did not return between 1 and 3 strong recommendations')
const resultGap=result.capability_gap||null
if(result.matches.length===3&&resultGap?.detected) throw new Error('router reported a capability gap despite returning 3 recommendations')
if(result.matches.length<3&&(!resultGap?.detected||Number(resultGap.returned)!==result.matches.length||Number(resultGap.missing)!==3-result.matches.length)) throw new Error('router did not expose a consistent capability gap')
for (const item of result.matches) {
  for (const key of ['match_score', 'skillradar_score', 'security', 'source', 'reason', 'match_details']) {
    if (item[key] === undefined || item[key] === null || item[key] === '') throw new Error(`offline result missing ${key}`)
  }
  if (item.match_details?.ranking_version !== '2.1') throw new Error(`offline result missing ranking v2.1 evidence for ${item.id}`)
  if (item.match_details?.project_context_bonus === undefined) throw new Error(`offline result missing project-context evidence for ${item.id}`)
  if (['D', 'Blocked'].includes(item.security)) throw new Error(`unsafe offline result: ${item.id}`)
}

const weakBackfillFixture={
  schemaVersion:2,generatedAt:'test',source:'weak-backfill-fixture',coreCount:3,designCount:0,generalCount:0,totalCount:3,contentHash:'weak-backfill',
  core:[
    {id:'strong-match',name:'Rare Anchor Specialist',source:'fixture/strong',category:'Specialist',tags:['rare-anchor','rare-task','primary'],summary:'Rare anchor rare task primary specialist.',security:'A',score:95},
    {id:'weak-one',name:'Unrelated Utility',source:'fixture/weak-one',category:'Utility',tags:['unrelated'],summary:'Generic unrelated helper.',security:'A',score:99},
    {id:'weak-two',name:'Other Utility',source:'fixture/weak-two',category:'Utility',tags:['other'],summary:'Another generic helper.',security:'A',score:99}
  ],design:[],general:[]
}
const weakBackfillPath=path.join(tmp,'weak-backfill.json')
fs.writeFileSync(weakBackfillPath,JSON.stringify(weakBackfillFixture))
const weakBackfill=runMatch('rare-anchor rare-task primary',{SKILLRADAR_REGISTRY_PATH:weakBackfillPath,SKILLRADAR_PROJECT_CONTEXT:'0'})
if(weakBackfill.matches?.length!==1||weakBackfill.matches?.[0]?.id!=='strong-match') throw new Error(`weak candidates were backfilled: ${JSON.stringify(weakBackfill.matches?.map(x=>x.id))}`)
if(!weakBackfill.capability_gap?.detected||weakBackfill.capability_gap?.missing!==2) throw new Error('weak-backfill fixture did not expose missing recommendation capacity')

const technologyFixture={
  schemaVersion:2,generatedAt:'test',source:'technology-specificity-fixture',coreCount:3,designCount:0,generalCount:0,totalCount:3,contentHash:'technology-specificity',
  core:[
    {id:'fastapi-specialist',name:'FastAPI Specialist',source:'fixture/fastapi',category:'Backend',tags:['fastapi','python','rest'],summary:'Build FastAPI services.',security:'A',score:80},
    {id:'generic-api',name:'Generic API',source:'fixture/generic-api',category:'Backend',tags:['api','rest','backend'],summary:'Generic API architecture.',security:'A',score:100},
    {id:'native-designer',name:'Native Designer',source:'fixture/native',category:'Mobile',tags:['native','mobile'],summary:'Generic native mobile design.',security:'A',score:100}
  ],design:[],general:[]
}
const technologyFixturePath=path.join(tmp,'technology-specificity.json')
fs.writeFileSync(technologyFixturePath,JSON.stringify(technologyFixture))
const fastapiSpecific=runMatch('Build a Python FastAPI REST backend API',{SKILLRADAR_REGISTRY_PATH:technologyFixturePath,SKILLRADAR_PROJECT_CONTEXT:'0'})
if(fastapiSpecific.matches?.length!==1||fastapiSpecific.matches[0].id!=='fastapi-specialist') throw new Error(`generic API proved FastAPI: ${JSON.stringify(fastapiSpecific.matches?.map(x=>x.id))}`)
if(!fastapiSpecific.capability_gap?.detected||fastapiSpecific.capability_gap?.missing!==2) throw new Error('FastAPI-specific fixture did not expose missing recommendation capacity')
const reactNativeGap=runMatch('Build a React Native mobile application',{SKILLRADAR_REGISTRY_PATH:technologyFixturePath,SKILLRADAR_PROJECT_CONTEXT:'0'})
if(reactNativeGap.matches?.length!==0) throw new Error(`generic native proved React Native: ${JSON.stringify(reactNativeGap.matches?.map(x=>x.id))}`)
if(!reactNativeGap.capability_gap?.detected||reactNativeGap.capability_gap?.missing!==3) throw new Error('React Native capability gap was not explicit')

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
const policy = runMatch('dashboard nextjs react', { SKILLRADAR_REGISTRY_PATH: fixturePath, SKILLRADAR_PROJECT_CONTEXT: '0' })
if (policy.matches?.[0]?.security !== 'C') throw new Error('policy fixture did not produce C-grade top match')
if (!policy.advisory || policy.advisory.level !== 'review') throw new Error('C-grade top match did not produce review advisory')
if (!['A', 'B'].includes(policy.advisory.alternative?.security)) throw new Error('C-grade advisory did not identify A/B alternative')
if (policy.matches[0].match_score - policy.advisory.alternative.match_score > 5) throw new Error('advisory alternative is not a nearby match')

const zhFixture = {
  schemaVersion: 2,
  generatedAt: 'test',
  source: 'zh-intent-fixture',
  coreCount: 3,
  designCount: 0,
  generalCount: 0,
  totalCount: 3,
  contentHash: 'zh-fixture',
  core: [
    { id: 'generic-architecture', name: 'Generic Architecture Research', source: 'fixture/generic', category: 'Research', tags: ['architecture'], summary: 'General architecture research and reverse engineering.', security: 'A', score: 99 },
    { id: 'interior-rendering', name: 'Interior Architecture Rendering', source: 'fixture/interior', category: 'Design', tags: ['architecture', 'interior', 'spatial', 'rendering'], summary: 'Interior spatial architecture visualization and rendering.', security: 'A', score: 90 },
    { id: 'render-only', name: 'Generic Renderer', source: 'fixture/render', category: 'Design', tags: ['rendering'], summary: 'Generic rendering utility.', security: 'A', score: 98 }
  ],
  design: [],
  general: []
}
const zhFixturePath = path.join(tmp, 'zh-fixture.json')
fs.writeFileSync(zhFixturePath, JSON.stringify(zhFixture))
const zhPolicy = runMatch('建筑可视化和室内空间渲染', { SKILLRADAR_REGISTRY_PATH: zhFixturePath, SKILLRADAR_PROJECT_CONTEXT: '0' })
if (zhPolicy.matches?.[0]?.id !== 'interior-rendering') throw new Error(`Chinese multi-facet intent regression: expected interior-rendering, got ${zhPolicy.matches?.[0]?.id}`)
const zhSignals = zhPolicy.matches[0].match_details?.matched_signals || []
if (zhSignals.filter(x => x.includes(':')).length < 4) throw new Error(`Chinese multi-facet evidence collapsed: ${JSON.stringify(zhSignals)}`)

// Project-aware ranking: project metadata may break ties, but explicit task evidence must remain dominant.
const projectDir = path.join(tmp, 'project-fixture')
fs.mkdirSync(projectDir)
fs.writeFileSync(path.join(projectDir, 'package.json'), JSON.stringify({name:'next-app',dependencies:{next:'16.0.0',react:'19.0.0','@ai-sdk/react':'1.0.0'}}))
fs.writeFileSync(path.join(projectDir, 'components.json'), '{}')
const contextFixture = {
  schemaVersion: 2, generatedAt: 'test', source: 'context-fixture', coreCount: 3, designCount: 0, generalCount: 0, totalCount: 3, contentHash: 'context',
  core: [
    {id:'next-context',name:'Next Context',source:'fixture/next',category:'Frontend',tags:['nextjs','react','app-router','shadcn'],summary:'Next.js application architecture',security:'A',score:80},
    {id:'python-context',name:'Python Context',source:'fixture/python',category:'Backend',tags:['python','fastapi','api'],summary:'Python FastAPI service architecture',security:'A',score:80},
    {id:'generic-context',name:'Generic Context',source:'fixture/generic',category:'Architecture',tags:['architecture'],summary:'Generic application architecture',security:'A',score:80}
  ], design: [], general: []
}
const contextFixturePath=path.join(tmp,'context-fixture.json')
fs.writeFileSync(contextFixturePath,JSON.stringify(contextFixture))
const contextual=runMatch('improve this application architecture',{SKILLRADAR_REGISTRY_PATH:contextFixturePath},projectDir)
if(contextual.context?.mode!=='project-aware') throw new Error('project fixture did not enable project-aware context')
if(!contextual.context.signals.includes('nextjs')||!contextual.context.signals.includes('shadcn')) throw new Error(`project context did not detect expected signals: ${JSON.stringify(contextual.context)}`)
if(contextual.matches?.[0]?.id!=='next-context') throw new Error(`project context failed tie-break: ${contextual.matches?.[0]?.id}`)
if(Number(contextual.matches[0].match_details?.project_context_bonus||0)<=0) throw new Error('project context did not emit a bounded bonus')
if(Number(contextual.matches[0].match_details?.project_context_bonus||0)>6) throw new Error('project context bonus exceeded hard cap')

const taskDominance=runMatch('build a Python FastAPI API service',{SKILLRADAR_REGISTRY_PATH:contextFixturePath},projectDir)
if(taskDominance.matches?.[0]?.id!=='python-context') throw new Error(`project context overrode explicit task evidence: ${taskDominance.matches?.[0]?.id}`)

fs.rmSync(tmp, { recursive: true, force: true })
console.log('Offline Codex plugin validation passed: registry-first + ranking v2.1 + bounded project context + task dominance + up-to-Top-3 strong recommendations + capability-gap contract + C-grade safety advisory + Chinese multi-facet intent + manage-skills doctor contract.')
