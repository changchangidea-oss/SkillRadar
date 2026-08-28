import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { evaluateRoutingCase } from './lib/router-eval-policy.mjs';

const root = process.cwd();
const files = ['assets/safe-render.js', 'assets/web-router.js', 'assets/app.js'];

for (const file of files) {
  const check = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, `${file} failed syntax check:\n${check.stdout}\n${check.stderr}`);
}

for (const file of ['assets/safe-render.js', 'assets/web-router.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}

const safe = globalThis.SkillRadarSafe;
const webRouter = globalThis.SkillRadarWebRouter;
assert.ok(safe, 'SkillRadarSafe must load in a plain JS runtime');
assert.ok(webRouter, 'SkillRadarWebRouter must load in a plain JS runtime');

const attack = `<img src=x onerror="globalThis.__xss=1"><script>alert('x')</script>`;
const escaped = safe.escapeHtml(attack);
assert.doesNotMatch(escaped, /<img|<script/i, 'untrusted HTML must not survive escaping');
assert.match(escaped, /&lt;img/);
assert.match(escaped, /&quot;/, 'double quotes must be escaped');
assert.match(safe.escapeHtml("'quoted'"), /&#39;/, 'single quotes must be escaped for attribute contexts');
assert.equal(safe.safeGithubUrl('javascript:alert(1)'), '#');
assert.equal(safe.safeGithubUrl('data:text/html,<script>alert(1)</script>'), '#');
assert.equal(safe.safeGithubUrl('https://evil.example/repo'), '#');
assert.equal(safe.safeGithubUrl('http://github.com/owner/repo'), '#');
assert.equal(safe.safeGithubUrl('https://github.com/owner/repo'), 'https://github.com/owner/repo');
assert.equal(safe.repoSlug("owner/repo' onclick='alert(1)"), '');
assert.equal(safe.repoSlug('owner/repo'), 'owner/repo');
assert.equal(safe.skillInstallCommand({ source: 'fastapi/fastapi', slug: 'fastapi' }), 'npx skills add fastapi/fastapi --skill fastapi');
assert.equal(safe.skillInstallCommand({ source: 'vercel-labs/agent-skills', id: 'nextjs' }), '', 'a curated id must not be guessed as an upstream install slug');
assert.equal(safe.skillInstallCommand({ source: "owner/repo'", slug: 'safe-skill' }), '', 'invalid repository must not enter an install command');
assert.equal(safe.skillInstallCommand({ source: 'owner/repo', slug: 'skill;rm' }), '', 'shell metacharacters must not enter an install command');

const snapshotPath = path.join(root, 'packages/codex-plugin/data/registry.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
assert.equal(snapshot.schemaVersion, 2, 'web router must consume the current bundled schema');
assert.ok(Array.isArray(snapshot.general) && snapshot.general.length > 0, 'general registry shard must be present');

const browserRegistry = webRouter.registrySkills(snapshot);
assert.ok(snapshot.core.length >= 15, `browser core shard unexpectedly small: ${snapshot.core.length}`);
assert.ok(snapshot.design.length >= 100, `browser design shard unexpectedly small: ${snapshot.design.length}`);
assert.ok(snapshot.general.length >= 200, `browser general shard unexpectedly small: ${snapshot.general.length}`);
assert.equal(browserRegistry.length, snapshot.totalCount, 'browser registry must contain every safety-gated bundled Skill exactly once');
assert.ok(browserRegistry.every((skill) => !['D', 'Blocked'].includes(skill.security)), 'D/Blocked Skill leaked into browser registry');
const exactInstallable = browserRegistry.filter((skill) => safe.skillInstallCommand(skill));
const auditableSources = browserRegistry.filter((skill) => [skill.githubUrl, skill.installUrl].some((url) => safe.safeGithubUrl(url || '') !== '#'));
assert.ok(snapshot.general.every((skill) => safe.skillInstallCommand(skill)), 'a scanned General Skill lost its exact upstream install coordinates');
assert.ok(snapshot.general.every((skill) => safe.safeGithubUrl(skill.githubUrl || '') !== '#'), 'a scanned General Skill lost its exact SKILL.md source URL');
assert.ok(snapshot.design.every((skill) => safe.safeGithubUrl(skill.installUrl || '') !== '#'), 'a Design Skill lost its auditable upstream repository URL');
assert.ok(exactInstallable.length >= 200, `browser Registry unexpectedly lost verified per-Skill install coordinates: ${exactInstallable.length}`);
assert.equal(auditableSources.length, browserRegistry.length, 'every active browser recommendation must retain an auditable upstream source');
const unverifiedCoordinateGaps = browserRegistry.filter((skill) => !safe.skillInstallCommand(skill) && ![skill.githubUrl, skill.installUrl].some((url) => safe.safeGithubUrl(url || '') !== '#')).map((skill) => skill.id).sort();
assert.deepEqual(unverifiedCoordinateGaps, [], 'active browser recommendations must not contain unresolved curated placeholders');

const poisoned = structuredClone(snapshot);
poisoned.general = [...(poisoned.general || []), {
  id: 'evil-fixture',
  name: attack,
  source: 'attacker/repo',
  category: 'Automation',
  tags: ['slack'],
  summary: attack,
  security: 'D',
  signalScore: 100,
  maintenanceScore: 100,
}];
assert.ok(!webRouter.registrySkills(poisoned).some((skill) => skill.id === 'evil-fixture'), 'D-grade malicious fixture must be excluded before rendering/routing');

const reactCandidateFixture = {
  schemaVersion: 2,
  generatedAt: 'test',
  source: 'react-candidate-evidence-fixture',
  coreCount: 2,
  designCount: 0,
  generalCount: 0,
  totalCount: 2,
  contentHash: 'react-candidate-evidence',
  core: [
    { id: 'react-dashboard', name: 'React Dashboard', source: 'fixture/react-dashboard', category: 'Frontend', tags: ['react', 'dashboard', 'visual', 'production', 'polish', 'interface'], summary: 'Improve production React dashboard interfaces.', security: 'A', score: 80 },
    { id: 'generic-ui', name: 'Frontend UI Engineering', source: 'fixture/generic-ui', category: 'Frontend', tags: ['visual', 'quality', 'production', 'interface'], summary: 'Improve visual quality and production interface polish.', security: 'A', score: 100 },
  ],
  design: [],
  general: [],
};
const reactCandidateQuery = 'Improve the visual quality and production polish of a React dashboard interface';
const reactCandidateMatch = webRouter.match(reactCandidateFixture, reactCandidateQuery, 3);
assert.ok(reactCandidateMatch.specificity.required_signals.includes('react'), 'browser Router did not activate per-candidate React evidence');
assert.deepEqual(reactCandidateMatch.matches.map((skill) => skill.id), ['react-dashboard'], 'generic UI candidate bypassed browser React evidence');
assert.ok(reactCandidateMatch.capability_gap.detected && reactCandidateMatch.capability_gap.missing === 2, 'browser Router did not expose the filtered React capability gap');

const posterCapability = structuredClone(snapshot);
posterCapability.general = [...(posterCapability.general || []), {
  id: 'fixture/marketing-design',
  name: 'marketing-design',
  source: 'fixture/marketing-design',
  category: 'Design & Media',
  tags: ['poster', 'brand', 'visual', 'identity', 'campaign'],
  summary: 'Marketing brand-asset generation: corporate identity and brand visual identity assets, plus poster design for event, editorial, and marketing campaigns.',
  security: 'C',
  signalScore: 80,
  maintenanceScore: 95,
}];
const posterMatch = webRouter.match(posterCapability, '设计品牌海报和视觉传播系统', 3);
const marketingDesign = posterMatch.matches.find((skill) => skill.id === 'fixture/marketing-design');
assert.ok(marketingDesign, 'an eligible dedicated marketing-design Skill must route for the Chinese poster/brand task');
const marketingSignals = new Set((marketingDesign.match_details?.matched_signals || []).map(webRouter.canon));
for (const signal of ['poster', 'brand', 'visual']) assert.ok(marketingSignals.has(signal), `marketing-design lost explicit ${signal} evidence`);

const appSource = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
assert.match(appSource, /packages\/codex-plugin\/data\/registry\.json/, 'web app must load the complete bundled safety-gated registry');
assert.match(appSource, /webRouter\.match\(registrySnapshot, query, 3\)/, 'web app must use the shared Matching v2.1 browser router');
assert.match(appSource, /#heroGo'\)\.onclick = \(\) => routeTask/, 'homepage task input must use the real router rather than catalog substring filtering');
assert.match(appSource, /skillInstallCommand\(skill\)/, 'per-Skill actions must use the validated exact install-command helper');
assert.match(appSource, /Install coordinates (?:are )?not verified/, 'curated entries without verified upstream coordinates must show an explicit gap');
assert.doesNotMatch(appSource, /https:\/\/github\.com\/\$\{repository\}/, 'source links must not be synthesized from unverified repository labels');
assert.doesNotMatch(appSource, /npx skills add https:\/\/github\.com\/\$\{slug\}/, 'whole-repository install hint must not return');
assert.match(appSource, /data-copy-install/, 'router results must expose an actionable exact install command');
assert.match(appSource, /Inspect source/, 'router results must expose the auditable upstream source');
assert.match(appSource, /document\.execCommand\('copy'\)/, 'install-command copy must retain a fallback for browsers without the Clipboard API');
assert.doesNotMatch(appSource, /const\s+syn\s*=\s*\{/, 'legacy substring synonym router must not return');
assert.doesNotMatch(appSource, /hit\s*\*\s*10\s*\+\s*s\.score\s*\*\s*\.35/, 'legacy substring score formula must not return');
assert.doesNotMatch(appSource, />\s*\$\{skill\.(?:name|source|summary|category|security|id)\}\s*</, 'raw Skill fields must not be inserted into HTML text contexts');
assert.doesNotMatch(appSource, /(?:data-s|href|title|class)=["']\$\{skill\.(?:name|source|summary|category|security|id)\}/, 'raw Skill fields must not be inserted into HTML attribute contexts');
assert.doesNotMatch(appSource, /href=["']?\$\{candidate\.githubUrl\}/, 'raw candidate URLs must not enter href');
assert.match(appSource, /guide\.zh-CN\.html/, 'the online experience must expose the Chinese guide');
assert.match(appSource, /textContent = '中文说明'/, 'the Chinese guide entry must have a visible Chinese label');
assert.match(appSource, /new URLSearchParams\(window\.location\.search\)\.get\('task'\)/, 'Chinese guide examples must deep-link into the real router');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(html, /codex plugin marketplace add changchangidea-oss\/SkillRadar --ref v0\.5\.0 &amp;&amp; codex plugin add skillradar@skillradar/, 'public page must show the complete two-step Codex plugin install');
assert.match(html, /id='mobileNav'/, 'mobile navigation trigger must remain available');
assert.match(html, /id='mobileClose'/, 'mobile navigation must have an explicit close control');
const css = fs.readFileSync(path.join(root, 'assets/styles.css'), 'utf8');
assert.match(css, /\.nav-open \.side\{transform:translateX\(0\)\}/, 'mobile navigation drawer must become visible when opened');
const zhGuide = fs.readFileSync(path.join(root, 'guide.zh-CN.html'), 'utf8');
assert.match(zhGuide, /<html lang="zh-CN">/, 'Chinese guide must declare its document language');
assert.match(zhGuide, /三步得到可审查的匹配结果/, 'Chinese guide must explain the online workflow');
assert.match(zhGuide, /D \/ Blocked/, 'Chinese guide must explain the D/Blocked routing boundary');
assert.match(zhGuide, /发现 ≠ 执行/, 'Chinese guide must state that discovery is not execution');
assert.match(zhGuide, /id="copyCodexGuide"/, 'Chinese guide must expose an actionable Codex install copy control');
assert.match(zhGuide, /id="copyAgentGuide"/, 'Chinese guide must expose an actionable standard Skill install copy control');
const zhGuideScript = fs.readFileSync(path.join(root, 'assets/guide-zh.js'), 'utf8');
assert.match(zhGuideScript, /codex plugin marketplace add changchangidea-oss\/SkillRadar --ref v0\.5\.0 && codex plugin add skillradar@skillradar/, 'Chinese guide must copy the complete Codex install command');
assert.match(zhGuideScript, /npx skills add changchangidea-oss\/SkillRadar --skill skillradar/, 'Chinese guide must copy the exact standard Skill command');
assert.match(zhGuideScript, /document\.execCommand\('copy'\)/, 'Chinese guide install copy must retain a fallback for browsers without the Clipboard API');
const safePos = html.indexOf("assets/safe-render.js");
const routerPos = html.indexOf("assets/web-router.js");
const appPos = html.indexOf("assets/app.js");
assert.ok(safePos >= 0 && routerPos > safePos && appPos > routerPos, 'safe-render and web-router helpers must load before app.js');

function pluginMatch(query, registryPath = snapshotPath) {
  const result = spawnSync(process.execPath, ['packages/codex-plugin/scripts/skillradar.mjs', 'match', query], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      SKILLRADAR_OFFLINE: '1',
      SKILLRADAR_PROJECT_CONTEXT: '0',
      SKILLRADAR_REGISTRY_PATH: registryPath,
    },
  });
  assert.equal(result.status, 0, `plugin router failed for ${query}:\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

const boundaryQuery = 'Create an accessible shadcn/ui design system for a responsive dashboard';
const dedicatedShadcn = snapshot.core.find((skill) => skill.id === 'shadcn');
assert.ok(dedicatedShadcn, 'dedicated shadcn boundary fixture must exist in the bundled Registry');
const boundaryCandidate = {
  id: 'fixture/generic-design',
  name: 'ui-ux-pro-max',
  source: 'fixture/generic-design',
  category: 'Design',
  tags: ['experience', 'design', 'ux', 'product', 'interaction', 'usability', 'mobile', 'accessibility', 'ui', 'design-system', 'layout', 'typography'],
  summary: 'UI/UX design intelligence for web, mobile, and desktop interfaces, including pages, components, design systems, accessibility, interaction, responsive layout, typography, color, and charts.',
  security: 'C',
  signalScore: 82,
  maintenanceScore: 100,
};
const boundaryOnly = { ...snapshot, core: [], design: [boundaryCandidate], general: [] };
const boundaryOnlyMatch = webRouter.match(boundaryOnly, boundaryQuery, 3);
assert.equal(boundaryOnlyMatch.matches[0]?.match_score, 61, 'generic fixture must remain pinned to the exact top1 - 28 boundary');
const boundarySnapshot = { ...snapshot, core: [dedicatedShadcn], design: [boundaryCandidate], general: [] };
const boundaryBrowser = webRouter.match(boundarySnapshot, boundaryQuery, 3);
assert.equal(boundaryBrowser.matches[0]?.match_score, 89, 'dedicated shadcn fixture score changed; review the boundary regression');
assert.deepEqual(boundaryBrowser.matches.map((skill) => skill.id), ['shadcn'], 'candidate exactly at top1 - 28 must not weak-backfill the browser Top 3');
const boundaryDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillradar-boundary-'));
const boundaryPath = path.join(boundaryDir, 'registry.json');
try {
  fs.writeFileSync(boundaryPath, JSON.stringify(boundarySnapshot));
  const boundaryPlugin = pluginMatch(boundaryQuery, boundaryPath);
  assert.deepEqual(boundaryPlugin.matches.map((skill) => skill.id), ['shadcn'], 'candidate exactly at top1 - 28 must not weak-backfill the Plugin Top 3');
} finally {
  fs.rmSync(boundaryDir, { recursive: true, force: true });
}

const nextBodyQuery = 'Implement Next.js App Router data fetching and route architecture';
const nextBodyCandidate = {
  id: 'fixture/telemedx-frontend-patterns',
  name: 'telemedx-frontend-patterns',
  source: 'fixture/telemedx',
  category: 'Frontend',
  tags: ['frontend'],
  routingEvidence: ['nextjs', 'app-router', 'server-components'],
  summary: 'Frontend patterns for a Next.js application covering Server Components and data fetching.',
  security: 'B',
  signalScore: 74,
  maintenanceScore: 95,
};
const nextBodyPartialCandidates = [
  {
    id: 'fixture/webhook-next-mention',
    name: 'webhook-handler-patterns',
    source: 'fixture/webhook',
    category: 'Automation & Integrations',
    tags: ['fastapi'],
    routingEvidence: ['app-router'],
    summary: 'Webhook handler patterns with framework notes for Next.js and App Router route handlers.',
    security: 'B',
    signalScore: 80,
    maintenanceScore: 95,
  },
  {
    id: 'fixture/next-api-partial',
    name: 'backend-patterns',
    source: 'fixture/backend',
    category: 'Backend & API',
    tags: ['backend', 'nextjs'],
    routingEvidence: ['nextjs'],
    summary: 'Backend data-access patterns that mention Next.js App Router API routes.',
    security: 'B',
    signalScore: 80,
    maintenanceScore: 95,
  },
];
const nextBodySnapshot = { ...snapshot, core: [], design: [], general: [nextBodyCandidate, ...nextBodyPartialCandidates] };
const nextBodyBrowser = webRouter.match(nextBodySnapshot, nextBodyQuery, 3);
assert.deepEqual(nextBodyBrowser.specificity.required_signal_groups, [['nextjs', 'app-router']], 'compound Next.js App Router task must activate joint candidate evidence');
assert.deepEqual(nextBodyBrowser.matches.map((skill) => skill.id), [nextBodyCandidate.id], 'split Next.js/App Router evidence from unrelated candidates must not enter the browser result');
const nextBodySignals = new Set((nextBodyBrowser.matches[0]?.match_details?.matched_signals || []).map(webRouter.canon));
for (const signal of ['nextjs', 'app-router']) assert.ok(nextBodySignals.has(signal), `full candidate SKILL evidence lost ${signal}`);
const nextBodyEval = evaluateRoutingCase({
  id: 'fixture-next-body', domain: 'Frontend', tier: 'coverage', expectedAnyIds: [], minExpectedHits: 0,
  requiredSignalTerms: ['nextjs', 'app-router'], minSignalHits: 2, minCandidateRequiredHits: 2, maxLowEvidenceTop3: 0,
}, nextBodyBrowser.matches, {
  source: nextBodyBrowser.source,
  registryMode: 'local-bundled',
  capabilityGap: nextBodyBrowser.capability_gap,
});
assert.ok(nextBodyEval.pass && nextBodyEval.candidate_evidence_failures === 0, 'full candidate SKILL evidence must satisfy the strict Eval contract');
const nextBodyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillradar-next-body-'));
const nextBodyPath = path.join(nextBodyDir, 'registry.json');
try {
  fs.writeFileSync(nextBodyPath, JSON.stringify(nextBodySnapshot));
  const nextBodyPlugin = pluginMatch(nextBodyQuery, nextBodyPath);
  assert.deepEqual(nextBodyPlugin.specificity.required_signal_groups, [['nextjs', 'app-router']], 'Plugin must activate the same joint candidate evidence group');
  assert.deepEqual(nextBodyPlugin.matches.map((skill) => skill.id), [nextBodyCandidate.id], 'split Next.js/App Router evidence from unrelated candidates must not enter the Plugin result');
} finally {
  fs.rmSync(nextBodyDir, { recursive: true, force: true });
}

const parityQueries = [
  'Slack webhook notifications',
  'Redis caching for a Node API',
  'Optimize a Postgres schema and database performance',
  'SQLite migration and query design',
  'GraphQL Node API',
  'Vitest test suite',
  'SwiftUI iOS app',
  'Flutter mobile app',
  'Gmail automation workflow',
  'Google Calendar integration',
  'MCP server tool integration',
  'Optimize a Postgres schema and database performance',
  'FastAPI backend service',
  'Kubernetes deployment',
  'Playwright end to end tests',
  'Figma design system handoff',
  'Create an accessible shadcn/ui design system for a responsive dashboard',
  '为新消费品牌设计一张中文活动海报',
  'Next.js AI dashboard with tool calling and shadcn/ui',
];

const candidateEvidenceQueries = new Set([
  'SQLite migration and query design',
  'Vitest test suite',
  'Flutter mobile app',
  'MCP server tool integration',
  '为新消费品牌设计一张中文活动海报',
]);

for (const query of parityQueries) {
  const browser = webRouter.match(snapshot, query, 3);
  const plugin = pluginMatch(query);
  assert.equal(browser.ranking.version, plugin.ranking.version, `ranking version mismatch for ${query}`);
  assert.deepEqual(browser.specificity.required_signals, plugin.specificity.required_signals, `specificity signals mismatch for ${query}`);
  assert.deepEqual(
    browser.matches.map((skill) => skill.id),
    plugin.matches.map((skill) => skill.id),
    `browser/plugin Top-3 mismatch for ${query}`,
  );
  assert.ok(browser.matches.every((skill) => !['D', 'Blocked'].includes(skill.security)), `unsafe match returned for ${query}`);
  if (browser.specificity.enforced) {
    const required = new Set(browser.specificity.required_signals);
    for (const skill of browser.matches) {
      const matched = new Set((skill.match_details?.matched_signals || []).map(webRouter.canon));
      assert.ok([...required].some((signal) => matched.has(signal)), `generic backfill bypassed specificity for ${query}: ${skill.id}`);
      if (candidateEvidenceQueries.has(query)) {
        assert.ok(webRouter.candidateEvidencePass(skill, browser.specificity.required_signals), `repository-context candidate bypassed identity/task evidence for ${query}: ${skill.id}`);
      }
    }
  }
}

const posterQuery = '为新消费品牌设计一张中文活动海报';
const posterResult = webRouter.match(snapshot, posterQuery, 3);
const posterPlugin = pluginMatch(posterQuery);
assert.deepEqual(posterResult.matches.map((skill) => skill.id), posterPlugin.matches.map((skill) => skill.id), 'poster candidate contract must remain identical in the browser and Plugin');
assert.ok(posterResult.matches.some((skill) => skill.source === 'vanducng/skills' && skill.name === 'marketing-design'), 'the real marketing-design upstream must route for a poster/brand task');
const posterDeckFalsePositives = new Set([
  'nexu-io/open-design/html-ppt-zhangzara-bold-poster',
  'nexu-io/open-design/html-ppt-zhangzara-raw-grid',
  'nexu-io/open-design/gamified-app',
]);
assert.ok(posterResult.matches.every((skill) => !posterDeckFalsePositives.has(skill.id)), 'presentation/deck templates must not substitute for a poster-production Skill');

const repositoryContextFalsePositives = new Set([
  'artokun/comfyui-mcp/color-correction-674ba1',
  'OpenDigitalProductFactory/opendigitalproductfactory/dpf-record-decision-outcome-3a235e',
  'sickn33/agentic-awesome-skills/kubernetes-deployment-7095fa',
  'opensquilla/opensquilla/meta-paper-write-b8b8ab',
  'EverMind-AI/EverOS/add-memory-kind-42f902',
  'langgenius/dify/frontend-testing-c86f15',
  'langgenius/dify/e2e-cucumber-playwright-1de203',
  'flutter/agent-plugins/dart-write-documentation-4c8bb5',
  'flutter/agent-plugins/dart-add-unit-test-98a461',
  'sickn33/agentic-awesome-skills/hugging-face-trackio-2d1b18',
  'hybridlabor-api/bdb-dev-optimized-agent-skills/vector-database-engineer',
]);

for (const query of ['Create an MCP agent that can call tools and coordinate assistants', 'Build an LLM agent workflow with tools and orchestration', 'Optimize a Postgres schema and database performance', 'Build a SQLite data pipeline and analytics workflow', 'Create Vitest unit and integration tests', 'Build a Flutter mobile interface', 'Build webhook API automation and integrations']) {
  const browser = webRouter.match(snapshot, query, 3);
  const plugin = pluginMatch(query);
  assert.deepEqual(browser.matches.map((skill) => skill.id), plugin.matches.map((skill) => skill.id), `candidate-level browser/plugin mismatch for ${query}`);
  assert.ok(browser.matches.every((skill) => webRouter.candidateEvidencePass(skill, browser.specificity.required_signals)), `candidate-level filter leaked repository-context evidence for ${query}`);
  assert.ok(browser.matches.every((skill) => !repositoryContextFalsePositives.has(skill.id)), `known repository-context false positive leaked for ${query}`);
}

for (const [query, preservedSignal] of [['Postgres and Redis caching', 'redis'], ['SQLite and Redis caching', 'redis'], ['Flutter and SwiftUI mobile apps', 'swiftui']]) {
  const browser = webRouter.match(snapshot, query, 3);
  const plugin = pluginMatch(query);
  assert.deepEqual(browser.matches.map((skill) => skill.id), plugin.matches.map((skill) => skill.id), `mixed-specificity browser/plugin mismatch for ${query}`);
  assert.ok(browser.matches.some((skill) => (skill.match_details?.matched_signals || []).map(webRouter.canon).includes(preservedSignal)), `candidate for untightened ${preservedSignal} capability was incorrectly filtered for ${query}`);
}

console.log(`Web UI safety + router parity passed for ${parityQueries.length} named/multi-capability queries.`);
