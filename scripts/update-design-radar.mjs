import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname, '..')
const domains = JSON.parse(await fs.readFile(path.join(root, 'data/design-domains.json'), 'utf8'))
const outPath = path.join(root, 'data/radar-latest.json')
const token = process.env.GITHUB_TOKEN || ''
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'SkillRadar/0.2 (+https://github.com/changchangidea-oss/SkillRadar)',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  'X-GitHub-Api-Version': '2022-11-28',
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function gh(url) {
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body.slice(0, 180)}`)
  }
  return res.json()
}

function recencyScore(date) {
  const ageDays = Math.max(0, (Date.now() - new Date(date).getTime()) / 86400000)
  return Math.max(0, 20 - Math.min(20, ageDays / 9))
}

function normalizeWords(values) {
  return [...new Set(values.join(' ').toLowerCase().split(/[^a-z0-9+#.-]+/).filter((x) => x.length > 2))]
}

const discoveries = []
const errors = []

for (const domain of domains) {
  const words = normalizeWords([domain.en, ...(domain.tags || [])]).slice(0, 8)
  const query = `SKILL.md ${words.slice(0, 5).join(' ')} in:readme`
  try {
    const data = await gh(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=5`)
    const repos = (data.items || []).slice(0, 3)
    for (const repo of repos) {
      try {
        const tree = await gh(`https://api.github.com/repos/${repo.full_name}/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`)
        const skillPaths = (tree.tree || [])
          .filter((x) => x.type === 'blob' && /(^|\/)SKILL\.md$/i.test(x.path))
          .map((x) => x.path)
        const ranked = skillPaths.map((skillPath) => {
          const slug = skillPath.split('/').slice(-2, -1)[0] || repo.name
          const hay = `${slug} ${skillPath} ${repo.name} ${repo.description || ''}`.toLowerCase()
          const overlap = words.filter((w) => hay.includes(w)).length
          const repoSignal = Math.min(28, Math.log10((repo.stargazers_count || 0) + 1) * 8)
          const score = Math.round(Math.min(100, 30 + overlap * 8 + repoSignal + recencyScore(repo.pushed_at)))
          return {
            id: `${repo.full_name}/${slug}`,
            slug,
            name: slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
            source: repo.full_name,
            skillPath,
            githubUrl: `https://github.com/${repo.full_name}/blob/${repo.default_branch}/${skillPath}`,
            installUrl: `https://github.com/${repo.full_name}`,
            repoStars: repo.stargazers_count || 0,
            pushedAt: repo.pushed_at,
            domainId: domain.id,
            domainName: domain.name,
            matchScore: score,
            tagOverlap: overlap,
            discovery: 'github-radar',
          }
        }).sort((a, b) => b.matchScore - a.matchScore || b.repoStars - a.repoStars)
        discoveries.push(...ranked.slice(0, 20))
      } catch (error) {
        errors.push({ domain: domain.id, repo: repo.full_name, error: String(error.message || error) })
      }
      await sleep(150)
    }
  } catch (error) {
    errors.push({ domain: domain.id, error: String(error.message || error) })
  }
  await sleep(250)
}

const dedup = new Map()
for (const item of discoveries) {
  const key = `${item.domainId}:${item.source}:${item.skillPath}`
  const prev = dedup.get(key)
  if (!prev || item.matchScore > prev.matchScore) dedup.set(key, item)
}
const clean = [...dedup.values()]
const domainRadar = {}
for (const domain of domains) {
  domainRadar[domain.id] = clean
    .filter((x) => x.domainId === domain.id)
    .sort((a, b) => b.matchScore - a.matchScore || b.repoStars - a.repoStars)
    .slice(0, 20)
}

let previous = null
try { previous = JSON.parse(await fs.readFile(outPath, 'utf8')) } catch {}
const payload = {
  generatedAt: new Date().toISOString(),
  status: clean.length ? 'live' : 'degraded',
  source: 'GitHub public repository search + recursive SKILL.md discovery',
  note: 'Radar discoveries are candidates. Seed rankings remain the trusted baseline until candidates accumulate enough quality, safety and usage signals.',
  discoveryCount: clean.length,
  errors: errors.slice(0, 30),
  domainRadar: clean.length ? domainRadar : (previous?.domainRadar || {}),
  discoveries: clean.length ? clean : (previous?.discoveries || []),
}
await fs.writeFile(outPath, JSON.stringify(payload, null, 2) + '\n')
console.log(`SkillRadar: ${payload.discoveryCount} candidates across ${domains.length} design domains; ${errors.length} recoverable errors.`)
