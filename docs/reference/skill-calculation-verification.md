---
type: reference
scope: opt-in API skill package verification
last-reviewed: 2026-10-04
---

# 비공개 스킬 패키지 검증

`apps/api`의 `verify:skills`는 GitHub Packages에 게시된 `@blahaj94/dfragon-skills`를
별도 설치 디렉터리에서 읽고, 실제 캐릭터의 스킬 계수, 쿨타임을 계산하는 선택 실행 명령입니다.
현재 `weapon_master`만 지원하며 규칙의 직업, 전직 ID와 캐릭터의 직업, 전직 ID를 정확히 비교합니다.
각성 단계의 호환 관계를 직업 이름으로 추정하지 않습니다.

## 설치와 실행

패키지 읽기 권한이 있는 인증을 별도 npm 설정에서 준비한 뒤, workspace 밖의 절대 경로에
검증할 버전을 설치합니다. 인증값과 실제 캐릭터 정보는 저장소, 문서, PR에 기록하지 않습니다.
GitHub Packages 인증 설정은 [공식 안내](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)를 따릅니다.
별도 npm 설정에서는 `@blahaj94:registry=https://npm.pkg.github.com`으로 scope만 지정하고,
`ajv` 등 일반 의존성이 설치되도록 기본 registry는 npmjs로 유지합니다.

```sh
npm install --prefix /absolute/path/to/skill-package --save-exact \
  @blahaj94/dfragon-skills@0.1.0

NEOPLE_API_KEY_FILE=/absolute/path/to/neople-key \
  pnpm --filter @dfragon/api verify:skills \
  --server siroco --character '<캐릭터명>' --profile weapon_master \
  --package-directory /absolute/path/to/skill-package
```

`--package-directory`는 패키지 소스 경로가 아니라 `npm install --prefix`로 사용한 디렉터리입니다.
Node 24와 기존 workspace 의존성이 필요합니다. 명령은 먼저 API를 빌드하며, 이미 빌드했다면
`pnpm --filter @dfragon/api exec node --import reflect-metadata test-support/verify-skill-calculation.mjs`에 같은 인자를
전달할 수 있습니다. `NEOPLE_API_KEY` 직접 입력도 지원하나 `_FILE`과 동시에 지정하면 실패합니다.
PORT, DB 설정, HTTP 서버, DB 연결은 사용하지 않습니다.

정규 dependency와 lockfile에 비공개 패키지를 추가하지 않습니다. 기존 공개 CI와 Docker build에는
패키지 권한이나 secret이 필요하지 않으며, 일반 `test`에는 합성 입력을 사용하는 회귀 검사만 포함됩니다.

## 입력과 결과의 의미

- 기존 Neople 검색, 11개 상세, 스킬 카탈로그 adapter를 재사용합니다. 검색, 상세의 5초 제한,
  스킬 상세의 요청별 5초 제한과 공유 호출 예산을 유지합니다. 필요한 모든 스킬 상세를 최대 3개씩,
  전체 10초 이내에 조회하며 실패를 재시도하지 않습니다. DB에 저장하지 않습니다.
- active, passive의 API 레벨을 `selectedLevel`로 전달합니다. 무기의 극의 등 패시브 효과는
  패키지가 순서대로 적용하며 결과의 `effectiveLevel`을 함께 표시합니다.
- evolution의 type은 `vp`, enhancement의 type은 `up`에 전달합니다. 미지원 선택, 범위 밖 레벨,
  필수 목록 누락은 실패합니다. 프로필 밖 일반 스킬은 `excluded`에 명시합니다.
- 모드는 API 자료로 추정하지 않고 패키지의 무기별 기본 모드를 사용합니다. 스킬 체인 선택은
  반영하지 않으며 이 한계를 결과에 표시합니다.
- JSON 요약에는 패키지 버전, 캐릭터 확인값, 계산, 보류, 비공격, 미습득, 제외 개수와 습득 스킬별
  계수, 쿨타임, 경고를 담습니다. 보류는 0으로 바꾸지 않습니다. 실패는 고정 코드, 문구와 종료 코드 1이며
  API 원문, key, URL, stack을 출력하지 않습니다.

이 검증은 실제 API 입력을 패키지에 연결하는 범위입니다. 장비, 스탯, 대상 방어를 합산한 데미지,
최적 모드, 인게임 실측과의 일치를 보장하지 않습니다. 캐릭터 상세와 여러 스킬 API 호출이 같은 순간의
snapshot이라는 보장도 없습니다.
장비의 스킬 레벨, 스탯, 추가 쿨타임 감소, 특수 무기 보정은 별도로 입력하지 않으며,
API가 보고한 스킬 레벨과 장착 무기 종류를 사용합니다. 특수 무기 분류, 보정은 현재 패키지의
공개 계산 입력에서 지정할 수 없습니다.

합성 입력 변환, 실패, 동시성 검사는 API `test`에 포함됩니다. 이미 빌드된 상태에서는 다음 명령으로
해당 범위만 확인할 수 있습니다.

