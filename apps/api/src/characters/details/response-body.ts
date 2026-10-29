import { promisify } from 'node:util'
import { brotliCompress, constants } from 'node:zlib'

const compressBrotli = promisify(brotliCompress)

export interface CharacterDetailBody {
  readonly json: Buffer
  brotli: Buffer | undefined
}

// Express `json` serializes with plain JSON.stringify unless the app sets a replacer, spaces or escape, and this app sets none.
export function serializeCharacterDetail(detail: object): CharacterDetailBody {
  return { json: Buffer.from(JSON.stringify(detail)), brotli: undefined }
}

// zlib runs brotliCompress on the libuv thread pool, so quality 11 (about 100ms for a 150KB body) never blocks requests.
export function prepareBrotli(body: CharacterDetailBody): void {
  compressBrotli(body.json, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).then(
    (compressed) => {
      body.brotli = compressed
    },
    () => {
      // A failed compression only means the body keeps going out uncompressed.
    }
  )
}
