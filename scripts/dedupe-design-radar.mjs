#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
const GENERATED_CHUNK='design-skills-radar.json'

async function readJson(file,fallback=null){
  try{return JSON.parse(await fs.readFile(path.join(root,file),'utf8'))}catch{return fallback}
}
async function writeJson(file,value){
  await fs.writeFile(path.join(root,file),JSON.stringify(value,null,2)+'\n')
}

export function normalizeDesignRadar(seedSkills=[],radarSkills=[]){
  const seedIds=new Set()
  const duplicateSeedIds=[]
  for(const skill of seedSkills){
    const id=String(skill?.id||'')
    if(!id)continue
    if(seedIds.has(id))duplicateSeedIds.push(id)
    seedIds.add(id)
  }
  if(duplicateSeedIds.length){
    throw new Error(`seed design registry contains duplicate ids: ${[...new Set(duplicateSeedIds)].join(', ')}`)
  }

  const byId=new Map()
  let radarInternalDuplicates=0
  for(const skill of radarSkills){
    const id=String(skill?.id||'')
    if(!id)continue
    const previous=byId.get(id)
    if(previous)radarInternalDuplicates++
    if(!previous||Number(skill.signalScore||0)>Number(previous.signalScore||0))byId.set(id,skill)
  }

  let seedCollisions=0
  const normalized=[]
  for(const skill of byId.values()){
    if(seedIds.has(skill.id)){
      seedCollisions++
      continue
    }
    normalized.push(skill)
  }

  return {
    skills:normalized,
    seedCount:seedSkills.length,
    radarInputCount:radarSkills.length,
    radarCount:normalized.length,
    seedCollisions,
    radarInternalDuplicates
  }
}

export async function run(){
  const manifest=await readJson('data/design-skill-index.json',{chunks:[],count:0})
  const seedChunks=(manifest.seedChunks||manifest.chunks||[]).filter(x=>x!==GENERATED_CHUNK)
  const seedSkills=[]
  for(const file of seedChunks)seedSkills.push(...(await readJson(`data/${file}`,[])))
  const radarSkills=await readJson(`data/${GENERATED_CHUNK}`,[])
  const result=normalizeDesignRadar(seedSkills,radarSkills)

  await writeJson(`data/${GENERATED_CHUNK}`,result.skills)
  await writeJson('data/design-skill-index.json',{
    ...manifest,
    seedChunks,
    chunks:[...seedChunks,GENERATED_CHUNK],
    seedCount:result.seedCount,
    radarCount:result.radarCount,
    count:result.seedCount+result.radarCount
  })

  const allIds=[...seedSkills,...result.skills].map(x=>x.id).filter(Boolean)
  if(new Set(allIds).size!==allIds.length)throw new Error('design registry id normalization failed')
  console.log(JSON.stringify({
    seedCount:result.seedCount,
    radarInputCount:result.radarInputCount,
    radarCount:result.radarCount,
    seedCollisionsRemoved:result.seedCollisions,
    radarInternalDuplicatesRemoved:result.radarInternalDuplicates,
    totalCount:allIds.length
  }))
}

if(process.env.SKILLRADAR_DESIGN_DEDUPE_SELFTEST==='1'){
  const seed=[{id:'seed-a'},{id:'seed-b'}]
  const radar=[
    {id:'seed-a',signalScore:99},
    {id:'radar-x',signalScore:60},
    {id:'radar-x',signalScore:80},
    {id:'radar-y',signalScore:70}
  ]
  const r=normalizeDesignRadar(seed,radar)
  if(r.seedCollisions!==1)throw new Error('self-test: expected one seed collision')
  if(r.radarInternalDuplicates!==1)throw new Error('self-test: expected one Radar duplicate')
  if(r.skills.length!==2)throw new Error('self-test: expected two generated Radar skills')
  if(r.skills.find(x=>x.id==='radar-x')?.signalScore!==80)throw new Error('self-test: highest-score Radar duplicate must win')
  let seedFailure=false
  try{normalizeDesignRadar([{id:'dup'},{id:'dup'}],[])}catch{seedFailure=true}
  if(!seedFailure)throw new Error('self-test: duplicate seed ids must fail closed')
  console.log('Design Radar id normalization self-test passed: seed ownership, best Radar duplicate, and duplicate-seed fail-closed behavior verified.')
}else{
  await run()
}
