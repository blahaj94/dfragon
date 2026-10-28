import { createBuilderConfig } from './build/electron-builder-config'

// 이름을 `.test.ts`로 끝내면 Vitest는 테스트로 수집하고 Biome는 테스트 코드 규칙을 적용하므로 `test-channel`로 둔다.
export default createBuilderConfig('test')
