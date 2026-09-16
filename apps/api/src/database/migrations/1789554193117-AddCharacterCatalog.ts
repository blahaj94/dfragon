import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddCharacterCatalog1789554193117 implements MigrationInterface {
  readonly name = 'AddCharacterCatalog1789554193117'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Catalog Migration requires an active transaction')
    }
    await queryRunner.query(
      'CREATE TABLE "item_catalog" ("item_id" text NOT NULL, "payload" jsonb NOT NULL, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "request_started_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "ck_item_catalog_id" CHECK (length("item_id") BETWEEN 1 AND 256 AND "item_id" ~ \'^[a-zA-Z0-9_-]+$\'), CONSTRAINT "ck_item_catalog_payload" CHECK (jsonb_typeof("payload") = \'object\'), CONSTRAINT "pk_item_catalog" PRIMARY KEY ("item_id"))'
    )
    await queryRunner.query(
      'CREATE TABLE "skill_catalog" ("job_id" text NOT NULL, "skill_id" text NOT NULL, "payload" jsonb NOT NULL, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "request_started_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "ck_skill_catalog_ids" CHECK (length("job_id") BETWEEN 1 AND 256 AND "job_id" ~ \'^[a-zA-Z0-9_-]+$\' AND length("skill_id") BETWEEN 1 AND 256 AND "skill_id" ~ \'^[a-zA-Z0-9_-]+$\'), CONSTRAINT "ck_skill_catalog_payload" CHECK (jsonb_typeof("payload") = \'object\'), CONSTRAINT "pk_skill_catalog" PRIMARY KEY ("job_id", "skill_id"))'
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Catalog Migration requires an active transaction')
    }
    await queryRunner.query('DROP TABLE "skill_catalog"')
    await queryRunner.query('DROP TABLE "item_catalog"')
  }
}
