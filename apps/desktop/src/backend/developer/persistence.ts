import { DEVELOPER_ERROR_CODES } from '../../preload/common/developer-errors'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  DeveloperFrame,
  DeveloperSample,
  DeveloperSampleSource,
  DeveloperSettings
} from '../../preload/common/types/developer'
import {
  isDeveloperCollectionKind,
  isDeveloperPartySlot
} from '../../preload/common/developer-collection'
import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS } from './image-limits'
import { isCanonicalIsoTimestamp, isValidImageDimensions } from './validation'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_PNG_BYTES = 16 * 1024 * 1024
const MAX_SETTINGS_BYTES = 1024
const MAX_METADATA_BYTES = 4096
const MAX_LABEL_LENGTH = 500
const SAMPLE_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

type PngDimensions = { width: number; height: number }
type DeveloperStoreOptions = {
  rootDir: string
  decodePng: (png: Buffer) => PngDimensions | null
}
type DeveloperMetadata = DeveloperSample
type SettingsRead = { settings: DeveloperSettings; isCorrupt: boolean }
type CapturePng = () => Promise<Buffer>
type CollectedSampleInput = {
  png: Buffer
  capturedAt: string
  source: DeveloperSampleSource
}
type DeveloperStore = {
  getSettings: () => Promise<DeveloperSettings>
  setEnabled: (enabled: boolean) => Promise<DeveloperSettings>
  listSamples: () => Promise<DeveloperSample[]>
  readImage: (id: string) => Promise<string>
  addSample: (pngDataUrl: string) => Promise<DeveloperSample>
  saveLabel: (id: string, text: string | null) => Promise<DeveloperSample>
  setSampleExcluded: (id: string, excluded: boolean) => Promise<DeveloperSample>
  addCollectedSample: (
    sample: CollectedSampleInput,
    shouldCommit: () => boolean
  ) => Promise<DeveloperSample>
  captureFrame: (capturePng: CapturePng) => Promise<DeveloperFrame>
}

export class DeveloperStoreError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'DeveloperStoreError'
  }
}

function invalidCommand(): DeveloperStoreError {
  return new DeveloperStoreError(DEVELOPER_ERROR_CODES.INVALID_COMMAND)
}

function storageUnavailable(): DeveloperStoreError {
  return new DeveloperStoreError(DEVELOPER_ERROR_CODES.STORAGE_UNAVAILABLE)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value)
  return actualKeys.length === keys.length && keys.every((key) => actualKeys.includes(key))
}

function inspectPng(png: Buffer, decodePng: (png: Buffer) => PngDimensions | null): PngDimensions {
  const hasValidSize = png.length > 0 && png.length <= MAX_PNG_BYTES
  const hasSignature = png.length >= 33 && png.subarray(0, 8).equals(PNG_SIGNATURE)
  const hasHeader =
    hasSignature && png.readUInt32BE(8) === 13 && png.toString('ascii', 12, 16) === 'IHDR'
  if (!hasValidSize || !hasHeader) {
    throw invalidCommand()
  }

  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  if (!isValidImageDimensions(width, height)) {
    throw invalidCommand()
  }

  try {
    const decodedDimensions = decodePng(png)
    if (
      decodedDimensions == null ||
      decodedDimensions.width !== width ||
      decodedDimensions.height !== height
    ) {
      throw invalidCommand()
    }
  } catch {
    throw invalidCommand()
  }

  return { width, height }
}

function parsePngDataUrl(value: unknown): Buffer {
  if (typeof value !== 'string') {
    throw invalidCommand()
  }
  const prefix = 'data:image/png;base64,'
  const hasPrefix = value.startsWith(prefix)
  const encoded = hasPrefix ? value.slice(prefix.length) : ''
  const hasValidBase64 =
    encoded.length > 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)
  const maximumEncodedLength = Math.ceil(MAX_PNG_BYTES / 3) * 4
  if (!hasPrefix || !hasValidBase64 || encoded.length > maximumEncodedLength) {
    throw invalidCommand()
  }
  const png = Buffer.from(encoded, 'base64')
  const isCanonicalBase64 = png.toString('base64') === encoded
  if (!isCanonicalBase64) {
    throw invalidCommand()
  }
  return png
}

function parseSettings(value: unknown): DeveloperSettings | null {
  if (!isObject(value) || !hasExactKeys(value, ['enabled']) || typeof value.enabled !== 'boolean') {
    return null
  }
  return { enabled: value.enabled }
}

