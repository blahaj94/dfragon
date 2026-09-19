import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'
import { executeCommands, planCommands } from '../../ocr-pipeline.mjs'

const toolRoot = fileURLToPath(new URL('../', import.meta.url))
const desktopRoot = resolve(toolRoot, '../..')
const launcher = resolve(toolRoot, '../ocr-pipeline.mjs')

/** @param {import('node:test').TestContext} t @returns {string} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'ldb ocr 한글-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return root
}

/** @param {string} root @param {string} platform @returns {string} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
function fakeEnvironment(root, platform) {
  const python = join(root, '.venv', platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
  mkdirSync(dirname(python), { recursive: true })
  writeFileSync(python, '')
  writeFileSync(join(root, '.venv/pyvenv.cfg'), 'test environment marker, not an interpreter')
  return python
}

for (const platform of ['linux', 'win32']) {
  test(`${platform}: setup creates a local venv before installing pinned tooling`, (t) => {
    const root = fixture(t)
    const executable = join(root, 'Python installation', 'python')
    const commands = planCommands(['setup', '--python', executable], { root, platform })
    assert.equal(commands.length, 6)
    assert.equal(commands[0].executable, executable)
    assert.deepEqual(commands[1].args, ['-m', 'venv', join(root, '.venv')])
    assert.equal(commands[0].venv, undefined)
    assert.equal(commands[3].venv, join(root, '.venv'))
    assert.deepEqual(commands[3].args, [
      '-m',
      'pip',
      'install',
      '-r',
      join(root, 'requirements-tooling.txt')
    ])
    assert.deepEqual(commands[4].args, [
      '-m',
      'pip',
      'install',
      '--no-deps',
      '--no-build-isolation',
      '-e',
      root
    ])
    assert.ok(commands.every((command) => command.cwd === resolve(root, '../..')))
  })

  test(`${platform}: CLI arguments are passed unchanged without changing their cwd`, (t) => {
    const root = fixture(t)
    const python = fakeEnvironment(root, platform)
    const args = [
      'evaluate',
      '--output',
      '../private data/한글 & result',
      '--policy-path',
      'policy.json'
    ]
    const [command] = planCommands(args, { root, platform })
    assert.equal(command.executable, python)
    assert.deepEqual(command.args, ['-m', 'ldb_ocr', ...args])
    assert.equal(command.cwd, resolve(root, '../..'))
  })
}

test('missing environment fails rather than falling back to a global Python', (t) => {
  const root = fixture(t)
  assert.throws(() => planCommands(['train'], { root }), /ocr:setup first/)
  assert.equal(existsSync(join(root, '.venv')), false)
})

test('setup rejects incomplete environments without clearing or replacing them', (t) => {
  const root = fixture(t)
  mkdirSync(join(root, '.venv'))
  const marker = join(root, '.venv/keep.txt')
  writeFileSync(marker, 'keep')
  assert.throws(() => planCommands(['setup'], { root }), /Incomplete/)
  assert.equal(readFileSync(marker, 'utf8'), 'keep')
})

test('existing environments can reinstall dependencies without recreating Python', (t) => {
  const root = fixture(t)
  fakeEnvironment(root, process.platform)
  const commands = planCommands(['setup'], { root })
  assert.equal(commands.length, 4)
  assert.equal(
    commands.some((command) => command.args.includes('venv')),
    false
  )
  assert.throws(() => planCommands(['setup', '--python', 'different-python'], { root }), /exists/)
})

test('unknown commands and unsupported setup options are rejected', (t) => {
  const root = fixture(t)
  assert.throws(() => planCommands(['publish'], { root }), /Unknown OCR command/)
  assert.throws(() => planCommands(['setup', '--python', ''], { root }), /empty/)
  assert.throws(() => planCommands(['setup', '--global'], { root }))
})

test('checks and tests select only tooling sources, not the venv or model training', (t) => {
  const root = fixture(t)
  fakeEnvironment(root, process.platform)
  const checks = planCommands(['check'], { root })
  assert.deepEqual(checks[2].args, [
    '-m',
    'compileall',
    '-q',
    join(root, 'ldb_ocr'),
    join(root, 'tests')
  ])
  const tests = planCommands(['test'], { root })
  assert.equal(tests.length, 2)
  assert.equal(tests[0].executable, process.execPath)
  assert.deepEqual(tests[1].args, [
    '-m',
    'pytest',
    '-c',
    join(root, 'pyproject.toml'),
    join(root, 'tests'),
    '-q'
  ])
  assert.throws(() => planCommands(['test', '--skip'], { root }), /extra arguments/)
})

test('Python dependency commands use the same isolated interpreter', (t) => {
  const root = fixture(t)
  const python = fakeEnvironment(root, process.platform)
  const [command] = planCommands(['python', '-m', 'pip', 'check'], { root })
  assert.equal(command.executable, python)
  assert.deepEqual(command.args, ['-m', 'pip', 'check'])
  assert.deepEqual(planCommands(['python'], { root })[0].args, ['--version'])
})

test('help works from any directory without creating or installing an environment', (t) => {
  const root = fixture(t)
  const result = spawnSync(process.execPath, [launcher, '--help'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0)
  assert.match(result.stdout, /pnpm --filter @ldb\/desktop ocr:setup/)
  assert.equal(existsSync(join(root, '.venv')), false)
})

test('failure codes stop the sequence rather than reporting success', async (t) => {
  const root = fixture(t)
  const marker = join(root, 'must-not-run')
  const code = await executeCommands([
    { executable: process.execPath, args: ['-e', 'process.exit(2)'], cwd: root },
    {
      executable: process.execPath,
      args: ['-e', 'require("fs").writeFileSync(process.argv[1], "bad")', marker],
      cwd: root
    }
  ])
  assert.equal(code, 2)
  assert.equal(existsSync(marker), false)
})

test('spawn failures do not leak handlers or supplied strings', async (t) => {
  const root = fixture(t)
  const before = process.listenerCount('SIGINT')
  await assert.rejects(
    executeCommands([
      { executable: join(root, 'does-not-exist'), args: ['private-value'], cwd: root }
    ]),
    { message: 'OCR command could not start; check the local environment.' }
  )
  assert.equal(process.listenerCount('SIGINT'), before)
})

test('arguments stay literal and Python environment injection is removed', async (t) => {
  const root = fixture(t)
  const marker = join(root, 'argv.json')
  const previous = process.env.PYTHONPATH
  process.env.PYTHONPATH = 'foreign-module-directory'
  t.after(() => {
    if (previous == null) {
      delete process.env.PYTHONPATH
    } else {
      process.env.PYTHONPATH = previous
    }
  })
  const script = `require('fs').writeFileSync(process.argv[1], JSON.stringify({
    args: process.argv.slice(2), path: process.env.PYTHONPATH,
    venv: process.env.VIRTUAL_ENV, required: process.env.PIP_REQUIRE_VIRTUALENV
  }))`
  const code = await executeCommands([
    {
      executable: process.execPath,
      args: ['-e', script, marker, 'a & b', '月ね※', '$(do-not-run)'],
      cwd: root,
      venv: join(root, '.venv')
    }
  ])
  assert.equal(code, 0)
  assert.deepEqual(JSON.parse(readFileSync(marker, 'utf8')), {
    args: ['a & b', '月ね※', '$(do-not-run)'],
    venv: join(root, '.venv'),
    required: '1'
  })
})

test('termination waits for the owned command', { timeout: 15000 }, async (t) => {
  const root = fixture(t)
  const wrapper = join(root, 'wrapper.mjs')
  const marker = join(root, 'must-not-run')
  const source = `
    import { executeCommands } from ${JSON.stringify(pathToFileURL(launcher).href)}
    process.once('message', () => process.emit('SIGTERM'))
    const code = await executeCommands([
      { executable: process.execPath, args: ['-e', 'console.log("ready"); setInterval(() => {}, 1000)'], cwd: ${JSON.stringify(root)} },
      { executable: process.execPath, args: ['-e', 'require("fs").writeFileSync(process.argv[1], "bad")', ${JSON.stringify(marker)}], cwd: ${JSON.stringify(root)} }
    ])
    process.exitCode = code
    if (process.connected) process.disconnect()
  `
  writeFileSync(wrapper, source)
  const child = spawn(process.execPath, [wrapper], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  t.after(() => {
    if (child.exitCode == null) {
      child.kill()
    }
  })
  const closed = once(child, 'close')
  await once(child.stdout, 'data')
  child.send('cancel')
  const [code] = await closed
  assert.equal(code, 143)
  assert.equal(existsSync(marker), false)
})

test('Desktop scripts expose tooling without adding it to installation or packaging', () => {
  const manifest = JSON.parse(readFileSync(join(desktopRoot, 'package.json'), 'utf8'))
  assert.equal(manifest.scripts.ocr, 'node scripts/ocr-pipeline.mjs')
  for (const command of ['setup', 'test', 'check']) {
    assert.equal(manifest.scripts[`ocr:${command}`], `node scripts/ocr-pipeline.mjs ${command}`)
  }
  for (const command of ['postinstall', 'dev', 'build', 'build:distribution', 'build:win']) {
    assert.doesNotMatch(manifest.scripts[command], /ocr-pipeline|python|ocr:setup/)
  }
  assert.equal(manifest.scripts['prepare:ocr-assets'], 'node scripts/prepare-ocr-assets.mjs')
})
