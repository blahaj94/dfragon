import { readFile } from 'node:fs/promises'
import { Controller, Get, Inject } from '@nestjs/common'
import { parseServerBuildInfo } from '@dfragon/lib'
import type { ServerBuildInfo } from '@dfragon/lib'

export const API_BUILD_INFO = Symbol('API_BUILD_INFO')

export async function readApiBuildInfo(path = '/app/build-info.json'): Promise<ServerBuildInfo> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'))
    return parseServerBuildInfo(value, 'api') ?? { service: 'api', commit: null }
  } catch {
    return { service: 'api', commit: null }
  }
}

@Controller('version')
export class ApiVersionController {
  constructor(@Inject(API_BUILD_INFO) private readonly buildInfo: ServerBuildInfo) {}

  @Get()
  version(): ServerBuildInfo {
    return this.buildInfo
  }
}
