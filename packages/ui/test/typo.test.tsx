import { act, createRef, type MouseEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import { Typo, typographyVariants } from '../src/index'

const typographyCases = [
  { variant: 'h1', tag: 'h1', fontSize: 48, lineHeight: 56, fontWeight: 700 },
  { variant: 'h2', tag: 'h2', fontSize: 40, lineHeight: 48, fontWeight: 700 },
  { variant: 'h3', tag: 'h3', fontSize: 32, lineHeight: 40, fontWeight: 700 },
  { variant: 'h4', tag: 'h4', fontSize: 24, lineHeight: 32, fontWeight: 600 },
  { variant: 'h5', tag: 'h5', fontSize: 20, lineHeight: 28, fontWeight: 600 },
  { variant: 'h6', tag: 'h6', fontSize: 18, lineHeight: 26, fontWeight: 600 },
  { variant: 'txtL', tag: 'p', fontSize: 18, lineHeight: 28, fontWeight: 400 },
  { variant: 'txtM', tag: 'p', fontSize: 16, lineHeight: 24, fontWeight: 400 },
  { variant: 'txtS', tag: 'p', fontSize: 14, lineHeight: 20, fontWeight: 400 },
  { variant: 'caption', tag: 'span', fontSize: 12, lineHeight: 18, fontWeight: 400 }
] as const

it.each(typographyCases)(
  '$variant는 기본 $tag 태그를 쓰고 공개 style과 같은 픽셀 규격을 적용한다',
  ({ variant, tag, fontSize, lineHeight, fontWeight }) => {
    const Component = Typo[variant]
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(
      <>
        <Component>본문</Component>
        <span style={typographyVariants[variant]}>직접 적용한 규격</span>
      </>
    )
    const element = container.firstElementChild as HTMLElement
    const directStyle = container.lastElementChild as HTMLElement

    expect(element.localName).toBe(tag)
    expect(element.textContent).toBe('본문')
    for (const target of [element, directStyle]) {
      expect(target.style.fontSize).toBe(`${fontSize}px`)
      expect(target.style.lineHeight).toBe(`${lineHeight}px`)
      expect(target.style.fontWeight).toBe(String(fontWeight))
    }
    expect(element.style.margin).toBe('0px')
    expect(['', 'inherit']).toContain(element.style.fontFamily)
    expect(['', 'inherit']).toContain(element.style.color)
    expect(element.hasAttribute('role')).toBe(false)
    expect(element.hasAttribute('tabindex')).toBe(false)
  }
)

it('as로 링크 태그를 선택해도 variant를 유지하고 HTML 속성과 표현 옵션을 전달한다', () => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(
    <Typo.h2
      as="a"
      href="/about"
      id="about"
      aria-label="소개 페이지"
      data-purpose="title"
      className="title"
      color="#111"
      align="center"
      weight={500}
    >
      소개
    </Typo.h2>
  )
  const link = container.querySelector('a')!

  expect(link.getAttribute('href')).toBe('/about')
  expect(link.id).toBe('about')
  expect(link.getAttribute('aria-label')).toBe('소개 페이지')
  expect(link.getAttribute('data-purpose')).toBe('title')
  expect(link.className).toBe('title')
  expect(link.textContent).toBe('소개')
  expect(link.style.fontSize).toBe('40px')
  expect(link.style.lineHeight).toBe('48px')
  expect(link.style.fontWeight).toBe('500')
  expect(link.style.color).toBe('rgb(17, 17, 17)')
  expect(link.style.textAlign).toBe('center')
  for (const prop of ['as', 'variant', 'defaultTag', 'color', 'align', 'weight']) {
    expect(link.hasAttribute(prop)).toBe(false)
  }
})

