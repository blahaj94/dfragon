import { appendFileSync } from 'node:fs'

const [trace, name, outcome = '0'] = process.argv.slice(2)
appendFileSync(trace, `${name}\n`)

if (outcome === 'SIGTERM') {
  process.kill(process.pid, outcome)
} else {
  process.exitCode = Number(outcome)
}
