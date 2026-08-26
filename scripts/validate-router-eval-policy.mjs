#!/usr/bin/env node
import { anchorSignalMatches, evaluateRoutingCase } from './lib/router-eval-policy.mjs'

function assert(condition,message){
  if(!condition)throw new Error(message)
}

assert(anchorSignalMatches('fastapi','fastapi'),'exact FastAPI anchor should match')
assert(anchorSignalMatches('backend-fastapi-api','fastapi'),'FastAPI should match at a canonical phrase boundary')
assert(!anchorSignalMatches('api','fastapi'),'generic API must not prove FastAPI')
assert(!anchorSignalMatches('fastapi','api'),'API must not match inside FastAPI')

assert(anchorSignalMatches('react native','react-native'),'canonical React Native phrase should match')
assert(anchorSignalMatches('mobile-react-native-app','react native'),'React Native should match at canonical phrase boundaries')
assert(!anchorSignalMatches('native','react-native'),'generic native must not prove React Native')

assert(anchorSignalMatches('graphql-server','graphql'),'GraphQL should match as a complete canonical word')
assert(!anchorSignalMatches('graphqlish-server','graphql'),'technology names must not match partial words')
assert(anchorSignalMatches('gws-calendar-agenda','calendar'),'service anchors may match complete words in compound signals')
assert(anchorSignalMatches('github-actions','github'),'GitHub should match as a complete service name')
assert(!anchorSignalMatches('githubish-actions','github'),'partial service names must not satisfy anchors')
assert(anchorSignalMatches('figma-design-system','figma'),'Figma should match as a complete service name')
assert(!anchorSignalMatches('research','notion'),'generic research must not prove Notion')
assert(anchorSignalMatches('rag','rag'),'short canonical technology names may match exactly')
assert(!anchorSignalMatches('storage','rag'),'short anchors must not match inside unrelated words')
assert(anchorSignalMatches('poster-design','poster'),'poster must match as an exact design-medium anchor')
assert(!anchorSignalMatches('apply-photo-filter','poster'),'generic photo editing must not prove poster capability')

function match(id,name,signals){
  return {id,name,security:'B',match_score:70,match_details:{matched_signals:signals,coverage:0.7}}
}
function gapMeta(returned){
  return {source:'skillradar-registry',registryMode:'local-bundled',capabilityGap:returned<3?{detected:true,returned,missing:3-returned}:{detected:false,returned,missing:0}}
}

const flutterPolicy={
  id:'fixture-flutter',domain:'Mobile',tier:'coverage',expectedAnyIds:[],minExpectedHits:0,
  requiredSignalTerms:['flutter','mobile'],minSignalHits:1,
  anchorSignalTerms:['flutter'],minAnchorSignalHits:1,minAnchorCandidates:1,maxLowEvidenceTop3:0,
  candidateIdentityAnchorTerms:['flutter'],minCandidateIdentityAnchorHits:1,minCandidateRequiredHits:2
}
const sourcePolluted=evaluateRoutingCase(flutterPolicy,[match('flutter/agent-plugins/dart-write-documentation','Dart Write Documentation',['flutter','mobile'])],gapMeta(1))
assert(!sourcePolluted.pass,'a Flutter repository/source prefix must not make an unrelated Dart documentation sub-skill relevant')
assert(sourcePolluted.low_evidence_top3===1,'repository-context false positive must be counted as low-evidence')
assert(sourcePolluted.candidates[0].identity_anchor_hits===0,'candidate identity evidence must come from the candidate name, not its repository id/source')

const namedFlutter=evaluateRoutingCase(flutterPolicy,[match('flutter/agent-plugins/flutter-build-responsive-layout','Flutter Build Responsive Layout',['flutter','mobile'])],gapMeta(1))
assert(namedFlutter.pass,'a candidate whose own name and task signals prove Flutter mobile capability should pass')
assert(namedFlutter.low_evidence_top3===0,'qualified candidate must not be counted as low-evidence')

const mcpPolicy={
  id:'fixture-mcp',domain:'AI Agents',tier:'coverage',expectedAnyIds:[],minExpectedHits:0,
  requiredSignalTerms:['mcp','agent','tools'],minSignalHits:2,
  anchorSignalTerms:['mcp'],minAnchorSignalHits:1,minAnchorCandidates:1,maxLowEvidenceTop3:0,
  candidateIdentityAnchorTerms:['mcp'],minCandidateIdentityAnchorHits:1,minCandidateRequiredHits:2
}
const comfyFalsePositive=evaluateRoutingCase(mcpPolicy,[match('artokun/comfyui-mcp/color-correction','Color Correction',['mcp','agent','tools'])],gapMeta(1))
assert(!comfyFalsePositive.pass,'ComfyUI color correction must not become an MCP agent recommendation solely through ecosystem/repository evidence')
const dedicatedMcp=evaluateRoutingCase(mcpPolicy,[match('example/mcp-agent-builder','MCP Agent Builder',['mcp','agent','tools'])],gapMeta(1))
assert(dedicatedMcp.pass,'a dedicated MCP agent candidate with direct task evidence should pass')

const legacyExpectedPolicy={
  id:'fixture-legacy-expected',domain:'Legacy',tier:'contract',expectedAnyIds:['example/expected-skill'],minExpectedHits:1,
  requiredSignalTerms:[],minSignalHits:0,
  anchorSignalTerms:['named-service'],minAnchorSignalHits:0,minAnchorCandidates:0,maxLowEvidenceTop3:0
}
const legacyExpected=evaluateRoutingCase(legacyExpectedPolicy,[match('example/expected-skill','Expected Skill',[])],gapMeta(1))
assert(legacyExpected.pass,'an unconfigured legacy case may still use its expected-ID relevance shortcut')
assert(legacyExpected.candidate_evidence_failures===0,'unconfigured legacy cases must not report candidate-policy failures')
assert(legacyExpected.candidates[0].candidate_evidence_pass,'candidate evidence status must reflect the applicable legacy relevance policy')

console.log('Router Eval specificity validation passed: exact anchors remain strict, and policy v5 rejects repository/ecosystem-context false positives unless each candidate carries its own identity plus task evidence.')
