import type { DataSource } from 'typeorm'

interface StoredAdventureName {
  character_id: string
  adventure_name: string
}

/**
 * 후보 응답에 붙일 모험단명을 우리 DB에 저장된 값에서 찾는다. 상세 조회로 저장된 적 없는 캐릭터는 결과에
 * 없으며, Neople을 호출하지 않는다.
 */
export function createCharacterAdventureNameStore(source: DataSource) {
  return {
    async find(
      characterIds: readonly string[],
      signal: AbortSignal
    ): Promise<ReadonlyMap<string, string>> {
      if (characterIds.length === 0) {
        return new Map()
      }

      return source.transaction('READ COMMITTED', async (manager) => {
        signal.throwIfAborted()
        await manager.query("SET LOCAL statement_timeout = '2s'")
        signal.throwIfAborted()
        const rows = (await manager.query(
          `SELECT character_id, adventure_name FROM characters
           WHERE character_id = ANY($1) AND adventure_name IS NOT NULL`,
          [characterIds]
        )) as StoredAdventureName[]
        signal.throwIfAborted()

        return new Map(rows.map((row) => [row.character_id, row.adventure_name]))
      })
    }
  }
}