function parseSampleSource(value: unknown): DeveloperSampleSource | null | undefined {
  if (value === null) {
    return null
  }
  if (
    !isObject(value) ||
    !(
      hasExactKeys(value, ['slot', 'frameWidth', 'frameHeight', 'scale']) ||
      hasExactKeys(value, ['kind', 'slot', 'frameWidth', 'frameHeight', 'scale'])
    ) ||
    ('kind' in value && !isDeveloperCollectionKind(value.kind)) ||
    !isDeveloperPartySlot(value.slot, isDeveloperCollectionKind(value.kind) ? value.kind : 'hud') ||
    typeof value.frameWidth !== 'number' ||
    typeof value.frameHeight !== 'number' ||
    !isValidImageDimensions(value.frameWidth, value.frameHeight) ||
    typeof value.scale !== 'number' ||
    !Number.isFinite(value.scale) ||
    value.scale <= 0
  ) {
    return undefined
  }
  return {
    ...(isDeveloperCollectionKind(value.kind) ? { kind: value.kind } : {}),
    slot: value.slot,
    frameWidth: value.frameWidth,
    frameHeight: value.frameHeight,
    scale: value.scale
  }
}

function parseMetadata(value: unknown, expectedId: string): DeveloperMetadata | null {
  const legacyKeys = ['id', 'createdAt', 'width', 'height', 'text']
  const currentKeys = [...legacyKeys, 'excluded', 'source']
  if (!isObject(value) || (!hasExactKeys(value, legacyKeys) && !hasExactKeys(value, currentKeys))) {
    return null
  }
  const { id, createdAt, width, height, text } = value
  const excluded = 'excluded' in value ? value.excluded : false
  const source = 'source' in value ? parseSampleSource(value.source) : null
  const isValidId = typeof id === 'string' && id === expectedId && SAMPLE_ID.test(id)
  const isValidTimestamp = isCanonicalIsoTimestamp(createdAt)
  const isValidLabel =
    text === null || (typeof text === 'string' && text.length <= MAX_LABEL_LENGTH)
  const isValidExcluded = typeof excluded === 'boolean'
  const areValidDimensions =
    typeof width === 'number' && typeof height === 'number' && isValidImageDimensions(width, height)
  if (
    !isValidId ||
    !isValidTimestamp ||
    !isValidLabel ||
    !isValidExcluded ||
    source === undefined ||
    !areValidDimensions
  ) {
    return null
  }
  return { id, createdAt, width, height, text, excluded, source }
}

function createSerialQueue() {
  let tail: Promise<void> = Promise.resolve()
  return <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation, operation)
    tail = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}

function asStorageError(error: unknown): DeveloperStoreError {
  if (error instanceof DeveloperStoreError) {
    return error
  }
  return storageUnavailable()
}

function createPaths(rootDir: string): {
  directory: string
  samplesDirectory: string
  settings: string
  image: (id: string) => string
  metadata: (id: string) => string
} {
  const directory = join(rootDir, 'developer-mode')
  const samplesDirectory = join(directory, 'samples')
  return {
    directory,
    samplesDirectory,
    settings: join(directory, 'settings.json'),
    image: (id: string) => join(samplesDirectory, `${id}.png`),
    metadata: (id: string) => join(samplesDirectory, `${id}.json`)
  }
}

async function ensureDirectory(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
}

function collectionWriteCancelled(): DeveloperStoreError {
  return new DeveloperStoreError('DEVELOPER_COLLECTION_CANCELLED')
}

async function atomicWrite(
  filePath: string,
  contents: string | Buffer,
  shouldCommit?: () => boolean
): Promise<void> {
  if (shouldCommit != null && !shouldCommit()) {
    throw collectionWriteCancelled()
  }
  await ensureDirectory(dirname(filePath))
  if (shouldCommit != null && !shouldCommit()) {
    throw collectionWriteCancelled()
  }
  const temporaryPath = `${filePath}.tmp-${randomUUID()}`
  try {
    await fs.writeFile(temporaryPath, contents, { flag: 'wx', mode: 0o600 })
    const file = await fs.open(temporaryPath, 'r+')
    try {
      await file.sync()
    } finally {
      await file.close()
    }
    if (shouldCommit != null && !shouldCommit()) {
      throw collectionWriteCancelled()
    }
    await fs.rename(temporaryPath, filePath)
    if (shouldCommit != null && !shouldCommit()) {
      await fs.rm(filePath, { force: true })
      throw collectionWriteCancelled()
    }
  } catch (error) {
    try {
      await fs.rm(temporaryPath, { force: true })
    } catch {
      // Preserve the original persistence error.
    }
    throw error
  }
}

async function readRegularFile(filePath: string, maximumBytes: number): Promise<Buffer> {
  const stat = await fs.lstat(filePath)
  if (!stat.isFile() || stat.size > maximumBytes) {
    throw storageUnavailable()
  }
  return fs.readFile(filePath)
}

