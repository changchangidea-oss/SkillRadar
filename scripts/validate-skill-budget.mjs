import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'skillradar-budget-test-'))
const roots=path.join(tmp,'skills');fs.mkdirSync(roots,{recursive:true})
for(let i=0;i<10;i++){
  const dir=path.join(roots,`skill-${i}`);fs.mkdirSync(dir,{recursive:true})
  const name=i===0?'nextjs-helper':(i===1||i===2?'duplicate-helper':`misc-${i}`)
  const base=i===0?'Next.js React App Router architecture helper':(i===1||i===2?'Duplicate deployment automation helper for generic projects':`Unrelated generic utility capability ${i}`)
  fs.writeFileSync(path.join(dir,'SKILL.md'),`---\nname: ${name}\ndescription: "${base} ${'x'.repeat(1200)}"\n---\n# ${name}\n`)
}
const script=path.resolve('packages/codex-plugin/scripts/skill-budget.mjs')
const raw=execFileSync(process.execPath,[script,'audit','Next.js React dashboard'],{encoding:'utf8',env:{...process.env,CODEX_HOME:path.join(tmp,'codex-home'),SKILLRADAR_SKILL_ROOTS:roots},stdio:['ignore','pipe','pipe']})
const result=JSON.parse(raw)
if(result.source!=='skillradar-skill-budget'||result.mode!=='read-only')throw new Error('budget doctor source/mode mismatch')
if(result.catalog?.active!==10)throw new Error(`expected 10 active fixture skills, got ${result.catalog?.active}`)
if(result.budget?.pressure!=='overflow')throw new Error(`expected overflow pressure, got ${result.budget?.pressure}`)
if(!(result.budget?.projected_ratio<result.budget?.ratio))throw new Error('budget plan did not reduce projected pressure')
if(!Array.isArray(result.duplicate_groups)||result.duplicate_groups.length<1)throw new Error('duplicate skill group not detected')
if(!Array.isArray(result.recommendations)||result.recommendations.length<1)throw new Error('no pruning recommendations produced')
if(result.recommendations.some(x=>!x.config_snippet?.includes('enabled = false')))throw new Error('recommendation missing Codex skills.config snippet')
if(!String(result.apply_policy||'').includes('No configuration'))throw new Error('doctor must stay read-only by default')
fs.rmSync(tmp,{recursive:true,force:true})
console.log('Skill Budget Doctor validation passed: overflow detection + duplicate detection + read-only pruning plan.')
