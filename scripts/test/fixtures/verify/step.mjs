import { appendFileSync } from 'node:fs'

// verify 실행기 테스트의 명령 하나다. 실행된 순서를 기록하고 요청한 종료 코드나 signal로 끝난다.
const [trace, name, outcome = '0'] = process.argv.slice(2)
appendFileSync(trace, `${name}\n`)

if (outcome === 'SIGTERM') {
  process.kill(process.pid, outcome)
} else {
  process.exitCode = Number(outcome)
}
