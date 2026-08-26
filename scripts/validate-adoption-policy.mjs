#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root=path.resolve('.')
const policy=JSON.parse(fs.readFileSync(path.join(root,'data/adoption-policy.json'),'utf8'))
const golden=JSON.parse(fs.readFileSync(path.join(root,'data/router-golden-v1.json'),'utf8'))
const routerSource=fs.readFileSync(path.join(root,'packages/codex-plugin/scripts/skillradar.mjs'),'utf8')

if(policy.schemaVersion!==1)throw new Error(`Unsupported adoption policy schema: ${policy.schemaVersion}`)
if(policy.feedback?.automaticRankingWeightChanges!==false)throw new Error('Adoption feedback must never auto-change ranking weights')
if(policy.feedback?.productionRouterMayReadFeedbackArtifacts!==false)throw new Error('Production router must not read feedback artifacts directly')
if(policy.feedback?.mode!=='observation-only')throw new Error(`Feedback mode must remain observation-only; got ${policy.feedback?.mode}`)
if(policy.goldenEval?.cases!==golden.cases?.length)throw new Error(`Golden eval case count drift: policy=${policy.goldenEval?.cases}, data=${golden.cases?.length}`)
if(Number(policy.goldenEval?.minimumPassRate)!==Number(golden.thresholds?.passRate))throw new Error('Golden eval pass threshold drifted from adoption policy')
if(Number(policy.goldenEval?.minimumDomainPassRate)!==Number(golden.thresholds?.minDomainPassRate))throw new Error('Golden eval domain threshold drifted from adoption policy')
if(Number(policy.goldenEval?.unsafeTop3)!==Number(golden.thresholds?.unsafeTop3))throw new Error('Golden eval unsafe threshold drifted from adoption policy')

const required=new Set(['golden-eval','router-benchmark','expanded-eval','shadow-history','security-gate','human-review'])
const configured=new Set(policy.promotion?.requires||[])
for(const gate of required)if(!configured.has(gate))throw new Error(`Promotion policy missing required gate: ${gate}`)

if(/router-feedback|feedback-latest|adoption-feedback/i.test(routerSource))throw new Error('Production router appears to read feedback artifacts directly')

console.log('Adoption policy validation passed: 100-case Golden Eval is gated and feedback remains observation-only with no automatic ranking changes.')
