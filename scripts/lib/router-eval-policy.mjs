export function canon(value=''){
  return String(value).toLowerCase()
    .replace(/next\.js/g,'nextjs')
    .replace(/shadcn\/ui/g,'shadcn')
    .replace(/tool[ -]calling/g,'tool-calling')
    .replace(/function[ -]calling/g,'function-calling')
    .replace(/app[ -]router/g,'app-router')
    .replace(/server[ -]components/g,'server-components')
    .replace(/design[ -]system/g,'design-system')
    .replace(/reverse[ -]engineering/g,'reverse-engineering')
    .replace(/react[ -]native/g,'react-native')
    .replace(/test[ -]driven[ -]development/g,'tdd')
    .replace(/vulnerabilities/g,'vulnerability')
    .replace(/[^a-z0-9+#.-]+/g,'-')
    .replace(/^-+|-+$/g,'')
}

export function signalMatches(signal,term){
  const s=canon(signal),t=canon(term)
  if(!s||!t)return false
  if(s===t)return true
  const signalParts=s.split('-').filter(Boolean)
  const termParts=t.split('-').filter(Boolean)
  if(termParts.length&&termParts.length<=signalParts.length){
    for(let i=0;i<=signalParts.length-termParts.length;i++){
      if(termParts.every((part,index)=>signalParts[i+index]===part))return true
    }
  }
  return t.length>=5&&(s.includes(t)||t.includes(s))
}

// Named-technology anchors are stricter than ordinary routing signals. Match a
// complete canonical word/phrase inside the signal, never the reverse. This
// lets `backend-fastapi-api` prove FastAPI while preventing `api` from doing so;
// likewise, `native` cannot prove React Native.
export function anchorSignalMatches(signal,term){
  const signalParts=canon(signal).split('-').filter(Boolean)
  const termParts=canon(term).split('-').filter(Boolean)
  if(!signalParts.length||!termParts.length||termParts.length>signalParts.length)return false
  for(let i=0;i<=signalParts.length-termParts.length;i++){
    if(termParts.every((part,index)=>signalParts[i+index]===part))return true
  }
  return false
}

export function evidenceSignals(matches=[]){
  return [...new Set(matches.flatMap(x=>[
    ...(x.match_details?.matched_signals||[]),
    x.id||'',
    x.name||''
  ]).map(canon).filter(Boolean))]
}

export function applySpecificityPolicy(test,policy={}){
  return {...test,...(policy?.cases?.[test.id]||{})}
}

function hitCount(signals,terms=[],matcher=signalMatches){
  return terms.filter(term=>signals.some(signal=>matcher(signal,term))).length
}

export function evaluateRoutingCase(test,matches=[],meta={}){
  const ids=new Set(matches.map(x=>x.id))
  const expectedHits=(test.expectedAnyIds||[]).filter(x=>ids.has(x)).length
  const requiredTerms=test.requiredSignalTerms||[]
  const anchorTerms=test.anchorSignalTerms||[]
  const signals=evidenceSignals(matches)
  const signalHits=hitCount(signals,requiredTerms)
  const anchorSignalHits=hitCount(signals,anchorTerms,anchorSignalMatches)
  const unsafe=matches.filter(x=>['D','Blocked'].includes(x.security)).length
  const minSignalHits=Number(test.minSignalHits||0)
  const candidates=matches.map(x=>{
    const candidateSignals=(x.match_details?.matched_signals||[]).map(canon).filter(Boolean)
    const requiredHits=hitCount(candidateSignals,requiredTerms)
    const anchorHits=hitCount(candidateSignals,anchorTerms,anchorSignalMatches)
    const expected=(test.expectedAnyIds||[]).includes(x.id)
    const relevant=expected||(anchorTerms.length?anchorHits>0:requiredHits>=Math.max(1,minSignalHits))
    return {
      id:x.id,
      score:Number(x.match_score||0),
      coverage:Number(x.match_details?.coverage||0),
      expected,
      relevant,
      required_hits:requiredHits,
      anchor_hits:anchorHits,
      signals:candidateSignals
    }
  })
  const relevantTop3=candidates.filter(x=>x.relevant).length
  const lowEvidenceTop3=candidates.length-relevantTop3
  const anchorCandidateCount=candidates.filter(x=>x.anchor_hits>0).length
  const gap=meta.capabilityGap||null
  const gapConsistent=matches.length===3
    ? !gap?.detected
    : Boolean(gap?.detected)&&Number(gap?.returned)===matches.length&&Number(gap?.missing)===3-matches.length
  const structural=meta.source==='skillradar-registry'
    && meta.registryMode==='local-bundled'
    && matches.length<=3
    && gapConsistent
  const maxLowEvidence=Number.isFinite(Number(test.maxLowEvidenceTop3))?Number(test.maxLowEvidenceTop3):Infinity
  const specificityPass=anchorSignalHits>=Number(test.minAnchorSignalHits||0)
    && anchorCandidateCount>=Number(test.minAnchorCandidates||0)
    && lowEvidenceTop3<=maxLowEvidence
  const cleanGapPass=Boolean(test.allowCleanCapabilityGap)
    && structural
    && unsafe===0
    && Boolean(gap?.detected)
    && matches.length===0
  const pass=cleanGapPass||(structural
    && unsafe===0
    && expectedHits>=Number(test.minExpectedHits||0)
    && signalHits>=minSignalHits
    && specificityPass)
  return {
    id:test.id,
    domain:test.domain,
    tier:test.tier,
    pass,
    clean_gap_pass:cleanGapPass,
    top3:matches.map(x=>x.id),
    recommendation_count:matches.length,
    capability_gap:Boolean(gap?.detected),
    top1_score:Number(matches[0]?.match_score||0),
    expected_hits:expectedHits,
    signal_hits:signalHits,
    anchor_signal_hits:anchorSignalHits,
    anchor_candidate_count:anchorCandidateCount,
    specificity_pass:specificityPass,
    relevant_top3:relevantTop3,
    low_evidence_top3:lowEvidenceTop3,
    unsafe_top3:unsafe,
    candidates,
    signals
  }
}

export function summarizeRoutingResults(results=[]){
  const contract=results.filter(x=>x.tier==='contract')
  const coverage=results.filter(x=>x.tier!=='contract')
  const sum=(key)=>results.reduce((n,x)=>n+Number(x[key]||0),0)
  const capabilityGapCases=results.filter(x=>x.capability_gap).length
  const specificityFailures=results.filter(x=>!x.specificity_pass&&!x.clean_gap_pass).length
  const byDomain={}
  for(const row of results){
    const bucket=byDomain[row.domain]||{cases:0,passed:0,lowEvidenceTop3:0,specificityFailures:0,capabilityGapCases:0,recommendations:0}
    bucket.cases++
    if(row.pass)bucket.passed++
    bucket.lowEvidenceTop3+=row.low_evidence_top3
    if(!row.specificity_pass&&!row.clean_gap_pass)bucket.specificityFailures++
    if(row.capability_gap)bucket.capabilityGapCases++
    bucket.recommendations+=row.recommendation_count
    byDomain[row.domain]=bucket
  }
  for(const bucket of Object.values(byDomain)){
    bucket.passRate=Number((bucket.passed/Math.max(1,bucket.cases)).toFixed(3))
    bucket.averageRecommendationCount=Number((bucket.recommendations/Math.max(1,bucket.cases)).toFixed(2))
    delete bucket.recommendations
  }
  const passed=results.filter(x=>x.pass).length
  return {
    cases:results.length,
    passed,
    passRate:Number((passed/Math.max(1,results.length)).toFixed(3)),
    contract:{cases:contract.length,passed:contract.filter(x=>x.pass).length,passRate:Number((contract.filter(x=>x.pass).length/Math.max(1,contract.length)).toFixed(3))},
    coverage:{cases:coverage.length,passed:coverage.filter(x=>x.pass).length,passRate:Number((coverage.filter(x=>x.pass).length/Math.max(1,coverage.length)).toFixed(3))},
    unsafeTop3:sum('unsafe_top3'),
    lowEvidenceTop3:sum('low_evidence_top3'),
    specificityFailures,
    capabilityGapCases,
    averageRecommendationCount:Number((sum('recommendation_count')/Math.max(1,results.length)).toFixed(2)),
    averageRelevantTop3:Number((sum('relevant_top3')/Math.max(1,results.length)).toFixed(2)),
    averageTop1Score:Number((sum('top1_score')/Math.max(1,results.length)).toFixed(1)),
    expectedHitsTotal:sum('expected_hits'),
    signalHitsTotal:sum('signal_hits'),
    anchorSignalHitsTotal:sum('anchor_signal_hits'),
    byDomain
  }
}
