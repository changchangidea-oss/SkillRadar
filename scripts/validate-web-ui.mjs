import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

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

const snapshotPath = path.join(root, 'packages/codex-plugin/data/registry.json');
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
assert.equal(snapshot.schemaVersion, 2, 'web router must consume the current bundled schema');
assert.ok(Array.isArray(snapshot.general) && snapshot.general.length > 0, 'general registry shard must be present');

const browserRegistry = webRouter.registrySkills(snapshot);
assert.ok(browserRegistry.length >= 400, `browser registry unexpectedly small: ${browserRegistry.length}`);
assert.ok(browserRegistry.every((skill) => !['D', 'Blocked'].includes(skill.security)), 'D/Blocked Skill leaked into browser registry');

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

const appSource = fs.readFileSync(path.join(root, 'assets/app.js'), 'utf8');
assert.match(appSource, /packages\/codex-plugin\/data\/registry\.json/, 'web app must load the complete bundled safety-gated registry');
assert.match(appSource, /webRouter\.match\(registrySnapshot, query, 3\)/, 'web app must use the shared Matching v2.1 browser router');
assert.doesNotMatch(appSource, /const\s+syn\s*=\s*\{/, 'legacy substring synonym router must not return');
assert.doesNotMatch(appSource, /hit\s*\*\s*10\s*\+\s*s\.score\s*\*\s*\.35/, 'legacy substring score formula must not return');
assert.doesNotMatch(appSource, /\$\{skill\.(?:name|source|summary|category|security|id)\}/, 'raw Skill fields must not be interpolated into innerHTML');
assert.doesNotMatch(appSource, /href=["']?\$\{candidate\.githubUrl\}/, 'raw candidate URLs must not enter href');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const safePos = html.indexOf("assets/safe-render.js");
const routerPos = html.indexOf("assets/web-router.js");
const appPos = html.indexOf("assets/app.js");
assert.ok(safePos >= 0 && routerPos > safePos && appPos > routerPos, 'safe-render and web-router helpers must load before app.js');

function pluginMatch(query) {
  const result = spawnSync(process.execPath, ['packages/codex-plugin/scripts/skillradar.mjs', 'match', query], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      SKILLRADAR_OFFLINE: '1',
      SKILLRADAR_PROJECT_CONTEXT: '0',
      SKILLRADAR_REGISTRY_PATH: snapshotPath,
    },
  });
  assert.equal(result.status, 0, `plugin router failed for ${query}:\n${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

const parityQueries = [
  'Slack webhook notifications',
  'Redis caching for a Node API',
  'SQLite migration and query design',
  'GraphQL Node API',
  'Vitest test suite',
  'SwiftUI iOS app',
  'Flutter mobile app',
  'Gmail automation workflow',
  'Google Calendar integration',
  'MCP server tool integration',
  'FastAPI backend service',
  'Kubernetes deployment',
  'Playwright end to end tests',
  'Figma design system handoff',
  'Next.js AI dashboard with tool calling and shadcn/ui',
];

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
    }
  }
}

console.log(`Web UI safety + router parity passed for ${parityQueries.length} named/multi-capability queries.`);
