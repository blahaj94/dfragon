import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const toolRoot = fileURLToPath(new URL('./ocr-pipeline/', import.meta.url))
const usage = `Desktop OCR model tooling (development only)

pnpm --filter @ldb/desktop ocr:setup [--python <executable>]
pnpm --filter @ldb/desktop ocr:check
pnpm --filter @ldb/desktop ocr:test
pnpm --filter @ldb/desktop ocr <prepare|train|export|evaluate> [arguments]
pnpm --filter @ldb/desktop ocr python [arguments]

Relative data paths are resolved from apps/desktop, regardless of the caller's cwd.
Setup installs only the CPU tooling/test environment, not PaddlePaddle or CUDA.
`
const checkVersion =
  'import sys; assert (3, 11) <= sys.version_info < (3, 14), "Python 3.11-3.13 required"'

/**
 * Plan commands without starting an interpreter; keep the Python environment local to Desktop.
 * @param {string[]} argv
 * @param {{ root?: string, platform?: string }} options
 * @returns {{ executable: string, args: string[], cwd: string, venv?: string }[]}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
export function planCommands(argv, { root = toolRoot, platform = process.platform } = {}) {
  const [action, ...args] = argv
  const venv = join(root, '.venv')
  const binaryDirectory = platform === 'win32' ? 'Scripts' : 'bin'
  const executableName = platform === 'win32' ? 'python.exe' : 'python'
  const python = join(venv, binaryDirectory, executableName)
  const cwd = resolve(root, '../..')
  /** @param {string[]} values @returns {{ executable: string, args: string[], cwd: string, venv: string }} */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
  const step = (values) => ({ executable: python, args: values, cwd, venv })

  if (action === 'setup') {
    const { values } = parseArgs({ args, options: { python: { type: 'string' } } })
    const bootstrap = values.python ?? (platform === 'win32' ? 'python' : 'python3')
    if (bootstrap.trim() === '') {
      throw new Error('Specify a Python executable, not an empty value.')
    }
    const commands = []
    if (existsSync(venv)) {
      if (!existsSync(python) || !existsSync(join(venv, 'pyvenv.cfg'))) {
        throw new Error('Incomplete OCR .venv; remove that tool environment before running setup.')
      }
      if (values.python != null) {
        throw new Error(
          'OCR .venv exists; rerun setup without --python, or remove it to change Python.'
        )
      }
    } else {
      commands.push(
        { executable: bootstrap, args: ['-c', checkVersion], cwd },
        { executable: bootstrap, args: ['-m', 'venv', venv], cwd }
      )
    }
    commands.push(
      step(['-c', checkVersion + '; assert sys.prefix != sys.base_prefix']),
      step(['-m', 'pip', 'install', '-r', join(root, 'requirements-tooling.txt')]),
      step(['-m', 'pip', 'install', '--no-deps', '--no-build-isolation', '-e', root]),
      step(['-m', 'pip', 'check'])
    )
    return commands
  }

  const commands = ['prepare', 'train', 'export', 'evaluate', 'python', 'test', 'check']
  if (!commands.includes(action)) {
    throw new Error('Unknown OCR command. Run pnpm --filter @ldb/desktop ocr --help.')
  }
  if (!existsSync(python) || !existsSync(join(venv, 'pyvenv.cfg'))) {
    throw new Error('OCR environment is missing. Run pnpm --filter @ldb/desktop ocr:setup first.')
  }
  if (action === 'python') {
    return [step(args.length === 0 ? ['--version'] : args)]
  }
  if (action === 'test' || action === 'check') {
    if (args.length !== 0) {
      throw new Error('OCR test/check commands do not accept extra arguments.')
    }
    const launcher = resolve(root, '../ocr-pipeline.mjs')
    const tests = join(root, 'tests', 'launcher.node.mjs')
    if (action === 'test') {
      return [
        { executable: process.execPath, args: ['--test', tests], cwd },
        step(['-m', 'pytest', '-c', join(root, 'pyproject.toml'), join(root, 'tests'), '-q'])
      ]
    }
    return [
      { executable: process.execPath, args: ['--check', launcher], cwd },
      { executable: process.execPath, args: ['--check', tests], cwd },
      step(['-m', 'compileall', '-q', join(root, 'ldb_ocr'), join(root, 'tests')]),
      step(['-m', 'pip', 'check'])
    ]
  }
  return [step(['-m', 'ldb_ocr', action, ...args])]
}

/**
 * Run sequentially without a shell, preserving failure codes and waiting for owned children.
 * @param {ReturnType<typeof planCommands>} commands
 * @returns {Promise<number>}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
export async function executeCommands(commands) {
  let active = null
  let interrupted = null
  /** @param {NodeJS.Signals} signal @returns {void} */
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
  const stop = (signal) => {
    if (interrupted != null) {
      return
    }
    interrupted = signal
    if (active?.pid == null) {
      return
    }
    if (process.platform === 'win32') {
      // Windows cannot deliver SIGINT with ChildProcess.kill; terminate only our owned tree.
      spawnSync('taskkill', ['/PID', String(active.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      // Python's existing KeyboardInterrupt boundary cleans up its trainer/exporter process group.
      active.kill('SIGINT')
    }
  }
  const onInterrupt = stop.bind(null, 'SIGINT')
  const onTerminate = stop.bind(null, 'SIGTERM')
  process.on('SIGINT', onInterrupt)
  process.on('SIGTERM', onTerminate)
  try {
    for (const command of commands) {
      if (interrupted != null) {
        break
      }
      const env = { ...process.env }
      delete env.PYTHONHOME
      delete env.PYTHONPATH
      env.PYTHONNOUSERSITE = '1'
      env.PIP_DISABLE_PIP_VERSION_CHECK = '1'
      env.PIP_NO_INPUT = '1'
      if (command.venv != null) {
        const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
        env[pathKey] = dirname(command.executable) + delimiter + (env[pathKey] ?? '')
        env.VIRTUAL_ENV = command.venv
        env.PIP_REQUIRE_VIRTUALENV = '1'
      }
      const code = await new Promise((resolveCode, reject) => {
        active = spawn(command.executable, command.args, {
          cwd: command.cwd,
          env,
          shell: false,
          stdio: 'inherit',
          detached: process.platform !== 'win32'
        })
        active.once('error', () => {
          reject(new Error('OCR command could not start; check the local environment.'))
        })
        active.once('close', (exitCode, signal) => {
          active = null
          resolveCode(exitCode ?? (signal === 'SIGINT' ? 130 : 1))
        })
      })
      if (interrupted != null) {
        break
      }
      if (code !== 0) {
        return code
      }
    }
    return interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : 0
  } finally {
    process.removeListener('SIGINT', onInterrupt)
    process.removeListener('SIGTERM', onTerminate)
  }
}

const invokedPath = process.argv[1]
if (
  invokedPath != null &&
  invokedPath !== '' &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(usage)
  } else {
    try {
      process.exitCode = await executeCommands(planCommands(args))
    } catch {
      // Do not echo arbitrary arguments, paths, or dependency error objects into shared logs.
      console.error('OCR command failed. Run pnpm --filter @ldb/desktop ocr --help or ocr:setup.')
      process.exitCode = 1
    }
  }
}
