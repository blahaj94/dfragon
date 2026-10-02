import assert from 'node:assert/strict'
import test from 'node:test'
import { getIpQuotaKey } from '@dfragon/lib/utils/ip-quota-key'

const TITLES = {
  ipv4: 'IPv4 주소는 끝점에서도 원래 주소별로 다른 요청 제한 키를 유지한다',
  mappedIpv4: 'IPv4와 IPv4-mapped IPv6의 여러 표기는 같은 IPv4 키를 사용한다',
  ipv6Spellings: '축약·확장·대문자 IPv6 표기는 같은 요청 제한 키를 사용한다',
  ipv6Prefixes: 'IPv6의 앞 64비트를 묶고 서로 다른 /64는 구분한다',
  prefixByteBoundaries: 'IPv6 앞 8바이트의 각 경계값을 보존하고 뒤 8바이트는 키에 넣지 않는다',
  notMappedIpv4: 'IPv4를 담은 일반 IPv6와 NAT64 주소를 IPv4-mapped 주소로 오인하지 않는다',
  zones: 'IPv6 zone identifier를 바꿔도 별도 요청 제한 키를 만들지 않는다',
  invalidAddresses: '빈 값·주소가 아닌 문자열·잘못된 주소는 모두 unknown 키를 공유한다'
}

test(TITLES.ipv4, () => {
  for (const address of ['0.0.0.0', '192.0.2.128', '192.0.2.129', '255.255.255.255']) {
    assert.equal(getIpQuotaKey(address), address)
  }
})

test(TITLES.mappedIpv4, () => {
  const cases = [
    {
      key: '0.0.0.0',
      addresses: ['::ffff:0.0.0.0', '::ffff:0:0', '0:0:0:0:0:ffff:0000:0000']
    },
    {
      key: '192.0.2.128',
      addresses: ['::ffff:192.0.2.128', '::ffff:c000:280', '0:0:0:0:0:ffff:c000:0280']
    },
    {
      key: '203.0.113.255',
      addresses: ['::ffff:203.0.113.255', '::ffff:cb00:71ff']
    },
    {
      key: '255.255.255.255',
      addresses: ['::ffff:255.255.255.255', '::ffff:ffff:ffff', '0:0:0:0:0:ffff:ffff:ffff']
    }
  ]

  for (const { key, addresses } of cases) {
    assert.equal(getIpQuotaKey(key), key)
    for (const address of addresses) {
      assert.equal(getIpQuotaKey(address), key, address)
    }
  }
})

test(TITLES.ipv6Spellings, () => {
  const expectedKey = 'ipv6:32.1.13.184.171.205.18.52'

  for (const address of [
    '2001:db8:abcd:1234::1',
    '2001:0db8:abcd:1234:0000:0000:0000:0001',
    '2001:DB8:ABCD:1234::1'
  ]) {
    assert.equal(getIpQuotaKey(address), expectedKey, address)
  }
})

test(TITLES.ipv6Prefixes, () => {
  const prefixKey = getIpQuotaKey('2001:db8:abcd:1234::1')

  assert.equal(getIpQuotaKey('2001:db8:abcd:1234:ffff:ffff:ffff:ffff'), prefixKey)
  assert.equal(getIpQuotaKey('2001:db8:abcd:1235::1'), 'ipv6:32.1.13.184.171.205.18.53')
  assert.notEqual(getIpQuotaKey('2001:db8:abcd:1235::1'), prefixKey)
})

test(TITLES.prefixByteBoundaries, () => {
  const basePrefixBytes = [32, 1, 13, 184, 171, 205, 18, 52]

  for (let index = 0; index < basePrefixBytes.length; index++) {
    for (const byte of [0, 255]) {
      const prefixBytes = [...basePrefixBytes]
      prefixBytes[index] = byte
      const prefixGroups = []
      for (let offset = 0; offset < prefixBytes.length; offset += 2) {
        prefixGroups.push((prefixBytes[offset] * 256 + prefixBytes[offset + 1]).toString(16))
      }
      const prefix = prefixGroups.join(':')
      const expectedKey = `ipv6:${prefixBytes.join('.')}`
      for (const suffix of ['0:0:0:1', 'ffff:ffff:ffff:ffff']) {
        const address = `${prefix}:${suffix}`
        assert.equal(getIpQuotaKey(address), expectedKey, address)
      }
    }
  }
})

test(TITLES.notMappedIpv4, () => {
  assert.equal(getIpQuotaKey('::c000:280'), 'ipv6:0.0.0.0.0.0.0.0')
  assert.equal(getIpQuotaKey('64:ff9b::192.0.2.128'), 'ipv6:0.100.255.155.0.0.0.0')
  assert.equal(getIpQuotaKey('::ffff:192.0.2.128'), '192.0.2.128')
})

test(TITLES.zones, () => {
  const addressKey = getIpQuotaKey('fe80::1234')

  assert.equal(addressKey, 'ipv6:254.128.0.0.0.0.0.0')
  for (const address of ['fe80::1234%eth0', 'fe80::1234%eth1', 'fe80::1234%1']) {
    assert.equal(getIpQuotaKey(address), addressKey, address)
  }
})

test(TITLES.invalidAddresses, () => {
  for (const address of [
    '',
    'unknown',
    'client-a',
    'client-b',
    '192.0.2.128:443',
    'https://example.com',
    '192.0.2.256',
    '-1.0.0.1',
    '192.0.2.1/24',
    ' 192.0.2.1',
    '192.0.2.1 ',
    '192.0.2.1, 198.51.100.1',
    '2001:db8:::1',
    '2001:db8::1/64',
    '[2001:db8::1]',
    '[2001:db8::1]:443',
    '1:2:3:4:5:6:7:8:9'
  ]) {
    assert.equal(getIpQuotaKey(address), 'unknown', JSON.stringify(address))
  }
})
