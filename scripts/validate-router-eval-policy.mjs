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

console.log('Router Eval specificity validation passed: technology anchors require exact canonical word/phrase boundaries; API cannot prove FastAPI and native cannot prove React Native.')
