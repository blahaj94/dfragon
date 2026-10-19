export const BUILD_VERSION_SERVICES = ['api', 'accounts', 'ocr'] as const
export type BuildVersionService = (typeof BUILD_VERSION_SERVICES)[number]

export type ServerVersion =
  | Readonly<{ status: 'available'; commit: string | null }>
  | Readonly<{ status: 'unsupported' }>
  | Readonly<{ status: 'unavailable' }>

export type BuildVersions = Readonly<{
  desktop: Readonly<{ version: string; commit: string | null; dirty: boolean | null }>
  servers: Readonly<Record<BuildVersionService, ServerVersion>>
}>

export type BuildVersionsApi = { getBuildVersions: () => Promise<BuildVersions> }
