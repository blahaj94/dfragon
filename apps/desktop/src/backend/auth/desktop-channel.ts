/** 로그인을 켜는 채널의 인증 환경, 복귀 주소, provider. */
export type DesktopChannelAuth = Readonly<{
  environment: string
  returnTarget: string
  providers: readonly string[]
}>

/** 채널 빌드가 main bundle에 넣는 공개 tuple. 빌드 시 channels.json과 빌드 변수에서 만든다. */
export type DesktopChannel = Readonly<{
  name: string
  identity: Readonly<{ appIdentity: string; auth?: DesktopChannelAuth }>
  origins: Readonly<{ api: string; accounts?: string }>
}>
