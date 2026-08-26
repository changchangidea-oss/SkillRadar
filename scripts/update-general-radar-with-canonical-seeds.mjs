#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const seedPath=path.join(root,'data/general-canonical-seeds.json')
const seeds=JSON.parse(await fs.readFile(seedPath,'utf8'))
const originalFetch=globalThis.fetch

const seedRepos=new Map(seeds.map(seed=>[seed.repo,seed]))
const searchNeedles=[...new Set(seeds.flatMap(seed=>[
  seed.hint,
  ...(seed.paths||[]).flatMap(p=>p.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
]).filter(Boolean).map(x=>String(x).toLowerCase()))]

export function shouldSeedRepositorySearch(url){
  const u=String(url)
  if(!u.includes('/search/repositories?'))return false
  const decoded=decodeURIComponent(u).toLowerCase()
  return searchNeedles.some(x=>decoded.includes(x))
}

export function prioritizeRepositoryItems(items,seedRepo){
  if(!seedRepo)return items||[]
  const rest=(items||[]).filter(x=>x?.full_name!==seedRepo.full_name)
  return [seedRepo,...rest]
}

export function prioritizeTreeEntries(entries,paths=[]){
  const wanted=new Set(paths)
  const first=[],rest=[]
  for(const entry of entries||[]){(wanted.has(entry?.path)?first:rest).push(entry)}
  first.sort((a,b)=>paths.indexOf(a.path)-paths.indexOf(b.path))
  return [...first,...rest]
}

if(process.env.SKILLRADAR_CANONICAL_SEED_SELFTEST==='1'){
  const seed=seeds[0]
  if(!seed?.repo||!seed?.paths?.length)throw new Error('canonical seed config missing repo/paths')
  if(!shouldSeedRepositorySearch('https://api.github.com/search/repositories?q=Google%20Workspace%20CLI%20agent%20skills%20Gmail%20Calendar'))throw new Error('Google Workspace search must activate canonical seed discovery')
  if(shouldSeedRepositorySearch('https://api.github.com/search/repositories?q=React%20Next.js%20frontend'))throw new Error('unrelated frontend search must not activate canonical seed discovery')
  const repo={full_name:seed.repo}
  const items=prioritizeRepositoryItems([{full_name:'other/repo'},repo],repo)
  if(items[0]?.full_name!==seed.repo||items.filter(x=>x.full_name===seed.repo).length!==1)throw new Error('canonical repo must be first and deduplicated')
  const tree=prioritizeTreeEntries([{path:'z/SKILL.md'},{path:seed.paths[1]},{path:seed.paths[0]}],seed.paths)
  if(tree[0]?.path!==seed.paths[0]||tree[1]?.path!==seed.paths[1])throw new Error('canonical skill paths must be ordered before the 30-file discovery cap')
  console.log('Canonical General Radar seed self-test passed: relevant searches seed the official repo, unrelated searches do not, and configured Skill paths are prioritized without bypassing downstream scanning.')
  process.exit(0)
}

async function jsonResponse(data,response){
  return new Response(JSON.stringify(data),{
    status:response.status,
    statusText:response.statusText,
    headers:response.headers
  })
}

const seedRepoMeta=new Map()
for(const seed of seeds){
  const response=await originalFetch(`https://api.github.com/repos/${seed.repo}`,{
    headers:{
      Accept:'application/vnd.github+json',
      'User-Agent':'SkillRadar/0.6 (+https://github.com/changchangidea-oss/SkillRadar)',
      ...(process.env.GITHUB_TOKEN?{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`}:{ }),
      'X-GitHub-Api-Version':'2022-11-28'
    }
  })
  if(!response.ok)throw new Error(`canonical seed repo lookup failed for ${seed.repo}: ${response.status} ${response.statusText}`)
  seedRepoMeta.set(seed.repo,await response.json())
}

globalThis.fetch=async function skillRadarSeededFetch(input,init){
  const url=typeof input==='string'?input:input?.url||String(input)
  const response=await originalFetch(input,init)
  if(!response.ok)return response

  if(shouldSeedRepositorySearch(url)){
    const data=await response.json()
    let items=data.items||[]
    for(const seed of seeds)items=prioritizeRepositoryItems(items,seedRepoMeta.get(seed.repo))
    return jsonResponse({...data,items},response)
  }

  for(const [repo,seed] of seedRepos){
    if(url.includes(`/repos/${repo}/git/trees/`)&&url.includes('recursive=1')){
      const data=await response.json()
      return jsonResponse({...data,tree:prioritizeTreeEntries(data.tree,seed.paths||[])},response)
    }
  }
  return response
}

await import('./update-general-radar.mjs')
