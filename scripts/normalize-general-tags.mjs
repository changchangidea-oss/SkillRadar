#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root=path.resolve('.')
const file=path.join(root,'data/general-skills-radar.json')
const skills=JSON.parse(fs.readFileSync(file,'utf8'))
const GENERIC=new Set(['agent','agents','skill','skills','use','using','workflow','workflows','integration','integrations','general','technical','production','quality'])
function canon(value=''){return String(value).toLowerCase().replace(/next\.js/g,'nextjs').replace(/[^a-z0-9+#.-]+/g,'-').replace(/^-+|-+$/g,'')}
function hay(skill){return canon(`${skill.name||''} ${skill.slug||''} ${skill.summary||''}`)}
function appears(text,term){const t=canon(term);if(!t||GENERIC.has(t))return false;const tokens=new Set(text.split(/[^a-z0-9+#.-]+/).filter(Boolean));return tokens.has(t)||(t.length>=5&&text.includes(t))}
function narrow(skill){
  const text=hay(skill),classes=Array.isArray(skill.classifications)?skill.classifications:[]
  const primary=classes[0]
  const strongSecondary=classes.slice(1).filter(c=>Number(c.relevance||0)>=Math.max(30,Number(primary?.relevance||0)*.65)).slice(0,1)
  const classTerms=[primary,...strongSecondary].filter(Boolean).flatMap(c=>c.matched||[])
  const explicit=(skill.tags||[]).filter(t=>appears(text,t))
  const tags=[...new Set([...explicit,...classTerms.filter(t=>appears(text,t))].map(canon).filter(Boolean))].slice(0,12)
  return {...skill,tags}
}
const out=skills.map(narrow)
let changed=0,removed=0
for(let i=0;i<skills.length;i++){
  const before=new Set(skills[i].tags||[]),after=new Set(out[i].tags||[])
  if(JSON.stringify([...before])!==JSON.stringify([...after]))changed++
  for(const tag of before)if(!after.has(canon(tag)))removed++
}
const summary={skills:skills.length,changed,removedTags:removed,mode:process.env.SKILLRADAR_TAG_NORMALIZE_CHECK==='1'?'check':'write'}
console.log(JSON.stringify(summary))
if(process.env.SKILLRADAR_TAG_NORMALIZE_CHECK!=='1')fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n')
if(out.some(s=>['D','Blocked'].includes(s.security)))throw new Error('tag normalization must never alter the safety gate')
