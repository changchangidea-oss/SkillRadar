import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('index.html', 'utf8');
const robots = fs.readFileSync('robots.txt', 'utf8');
const sitemap = fs.readFileSync('sitemap.xml', 'utf8');

assert.match(html, /<html lang=['"]en['"]>/i, 'public registry must be English-first for the global developer audience');
assert.match(html, /<title>SkillRadar — Open-Source Agent Skills Router for Codex<\/title>/, 'title must disambiguate SkillRadar around Codex + Agent Skills routing');
assert.match(html, /safety-gated Agent Skills registry and task router for Codex/i, 'meta description must state the concrete product category');
assert.match(html, /rel=['"]canonical['"] href=['"]https:\/\/changchangidea-oss\.github\.io\/SkillRadar\/['"]/, 'canonical Pages URL missing');
assert.match(html, /"@type":"SoftwareApplication"/, 'SoftwareApplication structured data missing');
assert.match(html, /https:\/\/github\.com\/changchangidea-oss\/SkillRadar/, 'canonical GitHub repository link missing');
assert.match(html, /npx skills add changchangidea-oss\/SkillRadar --skill skillradar/, 'standard Agent Skill install path must remain visible');
assert.match(html, /codex plugin marketplace add changchangidea-oss\/SkillRadar --ref v0\.5\.0/, 'released Codex plugin install path must remain visible');
assert.doesNotMatch(html, /<html lang=['"]zh-CN['"]>/i, 'public registry regressed to Chinese-first metadata');

for (const id of ['globalSearch', 'openRouter', 'home', 'listView', 'categories', 'designRadar', 'mine', 'router', 'packs', 'modalbg', 'modal']) {
  assert.match(html, new RegExp(`id=['"]${id}['"]`), `required app DOM id missing: ${id}`);
}

assert.match(robots, /User-agent: \*/);
assert.match(robots, /Allow: \//);
assert.match(robots, /Sitemap: https:\/\/changchangidea-oss\.github\.io\/SkillRadar\/sitemap\.xml/);
assert.match(sitemap, /https:\/\/changchangidea-oss\.github\.io\/SkillRadar\//);
assert.match(sitemap, /https:\/\/changchangidea-oss\.github\.io\/SkillRadar\/metrics\.html/);

console.log('Public discoverability contract passed.');
