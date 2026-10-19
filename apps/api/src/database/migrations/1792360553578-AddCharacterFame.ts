import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCharacterFame1792360553578 implements MigrationInterface {
  readonly name = 'AddCharacterFame1792360553578'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Character schema migration requires an active transaction')
    }
    await queryRunner.query('ALTER TABLE "characters" ADD "fame" integer')
    // Nested CASE keeps the numeric casts away from non-number JSONB values.
    await queryRunner.query(`
      UPDATE "characters" AS c
      SET "fame" = CASE WHEN jsonb_typeof(r.payload->'fame') = 'number' THEN
        CASE WHEN (r.payload->>'fame')::numeric BETWEEN 0 AND 2147483647
          AND (r.payload->>'fame')::numeric % 1 = 0
        THEN (r.payload->>'fame')::integer END
      END
      FROM "character_api_responses" AS r
      WHERE r.character_id = c.character_id AND r.section = 'basic'
    `)
    await queryRunner.query(
      'CREATE INDEX "idx_characters_fame_character_id" ON "characters" ("fame" DESC, "character_id")'
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Character schema migration requires an active transaction')
    }
    await queryRunner.query('DROP INDEX "public"."idx_characters_fame_character_id"')
    await queryRunner.query('ALTER TABLE "characters" DROP COLUMN "fame"')
  }
}
