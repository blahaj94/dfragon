#!/usr/bin/env node
import { cpSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const [group, destination] = process.argv.slice(2)
if (!['lib', 'desktop'].includes(group) || !destination) {
  throw new Error('Use dfragon-copy-notices lib|desktop <output directory>')
}
mkdirSync(destination, { recursive: true })
cpSync(fileURLToPath(new URL(`../notices/${group}/`, import.meta.url)), destination, {
  recursive: true
})
