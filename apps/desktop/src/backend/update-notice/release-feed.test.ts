import { expect, it } from 'vitest'
import { readReleaseFeedTags, releasePageUrl, selectUpdateNotice } from './release-feed'

const RELEASE_PAGE = 'https://github.com/blahaj94/dfragon/releases/tag/'

/** GitHub Release Atom feed와 같은 구조의 문서를 만든다. 항목 순서는 게시 순서다. */
function atomFeed(...links: string[]): string {
  const entries = links.map(
    (href, index) => `  <entry>
    <id>tag:github.com,2008:Repository/1/${index}</id>
    <updated>2026-10-07T18:02:25Z</updated>
    <link rel="alternate" type="text/html" href="${href}"/>
    <title>DFragon ${index}</title>
    <content type="html">&lt;p&gt;&lt;a href=&quot;${RELEASE_PAGE}v99.0.0&quot;&gt;note&lt;/a&gt;&lt;/p&gt;</content>
  </entry>`
  )

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="en-US">
  <id>tag:github.com,2008:https://github.com/blahaj94/dfragon/releases</id>
  <link type="text/html" rel="alternate" href="https://github.com/blahaj94/dfragon/releases"/>
  <title>Release notes from dfragon</title>
${entries.join('\n')}
</feed>`
}

it('feed 항목의 Release 페이지 주소에서 정식, alpha, beta tag만 읽는다', () => {
  const feed = atomFeed(
    `${RELEASE_PAGE}v0.0.3-alpha.2`,
    `${RELEASE_PAGE}v0.0.2`,
    `${RELEASE_PAGE}v0.0.1-beta.8`,
    `${RELEASE_PAGE}v0.0.1-rc.1`,
    `${RELEASE_PAGE}v01.0.0`,
    `${RELEASE_PAGE}v9.0.0/../../evil`,
    `${RELEASE_PAGE}v9.0.0?download=1`,
    'https://github.com/someone/fork/releases/tag/v9.0.0'
  )

  expect(readReleaseFeedTags(feed)).toEqual(['v0.0.3-alpha.2', 'v0.0.2', 'v0.0.1-beta.8'])
})

it('Atom feed가 아닌 응답은 빈 목록과 구분한다', () => {
  expect(readReleaseFeedTags('<!DOCTYPE html><html><body>Sign in</body></html>')).toBeNull()
  expect(readReleaseFeedTags(atomFeed())).toEqual([])
})

it.each([
  {
    name: '정식 버전은 더 높은 alpha, beta가 있어도 정식 버전만 받는다',
    current: '0.0.2',
    tags: ['v0.0.4-alpha.1', 'v0.0.4-beta.1', 'v0.0.3'],
    expected: { tag: 'v0.0.3', endsOcrCollection: false }
  },
  {
    name: '정식 버전은 더 높은 alpha, beta만 있으면 알리지 않는다',
    current: '0.0.2',
    tags: ['v0.0.3-alpha.1', 'v0.0.3-beta.1'],
    expected: null
  },
  {
    name: 'beta는 beta와 정식 가운데 가장 높은 버전을 받는다',
    current: '0.0.1-beta.8',
    tags: ['v0.0.3-alpha.2', 'v0.0.2-beta.1', 'v0.0.2'],
    expected: { tag: 'v0.0.2', endsOcrCollection: false }
  },
  {
    name: 'alpha는 나중에 게시한 낮은 정식 hotfix가 아니라 더 높은 alpha를 받는다',
    current: '0.0.3-alpha.1',
    tags: ['v0.0.2', 'v0.0.3-alpha.2'],
    expected: { tag: 'v0.0.3-alpha.2', endsOcrCollection: false }
  },
  {
    name: 'alpha가 beta로 옮기면 OCR 자료 수집이 꺼진다고 알린다',
    current: '0.0.3-alpha.5',
    tags: ['v0.0.3-alpha.5', 'v0.0.2', 'v0.0.3-beta.1'],
    expected: { tag: 'v0.0.3-beta.1', endsOcrCollection: true }
  },
  {
    name: 'alpha가 정식으로 옮기면 OCR 자료 수집이 꺼진다고 알린다',
    current: '0.0.3-alpha.5',
    tags: ['v0.0.4'],
    expected: { tag: 'v0.0.4', endsOcrCollection: true }
  },
  {
    name: 'prerelease 번호는 문자열 순서가 아니라 숫자로 비교한다',
    current: '0.0.3-alpha.9',
    tags: ['v0.0.3-alpha.10', 'v0.0.3-alpha.8'],
    expected: { tag: 'v0.0.3-alpha.10', endsOcrCollection: false }
  },
  {
    name: '현재보다 높은 버전이 없으면 알리지 않는다',
    current: '0.0.3',
    tags: ['v0.0.3', 'v0.0.3-beta.2', 'v0.0.2'],
    expected: null
  },
  {
    name: '정식, alpha, beta가 아닌 현재 버전은 확인하지 않는다',
    current: '0.0.0-test.4',
    tags: ['v0.0.1'],
    expected: null
  }
])('$name', ({ current, tags, expected }) => {
  expect(selectUpdateNotice(current, tags)).toEqual(expected)
})

it('검증한 tag로만 이 저장소의 Release 페이지 주소를 만든다', () => {
  expect(releasePageUrl('v0.0.3-alpha.2')).toBe(`${RELEASE_PAGE}v0.0.3-alpha.2`)
  for (const tag of [
    '0.0.3',
    'v0.0.3/../../settings',
    'v0.0.3?x=1',
    'v0.0.3#top',
    'v0.0.3-rc.1',
    'https://example.test/',
    ''
  ]) {
    expect(releasePageUrl(tag), tag).toBeNull()
  }
})
