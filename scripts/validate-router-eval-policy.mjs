#!/usr/bin/env node
import { anchorSignalMatches } from './lib/router-eval-policy.mjs'

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

console.log('Router Eval specificity validation passed: named technology and service anchors require exact canonical word/phrase boundaries; generic API, native, research, and partial words cannot satisfy them.')
