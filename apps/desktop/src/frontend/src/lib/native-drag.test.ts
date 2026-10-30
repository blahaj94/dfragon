// @vitest-environment jsdom
import { beforeAll, expect, it } from 'vitest'
import { blockNativeDrag } from './native-drag'

beforeAll(() => blockNativeDrag(document))

function dragStart(target: Node): Event {
  const event = new Event('dragstart', { bubbles: true, cancelable: true })
  target.dispatchEvent(event)

  return event
}

it('글자 선택, 이미지, 링크, 입력의 기본 드래그를 막는다', () => {
  document.body.innerHTML =
    '<p>끌 글자</p><img alt="" src="data:," /><a href="#">링크</a><input value="이름" />'
  const text = document.querySelector('p')!.firstChild!

  expect(dragStart(text).defaultPrevented).toBe(true)
  expect(dragStart(document.querySelector('img')!).defaultPrevented).toBe(true)
  expect(dragStart(document.querySelector('a')!).defaultPrevented).toBe(true)
  expect(dragStart(document.querySelector('input')!).defaultPrevented).toBe(true)
})

it('앱이 draggable="true"로 연 요소의 드래그는 막지 않고, 그 안의 입력을 끄는 드래그는 막는다', () => {
  document.body.innerHTML =
    '<div draggable="true"><input value="이름" /></div><div draggable="false"></div>'
  const [seat, closed] = document.querySelectorAll('div')

  expect(dragStart(seat).defaultPrevented).toBe(false)
  expect(dragStart(seat.querySelector('input')!).defaultPrevented).toBe(true)
  expect(dragStart(closed).defaultPrevented).toBe(true)
})