it('style은 variant와 color, align, weight보다 우선하며 추가 CSS 속성도 전달한다', () => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(
    <Typo.txtM
      color="red"
      align="center"
      weight={500}
      style={{
        color: 'blue',
        textAlign: 'right',
        fontWeight: 600,
        fontSize: 20,
        lineHeight: 1.5,
        fontFamily: 'serif',
        margin: 8,
        padding: 4
      }}
    >
      직접 꾸민 본문
    </Typo.txtM>
  )
  const paragraph = container.querySelector('p')!

  expect(paragraph.style.color).toBe('blue')
  expect(paragraph.style.textAlign).toBe('right')
  expect(paragraph.style.fontWeight).toBe('600')
  expect(paragraph.style.fontSize).toBe('20px')
  expect(paragraph.style.lineHeight).toBe('1.5')
  expect(paragraph.style.fontFamily).toBe('serif')
  expect(paragraph.style.margin).toBe('8px')
  expect(paragraph.style.padding).toBe('4px')
})

it('활성 button은 실제 태그의 click을 전달하고 disabled로 바뀌면 클릭을 차단한다', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement('div')
  const root = createRoot(container)
  const targets: HTMLButtonElement[] = []
  const onClick = vi.fn((event: MouseEvent<HTMLButtonElement>) => {
    targets.push(event.currentTarget)
  })

  try {
    await act(async () => {
      root.render(
        <Typo.txtM as="button" type="button" onClick={onClick}>
          실행
        </Typo.txtM>
      )
    })
    const button = container.querySelector('button')!
    expect(button.type).toBe('button')
    expect(button.disabled).toBe(false)
    await act(async () => button.click())
    expect(onClick).toHaveBeenCalledOnce()
    expect(targets).toEqual([button])

    await act(async () => {
      root.render(
        <Typo.txtM as="button" type="button" disabled onClick={onClick}>
          실행
        </Typo.txtM>
      )
    })
    expect(button.disabled).toBe(true)
    await act(async () => button.click())
    expect(onClick).toHaveBeenCalledOnce()
    expect(targets).toEqual([button])
  } finally {
    await act(async () => root.unmount())
  }
})

it('기본 heading과 as로 고른 input의 ref로 focus하고 unmount에서 ref를 해제한다', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const heading = createRef<HTMLHeadingElement>()
  const input = createRef<HTMLInputElement>()
  try {
    await act(async () => {
      root.render(
        <>
          <Typo.h4 ref={heading} tabIndex={-1}>
            라이선스
          </Typo.h4>
          <Typo.txtM as="input" ref={input} aria-label="이름" />
        </>
      )
    })
    expect(heading.current).toBe(container.querySelector('h4'))
    expect(input.current).toBe(container.querySelector('input'))
    heading.current?.focus()
    expect(document.activeElement).toBe(heading.current)
    input.current?.focus()
    expect(document.activeElement).toBe(input.current)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
  expect(heading.current).toBeNull()
  expect(input.current).toBeNull()
})

it('as를 button에서 링크로 바꾸면 기존 ref를 해제하고 새 태그와 ref에 variant를 유지한다', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement('div')
  const root = createRoot(container)
  const button = createRef<HTMLButtonElement>()
  const anchor = createRef<HTMLAnchorElement>()
  try {
    await act(async () => {
      root.render(
        <Typo.txtS as="button" ref={button} disabled>
          다음
        </Typo.txtS>
      )
    })
    expect(button.current).toBe(container.querySelector('button'))
    expect(button.current?.disabled).toBe(true)

    await act(async () => {
      root.render(
        <Typo.txtS as="a" ref={anchor} href="/next">
          다음
        </Typo.txtS>
      )
    })
    expect(container.querySelector('button')).toBeNull()
    expect(button.current).toBeNull()
    expect(anchor.current).toBe(container.querySelector('a'))
    expect(anchor.current?.getAttribute('href')).toBe('/next')
    expect(anchor.current?.hasAttribute('disabled')).toBe(false)
    expect(anchor.current?.style.fontSize).toBe('14px')
    expect(anchor.current?.style.lineHeight).toBe('20px')
    expect(anchor.current?.style.fontWeight).toBe('400')
  } finally {
    await act(async () => root.unmount())
  }
  expect(anchor.current).toBeNull()
})
