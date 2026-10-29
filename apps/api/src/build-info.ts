import { readFile } from 'node:fs/promises'
import { Controller, Get, Inject } from '@nestjs/common'
import { parseServerBuildInfo } from '@dfragon/lib'
import type { ServerBuildInfo } from '@dfragon/lib'

export const API_BUILD_INFO = Symbol('API_BUILD_INFO')

export async function readApiBuildInfo(path = '/app/build-info.json'): Promise<ServerBuildInfo> {
  const value: unknown = await readFile(path, 'utf8')
    .then(JSON.parse)
    .catch(() => null)
  const info = parseServerBuildInfo(value, 'api') ?? { service: 'api', commit: null }

  return info
}

@Controller('version')
export class ApiVersionController {
  constructor(@Inject(API_BUILD_INFO) private readonly buildInfo: ServerBuildInfo) {}

  @Get()
  version(): ServerBuildInfo {
    return this.buildInfo
  }
}
