#!/usr/bin/env node
import assert from 'node:assert/strict'
import { parseSkillFrontmatter } from './lib/skill-frontmatter.mjs'

const literal=parseSkillFrontmatter(`---
name: image-poster
description: |
  Single-image generation skill for posters, key art,
  editorial illustrations, and packaging graphics.
license: Apache-2.0
---
# Image poster
`)
assert.equal(literal.name,'image-poster')
assert.match(literal.description,/Single-image generation skill/)
assert.match(literal.description,/editorial illustrations/)
assert.notEqual(literal.description,'|')
assert.equal(literal.license,'Apache-2.0')

const folded=parseSkillFrontmatter(`---\r
name: "agent-orchestration"\r
description: >-\r
  Coordinate parallel agents,\r
  reviewers, and workflow state.\r
version: '1'\r
---\r
`)
assert.equal(folded.name,'agent-orchestration')
assert.equal(folded.description,'Coordinate parallel agents, reviewers, and workflow state.')
assert.equal(folded.version,'1')
assert.deepEqual(parseSkillFrontmatter('# No frontmatter'),{})

console.log('Skill frontmatter validation passed: inline, quoted, CRLF, and YAML literal/folded block descriptions retain real routing evidence.')