```sh
node --test apps/api/test-support/skill-calculation.test.mjs
```

## 저장된 입력과 실측의 오프라인 비교

`verify-skill-measurement.mjs`는 저장된 스킬 상세로 다시 계산하고, 기준 스킬 한 개의 실측으로
공통 배율을 구해 다른 스킬의 실측과 비교합니다. Neople 호출, credential, DB를 사용하지 않습니다.
API build 후 다음 명령을 사용합니다. 세 경로는 모두 절대 경로입니다.

```sh
pnpm --filter @dfragon/api exec node --import reflect-metadata \
  test-support/verify-skill-measurement.mjs \
  --package-directory /absolute/path/to/skill-package \
  --snapshot /absolute/path/to/snapshot.json \
  --observations /absolute/path/to/observations.json
```

Snapshot은 `details.character`의 `jobId`, `jobGrowId`, `details.equipment.equipment`,
`details.skillStyle.style`, `details.status.status`와 `catalog`를 갖습니다. `catalog`에는 패키지가
요구하는 모든 스킬의 `{key: {kind: "skill", jobId, skillId}, payload}`가 있어야 합니다.
캐릭터 이름, ID는 필요하지 않습니다. Snapshot과 실측 원문은 저장소 밖에서 보관합니다.

아래 관측 예시는 **합성 값**입니다. 실제 입력에는 패키지의 정확한 스킬 ID와 확인한 값을 사용합니다.
두 측정의 `contextId`와 `targetLevel`은 공통 `context`와 일치해야 하며, 서로 다른 대상 레벨에서
측정한 결과를 섞으면 실패합니다. 장비, 버프, 도핑, 치명타, 전체 명중 조건의 동일성은 사용자가
확인해 `conditions`에 적습니다. 이 입력만으로 환경이 같았다는 사실을 자동 검증하지 않습니다.
`context.id`, `conditions`, `source`는 로컬 결과에 표시되므로 개인정보, 비밀값, 개인 파일 경로를 넣지 않습니다.

```json
{
  "context": {
    "id": "synthetic-session",
    "target": { "kind": "sandbag", "level": 110 },
    "conditions": ["동일한 합성 장비", "전체 명중", "도핑 없음"],
    "status": [{ "name": "힘", "value": 2000 }]
  },
  "levelOverrides": [
    { "skillId": "reference-id", "level": 2, "source": "합성 인게임 관측" },
    { "skillId": "comparison-id", "level": 3, "source": "합성 인게임 관측" },
    { "skillId": "passive-id", "level": 8, "source": "합성 장비 레벨 보정" }
  ],
  "reference": {
    "skillId": "reference-id", "level": 2,
    "contextId": "synthetic-session", "targetLevel": 110,
    "damage": 100, "multiplier": { "value": 1, "source": "추가 보정 없음" }
  },
  "comparison": {
    "skillId": "comparison-id", "level": 3,
    "contextId": "synthetic-session", "targetLevel": 110,
    "damage": 330, "multiplier": { "value": 1.5, "source": "합성 장비의 해당 스킬 증가" }
  }
}
```

`reference.level`, `comparison.level`은 인게임 표시 레벨이며 패키지 결과의 `effectiveLevel`과
비교합니다. `levelOverrides[].level`은 패키지에 전달할 **selectedLevel**입니다. 다른 패시브가
가산하는 레벨은 중복 입력하지 않고 출처에 환산 근거를 적습니다. 결과에는 API 원래 레벨,
입력한 레벨, 패키지가 계산한 최종 레벨과 출처를 함께 표시합니다. `context.status`의 이름은
snapshot 상태명과 정확히 일치해야 하며, 원래 상태값과 관측값을 나란히 표시할 뿐 산식에 재곱하지 않습니다.

계산은 `보정값 = 기준 실측 / (기준 effectiveCoefficient × 기준 개별 배율)`,
`비교 예측 = 비교 effectiveCoefficient × 비교 개별 배율 × 보정값` 순서입니다.
비교 스킬 실측은 오차 계산에만 사용합니다. 오차율은 `(예측 − 실측) / 실측 × 100`이며,
음수는 예측이 실측보다 작다는 뜻입니다. `panelMultiplier`는 이미 계수에 포함되어 다시 곱하지 않습니다.
칭호 등 스킬별 추가 배율은 `multiplier`로 한 번 적용하며, 패키지에 이미 포함된 증가를 중복 입력하면 안 됩니다.

이 방법은 동일 환경의 공통 배율을 실측으로 흡수합니다. 절대 데미지 공식, 전체 장비 효과, 대상 방어를
재현한 검증이 아닙니다. 현재 맹룡 개화의 추가 회오리와 모델 타수의 대응은 확인되지 않았고,
감전 피해는 별도로 포함하지 않습니다. 패키지의 연구 모델, 보류 경고를 유지합니다.

기존 입력 변환과 오프라인 비교 회귀 검사는 다음 명령으로 확인합니다.

```sh
node --test apps/api/test-support/skill-calculation.test.mjs \
  apps/api/test-support/skill-measurement.test.mjs
```
