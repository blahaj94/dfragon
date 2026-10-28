// 비공개 저장소라 기본 checkout에서 빠지며(.gitmodules의 update = none) 권한이 있으면 따로 받는다(packages/models/README.md).
export default {
  destination: 'resources/score',
  targets: {
    'win32-x64': 'dnfscore.dll',
    'darwin-arm64': 'libdnfscore.dylib'
  }
}
