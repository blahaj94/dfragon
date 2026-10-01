import { readFile } from 'node:fs/promises'
import { Controller, Get, Inject } from '@nestjs/common'
import { parseServerBuildInfo } from '@dfragon/lib'
import type { ServerBuildInfo } from '@dfragon/lib'

export const OCR_BUILD_INFO = Symbol('OCR_BUILD_INFO')

export async function readOcrBuildInfo(path = '/app/build-info.json'): Promise<ServerBuildInfo> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'))
    const info = parseServerBuildInfo(value, 'ocr')
    if (info != null) {
      return info
    }

    return { service: 'ocr', commit: null }
  } catch {
    return { service: 'ocr', commit: null }
  }
}

@Controller('version')
export class OcrVersionController {
  constructor(@Inject(OCR_BUILD_INFO) private readonly buildInfo: ServerBuildInfo) {}

  @Get()
  version(): ServerBuildInfo {
    return this.buildInfo
  }
}
