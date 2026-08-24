import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const ignored = new Set(['.git','node_modules'])
const binary = /\.(png|jpg|jpeg|gif|webp|zip|gz|tgz|woff2?|ttf|ico)$/i
const patterns = [
  ['OpenAI project key', /\bsk-proj-[A-Za-z0-9_-]{20,}\b/g],
  ['OpenAI legacy key', /\bsk-[A-Za-z0-9]{32,}\b/g],
  ['GitHub PAT', /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g],
  ['GitHub classic token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{30,}\b/g],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
]

function walk(dir, out=[]) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (ignored.has(entry.name)) continue
    const full=path.join(dir,entry.name)
    if (entry.isDirectory()) walk(full,out)
    else if (!binary.test(entry.name) && fs.statSync(full).size < 2_000_000) out.push(full)
  }
  return out
}

const findings=[]
for (const file of walk(root)) {
  let text=''
  try { text=fs.readFileSync(file,'utf8') } catch { continue }
  for (const [name,re] of patterns) {
    re.lastIndex=0
    if (re.test(text)) findings.push(`${path.relative(root,file)}: ${name}`)
  }
}

if (findings.length) {
  console.error('Potential committed secrets detected:\n' + findings.join('\n'))
  process.exit(1)
}
console.log('Secret pattern scan passed.')
