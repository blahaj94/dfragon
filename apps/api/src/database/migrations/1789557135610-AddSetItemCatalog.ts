import type { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSetItemCatalog1789557135610 implements MigrationInterface {
  readonly name = 'AddSetItemCatalog1789557135610'

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query(
      'CREATE TABLE "set_item_catalog" ("set_item_id" text NOT NULL, "payload" jsonb NOT NULL, "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "request_started_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "ck_set_item_catalog_id" CHECK (length("set_item_id") BETWEEN 1 AND 256 AND "set_item_id" ~ \'^[a-zA-Z0-9_-]+$\'), CONSTRAINT "ck_set_item_catalog_payload" CHECK (jsonb_typeof("payload") = \'object\'), CONSTRAINT "pk_set_item_catalog" PRIMARY KEY ("set_item_id"))'
    )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!queryRunner.isTransactionActive) {
      throw new Error('Auth schema Migration requires an active transaction')
    }
    await queryRunner.query('DROP TABLE "set_item_catalog"')
  }
}