export function createDeveloperStore({
  rootDir,
  decodePng
}: DeveloperStoreOptions): DeveloperStore {
  const paths = createPaths(rootDir)
  const runSerial = createSerialQueue()
  const inQueue =
    <Arguments extends unknown[], Result>(operation: (...args: Arguments) => Promise<Result>) =>
    (...args: Arguments): Promise<Result> =>
      runSerial(() => operation(...args))

  async function readSettings(): Promise<SettingsRead> {
    let serializedSettings: Buffer
    try {
      serializedSettings = await readRegularFile(paths.settings, MAX_SETTINGS_BYTES)
    } catch (error) {
      const isMissing = isObject(error) && error.code === 'ENOENT'
      if (isMissing) {
        return { settings: { enabled: false }, isCorrupt: false }
      }
      if (error instanceof DeveloperStoreError) {
        return { settings: { enabled: false }, isCorrupt: true }
      }
      throw storageUnavailable()
    }

    try {
      const settings = parseSettings(JSON.parse(serializedSettings.toString('utf8')))
      return settings == null
        ? { settings: { enabled: false }, isCorrupt: true }
        : { settings, isCorrupt: false }
    } catch {
      return { settings: { enabled: false }, isCorrupt: true }
    }
  }

  async function requireEnabled(): Promise<void> {
    const { settings } = await readSettings()
    if (!settings.enabled) {
      throw new DeveloperStoreError(DEVELOPER_ERROR_CODES.DISABLED)
    }
  }

  async function readMetadata(id: string): Promise<DeveloperMetadata> {
    let serializedMetadata: Buffer
    try {
      serializedMetadata = await readRegularFile(paths.metadata(id), MAX_METADATA_BYTES)
    } catch (error) {
      const isMissing = isObject(error) && error.code === 'ENOENT'
      if (isMissing) {
        throw new DeveloperStoreError(DEVELOPER_ERROR_CODES.SAMPLE_NOT_FOUND)
      }
      throw storageUnavailable()
    }

    try {
      const metadata = parseMetadata(JSON.parse(serializedMetadata.toString('utf8')), id)
      if (metadata == null) {
        throw storageUnavailable()
      }
      return metadata
    } catch (error) {
      throw asStorageError(error)
    }
  }

  async function readSampleImage(metadata: DeveloperMetadata): Promise<Buffer> {
    const { id } = metadata
    let png: Buffer
    try {
      const imageStat = await fs.lstat(paths.image(id))
      if (!imageStat.isFile() || imageStat.size > MAX_PNG_BYTES) {
        throw storageUnavailable()
      }
      png = await fs.readFile(paths.image(id))
    } catch {
      throw storageUnavailable()
    }
    let dimensions: PngDimensions
    try {
      dimensions = inspectPng(png, decodePng)
    } catch {
      throw storageUnavailable()
    }
    const match = dimensions.width === metadata.width && dimensions.height === metadata.height
    if (!match) {
      throw storageUnavailable()
    }
    return png
  }

  const getSettings = inQueue(async (): Promise<DeveloperSettings> => {
    try {
      return (await readSettings()).settings
    } catch (error) {
      throw asStorageError(error)
    }
  })

  const setEnabled = inQueue(async (enabled: boolean): Promise<DeveloperSettings> => {
    if (typeof enabled !== 'boolean') {
      throw invalidCommand()
    }
    try {
      const current = await readSettings()
      if (enabled && current.isCorrupt) {
        throw storageUnavailable()
      }
      const settings = { enabled }
      await atomicWrite(paths.settings, JSON.stringify(settings))
      return settings
    } catch (error) {
      throw asStorageError(error)
    }
  })

  const listSamples = inQueue(async (): Promise<DeveloperSample[]> => {
    try {
      await requireEnabled()
      let entries: import('node:fs').Dirent[]
      try {
        entries = await fs.readdir(paths.samplesDirectory, { withFileTypes: true })
      } catch (error) {
        const isMissing = isObject(error) && error.code === 'ENOENT'
        if (isMissing) {
          return []
        }
        throw storageUnavailable()
      }

      const metadataFiles = entries.filter(
        (entry) =>
          entry.isFile() &&
          SAMPLE_ID.test(entry.name.replace(/\.json$/, '')) &&
          entry.name.endsWith('.json')
      )
      const samples = await Promise.all(
        metadataFiles.map((entry) => readMetadata(entry.name.slice(0, -'.json'.length)))
      )
      return samples.sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    } catch (error) {
      throw asStorageError(error)
    }
  })

  const readImage = inQueue(async (id: string): Promise<string> => {
    if (typeof id !== 'string' || !SAMPLE_ID.test(id)) {
      throw invalidCommand()
    }
    try {
      await requireEnabled()
      const metadata = await readMetadata(id)
      const png = await readSampleImage(metadata)
      return `data:image/png;base64,${png.toString('base64')}`
    } catch (error) {
      throw asStorageError(error)
    }
  })

  async function writeSample(
    png: Buffer,
    createdAt: string,
    source: DeveloperSampleSource | null,
    shouldCommit?: () => boolean
  ): Promise<DeveloperSample> {
    const { width, height } = inspectPng(png, decodePng)
    const sample: DeveloperSample = {
      id: randomUUID(),
      createdAt,
      width,
      height,
      text: null,
      excluded: false,
      source
    }
    await atomicWrite(paths.image(sample.id), png, shouldCommit)
    try {
      await atomicWrite(paths.metadata(sample.id), JSON.stringify(sample), shouldCommit)
    } catch (error) {
      try {
        await fs.rm(paths.image(sample.id), { force: true })
      } catch {
        // Preserve the metadata persistence failure.
      }
      throw error
    }
    return sample
  }

  const addSample = inQueue(async (pngDataUrl: string): Promise<DeveloperSample> => {
    try {
      await requireEnabled()
      const png = parsePngDataUrl(pngDataUrl)
      await ensureDirectory(paths.samplesDirectory)
      return await writeSample(png, new Date().toISOString(), null)
    } catch (error) {
      throw asStorageError(error)
    }
  })

  const addCollectedSample = inQueue(
    async (sample: CollectedSampleInput, shouldCommit: () => boolean): Promise<DeveloperSample> => {
      const isValidCapturedAt = isCanonicalIsoTimestamp(sample?.capturedAt)
      const source = parseSampleSource(sample?.source)
      if (
        !isObject(sample) ||
        !hasExactKeys(sample, ['png', 'capturedAt', 'source']) ||
        !Buffer.isBuffer(sample.png) ||
        !isValidCapturedAt ||
        source == null ||
        typeof shouldCommit !== 'function'
      ) {
        throw invalidCommand()
      }
      try {
        await requireEnabled()
        if (!shouldCommit()) {
          throw collectionWriteCancelled()
        }
        const createdSample = await writeSample(sample.png, sample.capturedAt, source, shouldCommit)
        return createdSample
      } catch (error) {
        throw asStorageError(error)
      }
    }
  )

  const saveLabel = inQueue(async (id: string, text: string | null): Promise<DeveloperSample> => {
    if (typeof id !== 'string' || !SAMPLE_ID.test(id)) {
      throw invalidCommand()
    }
    const isValidText =
      text === null || (typeof text === 'string' && text.length <= MAX_LABEL_LENGTH)
    if (!isValidText) {
      throw invalidCommand()
    }
    try {
      await requireEnabled()
      const sample = await readMetadata(id)
      await readSampleImage(sample)
      const updated: DeveloperSample = { ...sample, text }
      await atomicWrite(paths.metadata(id), JSON.stringify(updated))
      return updated
    } catch (error) {
      throw asStorageError(error)
    }
  })

  const setSampleExcluded = inQueue(
    async (id: string, excluded: boolean): Promise<DeveloperSample> => {
      if (typeof id !== 'string' || !SAMPLE_ID.test(id) || typeof excluded !== 'boolean') {
        throw invalidCommand()
      }
      try {
        await requireEnabled()
        const sample = await readMetadata(id)
        await readSampleImage(sample)
        const updated: DeveloperSample = { ...sample, excluded }
        await atomicWrite(paths.metadata(id), JSON.stringify(updated))
        return updated
      } catch (error) {
        throw asStorageError(error)
      }
    }
  )

  const captureFrame = inQueue(async (capturePng: CapturePng): Promise<DeveloperFrame> => {
    if (typeof capturePng !== 'function') {
      throw invalidCommand()
    }
    try {
      await requireEnabled()
      const png = await capturePng()
      let dimensions: PngDimensions
      try {
        dimensions = inspectPng(png, decodePng)
      } catch {
        throw new DeveloperStoreError(DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE)
      }
      const { width, height } = dimensions
      return { pngDataUrl: `data:image/png;base64,${png.toString('base64')}`, width, height }
    } catch (error) {
      throw asStorageError(error)
    }
  })

  return {
    getSettings,
    setEnabled,
    listSamples,
    readImage,
    addSample,
    saveLabel,
    setSampleExcluded,
    addCollectedSample,
    captureFrame
  }
}

export { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS, MAX_LABEL_LENGTH, MAX_PNG_BYTES }
