# 보안 패치

`extract-zip@2.0.1.patch`는 [GHSA-jmr9-qjv8-65gv](https://github.com/advisories/GHSA-jmr9-qjv8-65gv)와 [GHSA-7pqw-9j4j-h8q3](https://github.com/advisories/GHSA-7pqw-9j4j-h8q3)를 처리한다. 2026-09-30 기준 npm의 최신 버전은 2.0.1이며 수정 릴리스가 없다. Electron의 설치 의존성에도 같은 pnpm 패치를 적용한다.

- ZIP symlink의 대상이 추출 디렉터리 밖을 가리키면 거절한다. 기존 symlink를 따라간 실제 경로와 가장 가까운 기존 조상도 확인하므로, 외부로 이어지는 끊어진 링크나 `pivot/../file`처럼 symlink 뒤의 상위 경로 이동으로 검사를 우회할 수 없다.
- 부모 디렉터리를 한 단계씩 생성·확인해 기존 symlink를 통한 외부 디렉터리 생성도 막는다.
- 일반 파일이 기존 symlink를 덮어쓰지 못하게 하고, 지원 플랫폼에서는 `O_NOFOLLOW`도 적용한다.
- Electron macOS framework처럼 추출 디렉터리 내부를 가리키는 symlink와 일반 파일 덮어쓰기는 유지한다. 아직 추출되지 않은 내부 파일을 가리키는 forward link와 그 연결도 허용하며, 아직 없는 경로 뒤의 `..`는 후속 링크가 해석을 바꿀 수 있어 거절한다. 이미 존재하는 부모에서 `..`로 이동한 뒤의 내부 forward link는 허용하며, 끊어진 링크를 따라 확인하는 과정은 40회로 제한한다.

`pnpm test:security-dependencies`가 실제 패키지의 ZIP 추출을 검증하며 Code Quality CI에도 포함된다. 패치를 없애거나 갱신할 때 두 advisory와 이 회귀 검증을 함께 확인한다. `pnpm audit`는 패치 내용을 분석하지 않아 해당 버전의 두 경고를 계속 표시한다. 경고를 숨기는 audit 예외는 추가하지 않는다.
