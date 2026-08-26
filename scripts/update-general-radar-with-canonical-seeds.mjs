#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  matchingSeedsForRepositorySearch,
  prioritizeRepositoryItems,
  prioritizeTreeEntries,
  shouldSeedRepositorySearch
} from './lib/canonical-seeds.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const seedPath=path.join(root,'data/general-canonical-seeds.json')
const seeds=JSON.parse(await fs.readFile(seedPath,'utf8'))
const originalFetch=globalThis.fetch

const seedRepos=new Map(seeds.map(seed=>[seed.repo,seed]))

if(process.env.SKILLRADAR_CANONICAL_SEED_SELFTEST==='1'){
  for(const seed of seeds)if(!seed?.repo||!seed?.paths?.length||!seed?.searchTerms?.length)throw new Error(`canonical seed config missing repo/paths/searchTerms: ${seed?.repo||'unknown'}`)
  const mobileUrl='https://api.github.com/search/repositories?q=agent%20skills%20React%20Native%20Expo%20Flutter'
  const mobile=matchingSeedsForRepositorySearch(mobileUrl,seeds)
  if(!mobile.some(seed=>seed.repo==='callstackincubator/agent-skills')||!mobile.some(seed=>seed.repo==='flutter/agent-plugins'))throw new Error('mobile search must activate only related canonical seeds')
  if(mobile.some(seed=>seed.repo==='fastapi/fastapi'))throw new Error('mobile search must not activate FastAPI canonical discovery')
  if(shouldSeedRepositorySearch('https://api.github.com/search/repositories?q=agent%20skills%20React%20Next.js%20frontend',seeds))throw new Error('unrelated frontend search must not activate canonical discovery')
  const repos=mobile.map(seed=>({full_name:seed.repo}))
  const items=prioritizeRepositoryItems([{full_name:'other/repo'},repos[0]],repos)
  if(items.slice(0,repos.length).some((item,index)=>item.full_name!==repos[index].full_name)||items.filter(x=>x.full_name===repos[0].full_name).length!==1)throw new Error('canonical repos must be ordered and deduplicated')
  const seed=seeds.find(item=>item.repo==='googleworkspace/cli')
  const tree=prioritizeTreeEntries([{path:'z/SKILL.md'},...seed.paths.slice().reverse().map(path=>({path}))],seed.paths)
  if(seed.paths.some((skillPath,index)=>tree[index]?.path!==skillPath))throw new Error('canonical skill paths must be ordered before the 30-file discovery cap')
  console.log('Canonical General Radar seed self-test passed: each repository query injects only its exact related upstream seeds, multiple related seeds retain config order, unrelated domains stay organic, and configured Skill paths remain ahead of the discovery cap without bypassing downstream scanning.')
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

  const matchingSeeds=matchingSeedsForRepositorySearch(url,seeds)
  if(matchingSeeds.length){
    const data=await response.json()
    const items=prioritizeRepositoryItems(data.items||[],matchingSeeds.map(seed=>seedRepoMeta.get(seed.repo)))
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
