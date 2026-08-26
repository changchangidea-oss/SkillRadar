function normalizeSearchText(value=''){
  return decodeURIComponent(String(value)).toLowerCase().replace(/[^a-z0-9+#.-]+/g,' ').trim()
}

function searchTermMatches(searchText,term){
  const hay=` ${normalizeSearchText(searchText)} `
  const needle=` ${normalizeSearchText(term)} `
  return needle.trim().length>0&&hay.includes(needle)
}

export function matchingSeedsForRepositorySearch(url,seeds=[]){
  const value=String(url)
  if(!value.includes('/search/repositories?'))return []
  return seeds.filter(seed=>(seed.searchTerms||[]).some(term=>searchTermMatches(value,term)))
}

export function shouldSeedRepositorySearch(url,seeds=[]){
  return matchingSeedsForRepositorySearch(url,seeds).length>0
}

export function prioritizeRepositoryItems(items,seedRepos=[]){
  const requested=Array.isArray(seedRepos)?seedRepos:[seedRepos]
  const seeds=requested.filter(Boolean)
  const names=new Set(seeds.map(repo=>repo.full_name))
  return [...seeds,...(items||[]).filter(item=>!names.has(item?.full_name))]
}

export function prioritizeTreeEntries(entries,paths=[]){
  const wanted=new Set(paths)
  const first=[],rest=[]
  for(const entry of entries||[]){(wanted.has(entry?.path)?first:rest).push(entry)}
  first.sort((a,b)=>paths.indexOf(a.path)-paths.indexOf(b.path))
  return [...first,...rest]
}

export function canonicalCandidateKeys(seeds=[]){
  return new Set(seeds.flatMap(seed=>(seed.paths||[]).map(skillPath=>`${seed.repo}:${skillPath}`)))
}

function candidateKey(item={}){
  return item.key||`${item.source||''}:${item.skillPath||''}`
}

export function prioritizeAnalysisCandidates(items,canonicalKeys=new Set()){
  return [...(items||[])].sort((a,b)=>
    Number(canonicalKeys.has(candidateKey(b)))-Number(canonicalKeys.has(candidateKey(a)))
    ||((b?.channels?.length||0)-(a?.channels?.length||0))
    ||((b?.repoStars||0)-(a?.repoStars||0))
  )
}

export function prioritizeCanonicalCandidates(items,canonicalKeys=new Set()){
  const canonical=[],organic=[]
  for(const item of items||[])(canonicalKeys.has(candidateKey(item))?canonical:organic).push(item)
  return [...canonical,...organic]
}
