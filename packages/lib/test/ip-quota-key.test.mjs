import assert from 'node:assert/strict'
import test from 'node:test'
import { getIpQuotaKey } from '@dfragon/lib/utils/ip-quota-key'

test('IPv4 addresses keep separate quota keys', () => {
  assert.equal(getIpQuotaKey('192.0.2.128'), '192.0.2.128')
  assert.equal(getIpQuotaKey('192.0.2.129'), '192.0.2.129')
})

test('IPv4 and its IPv4-mapped IPv6 spellings share a quota key', () => {
  const ipv4Key = getIpQuotaKey('192.0.2.128')

  for (const address of ['::ffff:192.0.2.128', '::ffff:c000:280', '0:0:0:0:0:ffff:c000:0280']) {
    assert.equal(getIpQuotaKey(address), ipv4Key, address)
  }
})

test('compressed and expanded IPv6 spellings share a quota key', () => {
  const expectedKey = 'ipv6:32.1.13.184.171.205.18.52'

  for (const address of [
    '2001:db8:abcd:1234::1',
    '2001:0db8:abcd:1234:0000:0000:0000:0001',
    '2001:DB8:ABCD:1234::1'
  ]) {
    assert.equal(getIpQuotaKey(address), expectedKey, address)
  }
})

test('IPv6 quotas group the first 64 bits and separate different prefixes', () => {
  const prefixKey = getIpQuotaKey('2001:db8:abcd:1234::1')

  assert.equal(getIpQuotaKey('2001:db8:abcd:1234:ffff:ffff:ffff:ffff'), prefixKey)
  assert.equal(getIpQuotaKey('2001:db8:abcd:1235::1'), 'ipv6:32.1.13.184.171.205.18.53')
  assert.notEqual(getIpQuotaKey('2001:db8:abcd:1235::1'), prefixKey)
})

test('IPv6 zone identifiers cannot create separate quota keys', () => {
  const addressKey = getIpQuotaKey('fe80::1234')

  assert.equal(addressKey, 'ipv6:254.128.0.0.0.0.0.0')
  for (const address of ['fe80::1234%eth0', 'fe80::1234%eth1', 'fe80::1234%1']) {
    assert.equal(getIpQuotaKey(address), addressKey, address)
  }
})

test('empty and invalid addresses share one unknown quota key', () => {
  for (const address of [
    '',
    'unknown',
    'client-a',
    'client-b',
    '192.0.2.128:443',
    'https://example.com'
  ]) {
    assert.equal(getIpQuotaKey(address), 'unknown', JSON.stringify(address))
  }
})
