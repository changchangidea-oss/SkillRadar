import fs from 'node:fs';
import path from 'node:path';

const repository = process.env.SKILLRADAR_REPOSITORY || process.env.GITHUB_REPOSITORY || 'changchangidea-oss/SkillRadar';
const [owner] = repository.split('/');
const maintainers = new Set(
  (process.env.SKILLRADAR_MAINTAINERS || owner)
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);
const token = process.env.GITHUB_TOKEN || '';
const outputPath = path.resolve(process.cwd(), 'data/adoption-latest.json');

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'SkillRadar-adoption-metrics',
  'X-GitHub-Api-Version': '2022-11-28',
};
if (token) headers.Authorization = `Bearer ${token}`;

async function github(pathname) {
  const response = await fetch(`https://api.github.com/repos/${repository}${pathname}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status} for ${pathname}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

async function paginate(pathname) {
  const out = [];
  for (let page = 1; page <= 20; page += 1) {
    const join = pathname.includes('?') ? '&' : '?';
    const batch = await github(`${pathname}${join}per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error(`Expected array from ${pathname}`);
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

function isExternalHuman(user) {
  if (!user?.login) return false;
  if (user.type === 'Bot') return false;
  return !maintainers.has(user.login.toLowerCase());
}

function stablePayload(snapshot) {
  const clone = structuredClone(snapshot);
  delete clone.generatedAt;
  return JSON.stringify(clone);
}

const repo = await github('');
const issuesAndPrs = await paginate('/issues?state=all');
const releases = await paginate('/releases');

const externalIssueAuthors = new Set();
const externalPrAuthors = new Set();
for (const item of issuesAndPrs) {
  if (!isExternalHuman(item.user)) continue;
  if (item.pull_request) externalPrAuthors.add(item.user.login);
  else externalIssueAuthors.add(item.user.login);
}
const externalActors = new Set([...externalIssueAuthors, ...externalPrAuthors]);

let releaseAssetDownloads = 0;
let releasePluginZipDownloads = 0;
for (const release of releases) {
  for (const asset of release.assets || []) {
    const count = Number(asset.download_count || 0);
    releaseAssetDownloads += count;
    if (/skillradar-codex-plugin-.*\.zip$/i.test(asset.name || '')) {
      releasePluginZipDownloads += count;
    }
  }
}

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  repository,
  source: 'github-api',
  github: {
    stars: Number(repo.stargazers_count || 0),
    forks: Number(repo.forks_count || 0),
    watchers: Number(repo.subscribers_count || 0),
    openIssues: Number(repo.open_issues_count || 0),
    externalIssueAuthors: externalIssueAuthors.size,
    externalPrAuthors: externalPrAuthors.size,
    externalActorsObserved: externalActors.size,
    releases: releases.length,
    releaseAssetDownloads,
    releasePluginZipDownloads,
  },
  distribution: {
    codexMarketplaceInstalls: null,
    codexMarketplaceInstallsStatus: 'unknown-no-public-verifiable-count-source',
    skillsShInstalls: null,
    skillsShInstallsStatus: 'unknown-no-stable-verifiable-count-source',
  },
  rules: {
    maintainerLoginsExcluded: [...maintainers].sort(),
    botsExcludedFromExternalActors: true,
    ciSmokeTestsCountAsInstalls: false,
    unverifiableCountsAreEstimated: false,
  },
};

let previous = null;
if (fs.existsSync(outputPath)) {
  previous = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
}

if (previous && stablePayload(previous) === stablePayload(snapshot)) {
  console.log('Adoption metrics unchanged; preserving existing snapshot timestamp.');
  process.exit(0);
}

fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Updated ${path.relative(process.cwd(), outputPath)}`);
console.log(JSON.stringify(snapshot.github));
