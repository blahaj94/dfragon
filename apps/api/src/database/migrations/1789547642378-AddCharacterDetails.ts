import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCharacterDetails1789547642378 implements MigrationInterface {
  readonly name = 'AddCharacterDetails1789547642378'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Character schema migration requires an active transaction')
    }
    await queryRunner.query(
      'CREATE TABLE "characters" ("character_id" text NOT NULL, "server_id" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "ck_characters_id" CHECK (length(btrim("character_id")) > 0), CONSTRAINT "ck_characters_server" CHECK (length(btrim("server_id")) > 0), CONSTRAINT "pk_characters" PRIMARY KEY ("character_id"))'
    )
    await queryRunner.query(
      "CREATE TYPE \"public\".\"character_data_section\" AS ENUM('basic', 'status', 'equipment', 'avatar', 'creature', 'oath', 'mist_assimilation', 'skill_style', 'buff_equipment', 'buff_avatar', 'buff_creature')"
    )
    await queryRunner.query(
      'CREATE TABLE "character_api_responses" ("character_id" text NOT NULL, "section" "public"."character_data_section" NOT NULL, "payload" jsonb NOT NULL, "revision" integer NOT NULL DEFAULT \'1\', "content_updated_at" TIMESTAMP WITH TIME ZONE NOT NULL, "last_successful_fetch_at" TIMESTAMP WITH TIME ZONE NOT NULL, "request_started_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "ck_character_api_responses_payload" CHECK (jsonb_typeof("payload") = \'object\'), CONSTRAINT "ck_character_api_responses_revision" CHECK ("revision" > 0), CONSTRAINT "pk_character_api_responses" PRIMARY KEY ("character_id", "section"))'
    )
    await queryRunner.query(
      'ALTER TABLE "character_api_responses" ADD CONSTRAINT "fk_character_api_responses_character" FOREIGN KEY ("character_id") REFERENCES "characters"("character_id") ON DELETE CASCADE ON UPDATE NO ACTION'
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Character schema migration requires an active transaction')
    }
    await queryRunner.query(
      'ALTER TABLE "character_api_responses" DROP CONSTRAINT "fk_character_api_responses_character"'
    )
    await queryRunner.query('DROP TABLE "character_api_responses"')
    await queryRunner.query('DROP TYPE "public"."character_data_section"')
    await queryRunner.query('DROP TABLE "characters"')
  }
}
