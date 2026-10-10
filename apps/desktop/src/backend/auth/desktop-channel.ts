/** 로그인을 켜는 채널의 인증 환경, provider. */
export type DesktopChannelAuth = Readonly<{
  environment: string
  // OS protocol ingress 제거 전까지 빌드 tuple의 기존 값만 유지한다.
  returnTarget?: string
  providers: readonly string[]
}>

/** 채널 빌드가 main bundle에 넣는 공개 tuple. 빌드 시 channels.json과 빌드 변수에서 만든다. */
export type DesktopChannel = Readonly<{
  name: string
  identity: Readonly<{ appIdentity: string; auth?: DesktopChannelAuth }>
  origins: Readonly<{ api: string; accounts?: string }>
}>
