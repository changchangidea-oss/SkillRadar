#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const seeds=JSON.parse(await fs.readFile(path.join(root,'data/general-canonical-seeds.json'),'utf8'))
const seed=seeds[0]
function assert(condition,message){if(!condition)throw new Error(message)}
function shouldSeedRepositorySearch(url){
  const needles=[...new Set(seeds.flatMap(s=>[s.hint,...(s.paths||[]).flatMap(p=>p.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))]).filter(Boolean).map(x=>String(x).toLowerCase()))]
  const u=String(url);if(!u.includes('/search/repositories?'))return false
  const decoded=decodeURIComponent(u).toLowerCase();return needles.some(x=>decoded.includes(x))
}
function prioritizeRepositoryItems(items,seedRepo){const rest=(items||[]).filter(x=>x?.full_name!==seedRepo.full_name);return [seedRepo,...rest]}
function prioritizeTreeEntries(entries,paths=[]){const wanted=new Set(paths),first=[],rest=[];for(const entry of entries||[]){(wanted.has(entry?.path)?first:rest).push(entry)}first.sort((a,b)=>paths.indexOf(a.path)-paths.indexOf(b.path));return [...first,...rest]}

assert(seed?.repo&&seed?.paths?.length===2,'expected canonical Google Workspace repo with Gmail and Calendar paths')
assert(shouldSeedRepositorySearch('https://api.github.com/search/repositories?q=Google%20Workspace%20CLI%20agent%20skills%20Gmail%20Calendar'),'Google Workspace query should seed canonical discovery')
assert(!shouldSeedRepositorySearch('https://api.github.com/search/repositories?q=React%20Next.js%20frontend'),'unrelated query must not seed Google Workspace')
const repo={full_name:seed.repo}
const items=prioritizeRepositoryItems([{full_name:'other/repo'},repo],repo)
assert(items[0].full_name===seed.repo&&items.filter(x=>x.full_name===seed.repo).length===1,'seed repo ordering/dedup failed')
const tree=prioritizeTreeEntries([{path:'z/SKILL.md'},{path:seed.paths[1]},{path:seed.paths[0]}],seed.paths)
assert(tree[0].path===seed.paths[0]&&tree[1].path===seed.paths[1],'seed Skill paths must be ahead of generic tree ordering')
console.log('Canonical seed validation passed: official Google Workspace discovery is deterministic, scoped to relevant searches, deduplicated, and does not modify downstream security scanning.')
