// 점수 엔진 바이너리는 @dfragon/models 패키지(packages/models)의 score-engine submodule이 고정한 커밋에서 읽는다.
// 비공개 저장소라 기본 checkout에서 빠지며(.gitmodules의 update = none) 권한이 있으면 따로 받는다(packages/models/README.md).
// 경로는 apps/desktop 기준이다.
export default {
  destination: 'resources/score',
  // 키는 `${process.platform}-${process.arch}`이고 값은 submodule과 main(backend/score/engine.ts)이 쓰는 같은 파일 이름이다.
  // 패키지는 Windows만 만들고, darwin-arm64는 Mac 개발 실행에서 같은 명령으로 엔진을 두기 위해 있다.
  targets: {
    'win32-x64': 'dnfscore.dll',
    'darwin-arm64': 'libdnfscore.dylib'
  }
}
