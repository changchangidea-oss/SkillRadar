#!/usr/bin/env node
/**
 * scripts/check-data-freshness.mjs
 *
 * Diagnoses why SkillRadar data may be stale and prints actionable steps.
 * Run: node scripts/check-data-freshness.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...parts) => path.join(root, ...parts);

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(p(file), 'utf8'));
  } catch {
    return null;
  }
}

function ageLabel(isoDate) {
  if (!isoDate) return 'unknown';
  const ms = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor(ms / 3600000);
  if (days === 0) return hours <= 1 ? 'just now' : `${hours}h ago`;
  return `${days}d ago`;
}

function status(ageMs, warnDays = 2, staleDays = 7) {
  const days = ageMs / 86400000;
  if (days < warnDays) return '✅ FRESH';
  if (days < staleDays) return '⚠️  WARN';
  return '❌ STALE';
}

console.log('\n━━━ SkillRadar Data Freshness Report ━━━\n');

const dataFiles = [
  { file: 'data/update-status.json',           key: 'lastRunAt',   label: 'Daily Pipeline (GitHub Actions)' },
  { file: 'data/radar-latest.json',            key: 'generatedAt', label: 'Design Radar'                    },
  { file: 'data/adoption-latest.json',         key: 'generatedAt', label: 'Adoption Metrics'                },
  { file: 'data/general-radar-latest.json',    key: 'generatedAt', label: 'General Skills Radar'            },
  { file: 'data/router-eval-latest.json',      key: 'generatedAt', label: 'Router Eval'                     },
  { file: 'data/router-shadow-latest.json',    key: 'generatedAt', label: 'Router Shadow'                   },
];

let anyStale = false;
for (const { file, key, label } of dataFiles) {
  const data = await readJson(file);
  const dateVal = data?.[key] ?? data?.snapshotAt ?? data?.fetchedAt ?? data?.updatedAt;
  const ageMs = dateVal ? Date.now() - new Date(dateVal).getTime() : Infinity;
  const st = status(ageMs);
  if (st !== '✅ FRESH') anyStale = true;
  const dateStr = dateVal ? new Date(dateVal).toISOString() : '—';
  const age = ageLabel(dateVal);
  console.log(`  ${st}  ${label.padEnd(32)} ${dateStr}  (${age})`);
}

console.log('\n━━━ Root Cause Analysis ━━━\n');

if (!anyStale) {
  console.log('  All data is fresh. No action needed.');
} else {
  console.log(`  Most likely cause: GitHub automatically pauses scheduled workflows
  after 60 days of repository inactivity (no human pushes or PRs).

  ✦ Fix steps:
  1. Go to: https://github.com/changchangidea-oss/SkillRadar/actions
  2. Find "SkillRadar Daily Pipeline" → click "Enable workflow" if disabled
  3. Click "Run workflow" (top-right) to trigger an immediate run
  4. Check "Keep Scheduled Workflows Alive" is also enabled

  ✦ Prevention (already set up):
  - keep-alive.yml commits a heartbeat on the 1st and 21st of each month
  - This prevents the 60-day inactivity cutoff

  ✦ Manual local refresh (requires GITHUB_TOKEN):
     GITHUB_TOKEN=ghp_... npm run radar
     GITHUB_TOKEN=ghp_... npm run radar:general
     npm run adoption:snapshot
`);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
