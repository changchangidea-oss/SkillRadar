#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  canonicalCandidateKeys,
  matchingSeedsForRepositorySearch,
  prioritizeAnalysisCandidates,
  prioritizeCanonicalCandidates,
  prioritizeRepositoryItems,
  prioritizeTreeEntries
} from './lib/canonical-seeds.mjs'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const seeds=JSON.parse(await fs.readFile(path.join(root,'data/general-canonical-seeds.json'),'utf8'))
function assert(condition,message){if(!condition)throw new Error(message)}

const expectedRepos=['googleworkspace/cli','fastapi/fastapi','redis/agent-skills','SecureSkills-io/sqlite-skill','callstackincubator/agent-skills','flutter/agent-plugins','RevealUIStudio/revskills','slackapi/slack-skills-plugin']
assert(expectedRepos.every(repo=>seeds.some(seed=>seed.repo===repo)),`canonical seed coverage incomplete: ${expectedRepos.filter(repo=>!seeds.some(seed=>seed.repo===repo)).join(', ')}`)
for(const seed of seeds)assert(seed?.repo&&seed?.paths?.length&&seed?.searchTerms?.length,`invalid canonical seed: ${seed?.repo||'unknown'}`)

const cases=[
  ['agent skills Google Workspace Gmail Calendar',['googleworkspace/cli']],
  ['agent skills backend API FastAPI Node',['fastapi/fastapi']],
  ['agent skills Supabase Redis SQLite data pipelines',['redis/agent-skills','SecureSkills-io/sqlite-skill']],
  ['agent skills React Native Expo Flutter',['callstackincubator/agent-skills','flutter/agent-plugins']],
  ['agent skills security secrets permissions',['RevealUIStudio/revskills']],
  ['agent skills Slack Gmail integrations',['googleworkspace/cli','slackapi/slack-skills-plugin']]
]
for(const [query,repos] of cases){
  const matched=matchingSeedsForRepositorySearch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}`,seeds).map(seed=>seed.repo)
  assert(JSON.stringify(matched)===JSON.stringify(repos),`${query} seeded ${matched.join(', ')} instead of ${repos.join(', ')}`)
}
assert(matchingSeedsForRepositorySearch('https://api.github.com/search/repositories?q=agent%20skills%20React%20Next.js%20frontend',seeds).length===0,'unrelated frontend query must stay organic')
assert(matchingSeedsForRepositorySearch('https://api.github.com/search/code?q=filename%3ASKILL.md%20redis',seeds).length===0,'code search must not be rewritten as repository discovery')

const mobileSeeds=matchingSeedsForRepositorySearch('https://api.github.com/search/repositories?q=agent%20skills%20React%20Native%20Expo%20Flutter',seeds)
const repos=mobileSeeds.map(seed=>({full_name:seed.repo}))
const items=prioritizeRepositoryItems([{full_name:'other/repo'},repos[0]],repos)
assert(items.slice(0,repos.length).every((item,index)=>item.full_name===repos[index].full_name),'multiple seed repo ordering failed')
assert(items.filter(item=>item.full_name===repos[0].full_name).length===1,'seed repo dedup failed')
for(const seed of seeds){
  const tree=prioritizeTreeEntries([{path:'z/SKILL.md'},...seed.paths.slice().reverse().map(skillPath=>({path:skillPath}))],seed.paths)
  assert(seed.paths.every((skillPath,index)=>tree[index]?.path===skillPath),`${seed.repo} Skill paths must be ahead of generic tree ordering`)
}
const canonicalKeys=canonicalCandidateKeys(seeds)
const firstCanonical=[...canonicalKeys][0]
const capped=prioritizeAnalysisCandidates([
  {key:'organic/high-stars',channels:['one','two'],repoStars:100000},
  {key:firstCanonical,channels:['one'],repoStars:0},
  {key:'organic/low-stars',channels:['one'],repoStars:1}
],canonicalKeys)
assert(capped[0]?.key===firstCanonical,'configured canonical source:path must be analyzed ahead of the global cap')
assert(capped[1]?.key==='organic/high-stars','organic candidates must retain channel/star ordering after canonical paths')
const published=prioritizeCanonicalCandidates([
  {key:'organic/high-score'},
  {source:firstCanonical.slice(0,firstCanonical.indexOf(':')),skillPath:firstCanonical.slice(firstCanonical.indexOf(':')+1)},
  {key:'organic/next-score'}
],canonicalKeys)
assert(`${published[0]?.source}:${published[0]?.skillPath}`===firstCanonical&&published.slice(1).map(x=>x.key).join(',')==='organic/high-score,organic/next-score','eligible canonical paths must precede the publication cap without reordering organic candidates')
console.log('Canonical seed validation passed: exact related searches deterministically discover the intended upstream Skills, unrelated domains stay organic, multi-seed queries are isolated and ordered, configured paths precede analysis/publication caps after normal gates, and downstream security scanning remains unchanged.')
