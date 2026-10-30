export type UsageScreen = 'party' | 'raid'

export type UsageEvent =
  | Readonly<{ name: 'app_start' }>
  | Readonly<{ name: 'capture' | 'character_search'; screen: UsageScreen }>

export type MeasurementBody = Readonly<{
  client_id: string
  user_properties: Readonly<{ app_version: Readonly<{ value: string }> }>
  events: readonly Readonly<{
    name: UsageEvent['name']
    params: Readonly<{ session_id: string; engagement_time_msec: number; screen?: UsageScreen }>
  }>[]
}>

// GA4는 session_id로 세션을 나누고 engagement_time_msec가 있는 이벤트를 참여한 사용자로 센다.
// 앱은 화면에 머문 시간을 재지 않으므로 최소값을 보낸다.
const ENGAGEMENT_TIME_MSEC = 1

export function createUsageStats({
  clientId,
  appVersion,
  startedAt,
  send,
  onFailure
}: {
  clientId: string
  appVersion: string
  startedAt: number
  send: (body: MeasurementBody) => Promise<void>
  onFailure: (code: 'USAGE_STATS_FAILED') => void
}): { record: (event: UsageEvent) => void } {
  // 앱을 한 번 실행하는 동안을 한 세션으로 센다.
  const sessionId = String(Math.floor(startedAt / 1000))

  function record(event: UsageEvent): void {
    const screen = event.name === 'app_start' ? undefined : event.screen
    send({
      client_id: clientId,
      user_properties: { app_version: { value: appVersion } },
      events: [
        {
          name: event.name,
          params: { session_id: sessionId, engagement_time_msec: ENGAGEMENT_TIME_MSEC, screen }
        }
      ]
    }).catch(() => onFailure('USAGE_STATS_FAILED'))
  }

  return { record }
}
