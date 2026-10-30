import ky from 'ky'
import type { DesktopChannel } from '../lib/app-channel'
import type { MeasurementBody } from './usage-stats'

const COLLECT_URL = 'https://www.google-analytics.com/mp/collect'

export async function sendMeasurement(
  transport: typeof fetch,
  analytics: NonNullable<DesktopChannel['analytics']>,
  body: MeasurementBody
): Promise<void> {
  const url = new URL(COLLECT_URL)
  url.searchParams.set('measurement_id', analytics.measurementId)
  url.searchParams.set('api_secret', analytics.apiSecret)
  await ky.post(url, {
    fetch: transport,
    json: body,
    retry: 0,
    credentials: 'omit',
    redirect: 'error',
    cache: 'no-store',
    // 언어 header는 사용자 설정 대신 고정값을 보내 이벤트 밖의 정보를 전달하지 않는다.
    headers: { 'Accept-Language': 'en-US' }
  })
}
