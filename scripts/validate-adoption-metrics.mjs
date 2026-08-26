import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillradar-adoption-'));
const output = path.join(tempDir, 'adoption-latest.json');
const script = path.join(root, 'scripts/update-adoption-metrics.mjs');
const fixture = 'scripts/fixtures/adoption-metrics.json';

function run() {
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      SKILLRADAR_ADOPTION_FIXTURE: fixture,
      SKILLRADAR_ADOPTION_OUTPUT: output,
      SKILLRADAR_REPOSITORY: 'changchangidea-oss/SkillRadar',
      SKILLRADAR_MAINTAINERS: 'changchangidea-oss',
      GITHUB_TOKEN: '',
    },
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result;
}

run();
const first = JSON.parse(fs.readFileSync(output, 'utf8'));
assert.equal(first.source, 'fixture');
assert.equal(first.github.stars, 12);
assert.equal(first.github.forks, 3);
assert.equal(first.github.watchers, 2);
assert.equal(first.github.openIssuesAndPullRequests, 6);
assert.equal(first.github.externalIssueAuthors, 1, 'duplicate issue authors, maintainer and bot must not inflate external usage');
assert.equal(first.github.externalPrAuthors, 2);
assert.equal(first.github.externalActorsObserved, 2, 'alice appearing in both Issues and PRs must count once');
assert.equal(first.github.releases, 2);
assert.equal(first.github.releaseAssetDownloads, 14);
assert.equal(first.github.releasePluginZipDownloads, 7, 'checksum and unrelated assets must not count as plugin ZIP installs');
assert.equal(first.distribution.codexMarketplaceInstalls, null);
assert.equal(first.distribution.skillsShInstalls, null);
assert.equal(first.rules.ciSmokeTestsCountAsInstalls, false);
assert.equal(first.rules.unverifiableCountsAreEstimated, false);
assert.deepEqual(first.rules.maintainerLoginsExcluded, ['changchangidea-oss']);

const firstTimestamp = first.generatedAt;
const secondRun = run();
const second = JSON.parse(fs.readFileSync(output, 'utf8'));
assert.equal(second.generatedAt, firstTimestamp, 'unchanged metrics must preserve the previous snapshot timestamp');
assert.match(secondRun.stdout, /unchanged/i);

fs.rmSync(tempDir, { recursive: true, force: true });
console.log('Adoption metrics fixture validation passed.');
