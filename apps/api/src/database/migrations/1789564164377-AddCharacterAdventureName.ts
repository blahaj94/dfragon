import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCharacterAdventureName1789564164377 implements MigrationInterface {
  readonly name = 'AddCharacterAdventureName1789564164377'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query('ALTER TABLE "characters" ADD "adventure_name" text')
    await queryRunner.query(`
      UPDATE "characters" AS c
      SET "adventure_name" = CASE WHEN jsonb_typeof(r.payload->'adventureName') = 'string'
        THEN NULLIF(r.payload->>'adventureName', '') ELSE NULL END
      FROM "character_api_responses" AS r
      WHERE r.character_id = c.character_id AND r.section = 'basic'
    `)
    await queryRunner.query(
      'CREATE INDEX "idx_characters_adventure_name_character_id" ON "characters"  ("adventure_name", "character_id") '
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query('DROP INDEX "public"."idx_characters_adventure_name_character_id"')
    await queryRunner.query('ALTER TABLE "characters" DROP COLUMN "adventure_name"')
  }
}
