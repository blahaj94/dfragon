import ipaddr from 'ipaddr.js'

/** 요청 제한에 사용할 키를 만든다. IPv4 표기를 통일하고 IPv6는 같은 /64를 묶는다. */
export function getIpQuotaKey(peerAddress: string): string {
  try {
    const address = ipaddr.process(peerAddress)
    return address.kind() === 'ipv6'
      ? `ipv6:${address.toByteArray().slice(0, 8).join('.')}`
      : address.toString()
  } catch {
    // 잘못된 주소를 그대로 키로 쓰면 임의 문자열마다 새 요청 한도를 만들 수 있다.
    return 'unknown'
  }
}
