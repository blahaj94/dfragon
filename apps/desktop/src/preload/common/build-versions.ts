import { z } from 'zod'
import type { BuildVersions } from './types/build-versions'

const commitSchema = z
  .string()
  .length(40)
  .regex(/^[0-9a-f]{40}$/)
  .nullable()
const serverSchema = z.union([
  z.strictObject({ status: z.literal('available'), commit: commitSchema }),
  z.strictObject({ status: z.enum(['unsupported', 'unavailable']) })
])
const versionsSchema = z.strictObject({
  desktop: z.strictObject({
    version: z.string().min(1).max(128),
    commit: commitSchema,
    dirty: z.boolean().nullable()
  }),
  servers: z.strictObject({ api: serverSchema, accounts: serverSchema, ocr: serverSchema })
})

/** Accept only the public metadata snapshot crossing the main/preload/renderer boundary. */
export function parseBuildVersions(value: unknown): BuildVersions | null {
  const result = versionsSchema.safeParse(value)

  return result.success ? result.data : null
}
