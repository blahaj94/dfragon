<img src="assets/brand/dfragon.png" width="96" height="96" alt="DFRAGON" />

# DFRAGON

공사중

## 서버 이미지

[Product Images](.github/workflows/product-images.yml)는 PR에서 `api`, `ocr`, `accounts`의
이미지를 빌드만 합니다. 기존 Code Quality는 앱 테스트·정적 검사를 담당하며,
main push의 Code Quality가 성공하면 그 실행의 `head_sha`를 그대로 빌드·발행합니다.
후속 실행 때의 최신 main을 다시 선택하지 않습니다.

이미지는 `ghcr.io/blahaj94/dfragon/{api,ocr,accounts}:<40자리 commit SHA>`로 발행하고
OCI `source`·`revision` label에 저장소와 commit을 기록합니다. 대상 플랫폼은
[기존 운영 기준](deploy/api/README.md)의 `linux/amd64` 하나입니다.
테스트 실패는 Code Quality, 이미지 빌드 실패는 `Build image`, 인증·발행·digest 확인
실패는 각각 `Authenticate to GHCR`·`Publish the built image`·`Verify the registry digest`에서 확인합니다.
세 이미지 빌드가 모두 성공해야 발행 job이 시작됩니다.

인프라에서는 성공한 발행 실행의 summary 또는 `image-handoff-api`, `image-handoff-ocr`,
`image-handoff-accounts` artifact 안의 JSON을 사용합니다. 각 파일은 다음 형식이며
`image`는 registry에서 조회·확인한 digest reference입니다. 세 파일의 `sourceCommit`이
같은 실행을 선택합니다. Tag는 조회 편의용이고 배포 입력은 `image@sha256:digest`입니다.

```json
{
  "service": "api",
  "image": "ghcr.io/blahaj94/dfragon/api@sha256:<registry-digest>",
  "sourceCommit": "<40-character-commit-sha>"
}
```

빌드 job은 `contents: read`, 발행 job은 `packages: write`만 사용합니다.
발행 job은 같은 실행의 이미지 archive를 받아 source·플랫폼을 확인하고 push하며,
앱 코드를 checkout하거나 실행하지 않습니다. 운영 secret·SSH·Tailscale 접근은 없습니다.
GHCR의 공개 범위·접근 정책은 workflow가 변경하지 않습니다. 인프라의 pull 인증은
기존 package 접근 정책에 맞춰 별도로 준비해야 합니다.

제품은 이미지·Dockerfile·실행 진입점·schema/migration을 소유합니다. 이미지 선택과
배포·운영·복구는 인프라 책임입니다. 기존 Deploy Linux와 서버 빌드는 전환 전까지 유지하며,
이 workflow는 운영 서버나 인프라 저장소를 호출하지 않습니다.
실행 입력·포트·readiness·유지보수 명령은 [API](deploy/api/README.md#이미지-실행-계약),
[accounts](deploy/accounts/README.md#이미지-실행-계약), [OCR](apps/ocr/README.md#이미지-실행-계약)을 따릅니다.
