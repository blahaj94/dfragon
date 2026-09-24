#!/usr/bin/env bash
set -euo pipefail

# Focused deployment check. Only this invocation's synthetic DB/volume is removed.
dfragon_checkout=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)
dfragon_test_dir=$(mktemp -d)
dfragon_test_project="dfragon-check-$(date +%s)-$$"
export DFRAGON_IMAGE_TAG="$dfragon_test_project"
export DFRAGON_DATABASE_VOLUME_NAME="${dfragon_test_project}-database"
export DFRAGON_SECRETS_DIR="$dfragon_test_dir/secrets"
export DFRAGON_API_PORT=0
mkdir -m 700 "$DFRAGON_SECRETS_DIR"
dfragon_compose=(docker compose --project-name "$dfragon_test_project" -f "$dfragon_checkout/deploy/api/compose.yaml")
cleanup() {
    dfragon_result=$?
    trap - EXIT
    "${dfragon_compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || dfragon_result=1
    rm -rf -- "$dfragon_test_dir"
    exit "$dfragon_result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"${dfragon_compose[@]}" config --quiet
"${dfragon_compose[@]}" build api
docker run --rm --network none --user "$(id -u):$(id -g)" --cap-drop ALL --security-opt no-new-privileges \
    --entrypoint node -i \
    --mount "type=bind,src=$DFRAGON_SECRETS_DIR,dst=/fixtures" \
    --mount "type=bind,src=$dfragon_checkout/apps/api/test-support,dst=/app/test-support,readonly" \
    "dfragon-api:$DFRAGON_IMAGE_TAG" --input-type=module <<'JS'
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { authenticationConfiguration } from './test-support/runtime-fixtures.mjs'
for (const name of ['postgres_password', 'ldb_migrator_password', 'ldb_api_password', 'neople_api_key']) {
  writeFileSync(`/fixtures/${name}`, randomBytes(32).toString('base64url'), { mode: 0o444 })
}
writeFileSync('/fixtures/auth_config.json', JSON.stringify(authenticationConfiguration()), { mode: 0o444 })
JS

"${dfragon_compose[@]}" up -d --wait --wait-timeout 120 database
"${dfragon_compose[@]}" run --rm migrate
"${dfragon_compose[@]}" exec -T database psql --no-psqlrc -U postgres -d ldb -f /opt/dfragon/grant-api.sql
"${dfragon_compose[@]}" run --rm migrate
"${dfragon_compose[@]}" up -d api
dfragon_api_container=$("${dfragon_compose[@]}" ps -q api)
dfragon_database_container=$("${dfragon_compose[@]}" ps -q database)

docker inspect "$dfragon_api_container" "$dfragon_database_container" | python3 -c '
import json,sys
api,db=json.load(sys.stdin)
assert api["Config"]["User"] == "1000:1000"
assert api["HostConfig"]["ReadonlyRootfs"]
assert "ALL" in api["HostConfig"]["CapDrop"]
assert any(x.startswith("no-new-privileges") for x in api["HostConfig"]["SecurityOpt"])
assert api["HostConfig"]["PortBindings"]["3000/tcp"][0]["HostIp"] == "127.0.0.1"
assert not db["HostConfig"].get("PortBindings")
assert db["Config"]["User"] == "postgres"
assert len(db["NetworkSettings"]["Networks"]) == 1
'

"${dfragon_compose[@]}" exec -T api node --input-type=module <<'JS'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import pg from 'pg'
assert.equal(process.getuid(), 1000)
assert.throws(() => writeFileSync('/app/write-probe', ''), { code: 'EROFS' })
for (const path of ['/app/src', '/app/test-support', '/run/secrets/postgres_password', '/run/secrets/ldb_migrator_password']) {
  assert.equal(existsSync(path), false)
}
const db = new pg.Client({ host: 'database', database: 'ldb', user: 'ldb_api', password: readFileSync('/run/secrets/db_password', 'utf8') })
try {
  await db.connect()
  for (const table of ['users', 'auth_sessions', 'auth_refresh_tokens', 'auth_login_requests', 'characters', 'character_api_responses']) {
    await db.query(`SELECT count(*) FROM ${table}`)
    for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      assert.equal((await db.query('SELECT has_table_privilege(current_user, $1, $2) AS allowed', [table, privilege])).rows[0].allowed, true, `${table}: ${privilege}`)
    }
  }
  await assert.rejects(db.query('CREATE TABLE denied_probe (id integer)'), { code: '42501' })
  await assert.rejects(db.query('SELECT * FROM typeorm_migrations'), { code: '42501' })
  await assert.rejects(db.query('SET ROLE ldb_migrator'), { code: '42501' })
} finally {
  await db.end()
}
let response
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    response = await fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(1000) })
    break
  } catch {
    await setTimeout(200)
  }
}
assert.equal(response?.status, 404)
assert.equal((await fetch('http://127.0.0.1:3000/me')).status, 401)
console.log('PASS: compiled API, non-root/read-only runtime, mounted secrets and database privileges')
JS

"${dfragon_compose[@]}" run --rm cleanup
"${dfragon_compose[@]}" stop api
test "$(docker inspect --format '{{.State.ExitCode}}' "$dfragon_api_container")" = 0
"${dfragon_compose[@]}" up -d --wait --wait-timeout 120 --force-recreate database
"${dfragon_compose[@]}" exec -T database psql --no-psqlrc -U postgres -d ldb -Atqc \
    'SELECT count(*) FROM typeorm_migrations' | python3 -c 'import sys; assert int(sys.stdin.read()) > 0'
printf 'PASS: explicit migration/re-run, cleanup, graceful stop and database persistence\n'
