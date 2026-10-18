// 비공개 엔진 저장소 Release에서 받을 점수 엔진 자산. 경로는 apps/desktop 기준이다.
// 저장소 이름과 토큰은 빌드 환경변수 DFRAGON_SCORE_ENGINE_REPOSITORY, DFRAGON_SCORE_ENGINE_TOKEN으로만 받는다.
// 미발행: Release가 아직 없어 tag와 SHA256은 자리표시자다. Release가 나오면 published를 true로 바꾸고 값을 채운다.
export default {
  published: false,
  tag: 'v0.0.0-unpublished',
  destination: 'resources/score',
  // 키는 `${process.platform}-${process.arch}`이고 file은 main이 찾는 이름(backend/score/engine.ts)이다.
  targets: {
    'win32-x64': {
      asset: 'dnfscore-win32-x64.dll',
      file: 'dnfscore.dll',
      sha256: '0000000000000000000000000000000000000000000000000000000000000000'
    }
  }
}
