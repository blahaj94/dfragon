const STAGES = [
  'config-read',
  'config-parse',
  'config-shape',
  'isolation',
  'ancestor-inspection',
  'evidence-inspection',
  'root-inspection',
  'recovery-manifest',
  'manifest-publication',
  'scenario',
  'terminal-publication',
  'result-publication'
] as const

type Stage = (typeof STAGES)[number]
export type StageDiagnostic = {
  enter(stage: Stage): void
  current(): Stage
  run<T>(operation: () => Promise<T>): Promise<T>
}

export function createStageDiagnostic(): StageDiagnostic {
  let stage: Stage = STAGES[0]
  return {
    enter: (next) => {
      stage = next
    },
    current: () => stage,
    run: async (operation) => {
      try {
        return await operation()
      } catch {
        throw new Error(`Synthetic Windows fixture failed at ${stage}; preserve evidence.`)
      }
    }
  }
}
