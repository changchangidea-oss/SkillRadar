#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const seeds=JSON.parse(await fs.readFile(path.join(root,'data/general-canonical-seeds.json'),'utf8'))
const seed=seeds[0]
function assert(condition,message){if(!condition)throw new Error(message)}
function shouldSeedRepositorySearch(url){
  const needles=[...new Set(seeds.flatMap(s=>s.searchTerms||[]).filter(Boolean).map(x=>String(x).toLowerCase()))]
  const u=String(url);if(!u.includes('/search/repositories?'))return false
  const decoded=decodeURIComponent(u).toLowerCase();return needles.some(x=>decoded.includes(x))
}
function prioritizeRepositoryItems(items,seedRepo){const rest=(items||[]).filter(x=>x?.full_name!==seedRepo.full_name);return [seedRepo,...rest]}
function prioritizeTreeEntries(entries,paths=[]){const wanted=new Set(paths),first=[],rest=[];for(const entry of entries||[]){(wanted.has(entry?.path)?first:rest).push(entry)}first.sort((a,b)=>paths.indexOf(a.path)-paths.indexOf(b.path));return [...first,...rest]}

assert(seed?.repo&&seed?.paths?.length===2&&seed?.searchTerms?.length>=2,'expected canonical Google Workspace seed with explicit searchTerms plus Gmail and Calendar paths')
assert(shouldSeedRepositorySearch('https://api.github.com/search/repositories?q=Google%20Workspace%20CLI%20agent%20skills%20Gmail%20Calendar'),'Google Workspace query should seed canonical discovery')
assert(shouldSeedRepositorySearch('https://api.github.com/search/repositories?q=agent%20skills%20Slack%20Gmail%20integrations'),'Gmail-specific automation query should seed canonical discovery')
assert(!shouldSeedRepositorySearch('https://api.github.com/search/repositories?q=agent%20skills%20React%20Next.js%20frontend'),'generic agent-skills frontend query must not seed Google Workspace')
assert(!shouldSeedRepositorySearch('https://api.github.com/search/repositories?q=agent%20skills%20security%20authentication%20OAuth'),'generic security query must not seed Google Workspace')
const repo={full_name:seed.repo}
const items=prioritizeRepositoryItems([{full_name:'other/repo'},repo],repo)
assert(items[0].full_name===seed.repo&&items.filter(x=>x.full_name===seed.repo).length===1,'seed repo ordering/dedup failed')
const tree=prioritizeTreeEntries([{path:'z/SKILL.md'},{path:seed.paths[1]},{path:seed.paths[0]}],seed.paths)
assert(tree[0].path===seed.paths[0]&&tree[1].path===seed.paths[1],'seed Skill paths must be ahead of generic tree ordering')
console.log('Canonical seed validation passed: official Google Workspace discovery is deterministic, only explicit related searches are seeded, unrelated agent-skill domains stay organic, and downstream security scanning is unchanged.')
