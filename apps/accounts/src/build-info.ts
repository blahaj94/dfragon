import { readFile } from 'node:fs/promises'
import { Controller, Get, Inject } from '@nestjs/common'
import { parseServerBuildInfo } from '@dfragon/lib'
import type { ServerBuildInfo } from '@dfragon/lib'

export const ACCOUNTS_BUILD_INFO = Symbol('ACCOUNTS_BUILD_INFO')

export async function readAccountsBuildInfo(
  path = '/app/build-info.json'
): Promise<ServerBuildInfo> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'))
    const info = parseServerBuildInfo(value, 'accounts')
    if (info != null) {

      return info
    }

    return { service: 'accounts', commit: null }
  } catch {

    return { service: 'accounts', commit: null }
  }
}

@Controller('version')
export class AccountsVersionController {
  constructor(@Inject(ACCOUNTS_BUILD_INFO) private readonly buildInfo: ServerBuildInfo) {}

  @Get()
  version(): ServerBuildInfo {

    return this.buildInfo
  }
}
