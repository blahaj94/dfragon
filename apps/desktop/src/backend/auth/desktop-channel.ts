/** 채널 빌드가 main bundle에 넣는 공개 tuple. 빌드 시 channels.json과 빌드 변수에서 만든다. */
export type DesktopChannel = Readonly<{
  name: string
  identity: Readonly<{
    appIdentity: string
    environment: string
    returnTarget: string
    providers: readonly string[]
  }>
  origins: Readonly<{ api: string; accounts: string }>
}>
