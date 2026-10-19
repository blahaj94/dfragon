// 비공개 엔진 저장소 Release에서 받을 점수 엔진 자산. 경로는 apps/desktop 기준이다.
// 저장소 이름과 토큰은 빌드 환경변수 DFRAGON_SCORE_ENGINE_REPOSITORY, DFRAGON_SCORE_ENGINE_TOKEN으로만 받는다.
// SHA256은 같은 Release의 `<asset>.sha256` 파일 값이다. 엔진을 바꾸면 tag, 자산 이름과 함께 고친다.
export default {
  published: true,
  tag: 'native-v0.1.0',
  destination: 'resources/score',
  // 키는 `${process.platform}-${process.arch}`이고 file은 main이 찾는 이름(backend/score/engine.ts)이다.
  // 패키지는 Windows만 만들고, darwin-arm64는 Mac 개발 실행에서 같은 명령으로 엔진을 받기 위해 둔다.
  targets: {
    'win32-x64': {
      asset: 'dnfscore-0.1.0-win-x64.dll',
      file: 'dnfscore.dll',
      sha256: '7932899b87cc400a980fe589a36e979082c1a9c5fb4f9f9e54598ffaa685fd92'
    },
    'darwin-arm64': {
      asset: 'libdnfscore-0.1.0-darwin-arm64.dylib',
      file: 'libdnfscore.dylib',
      sha256: '7df7668d7ad5adab214b74cc14780cd45a2740585005752c174261a684c66e3c'
    }
  }
}
