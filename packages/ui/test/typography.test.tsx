import { act, type MouseEvent } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, expectTypeOf, it, vi } from 'vitest'
import { Typography } from '../src/index'

it('uses semantic defaults and pixel dimensions for each variant', () => {
  const cases = [
    ['h1', 'h1', 48, 56, 700],
    ['h2', 'h2', 40, 48, 700],
    ['h3', 'h3', 32, 40, 700],
    ['h4', 'h4', 24, 32, 600],
    ['h5', 'h5', 20, 28, 600],
    ['h6', 'h6', 18, 26, 600],
    ['txtL', 'p', 18, 28, 400],
    ['txtM', 'p', 16, 24, 400],
    ['txtS', 'p', 14, 20, 400],
    ['caption', 'span', 12, 18, 400]
  ] as const

  for (const [variant, tag, fontSize, lineHeight, fontWeight] of cases) {
    const Component = Typography[variant]
    const container = document.createElement('div')
    container.innerHTML = renderToStaticMarkup(<Component>Text</Component>)
    const element = container.firstElementChild as HTMLElement

    expect(element.localName).toBe(tag)
    expect(element.textContent).toBe('Text')
    expect(element.style.fontSize).toBe(`${fontSize}px`)
    expect(element.style.lineHeight).toBe(`${lineHeight}px`)
    expect(element.style.fontWeight).toBe(String(fontWeight))
    expect(element.style.margin).toBe('0px')
  }
})

it('changes only the tag with as and forwards attributes and appearance overrides', () => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(
    <Typography.h2
      as="a"
      href="/about"
      id="about"
      aria-label="About page"
      className="title"
      color="#111"
      align="center"
      weight={500}
    >
      About
    </Typography.h2>
  )
  const link = container.querySelector('a')!

  expect(link.getAttribute('href')).toBe('/about')
  expect(link.id).toBe('about')
  expect(link.getAttribute('aria-label')).toBe('About page')
  expect(link.className).toBe('title')
  expect(link.style.fontSize).toBe('40px')
  expect(link.style.lineHeight).toBe('48px')
  expect(link.style.fontWeight).toBe('500')
  expect(link.style.color).toBe('rgb(17, 17, 17)')
  expect(link.style.textAlign).toBe('center')
  for (const prop of ['as', 'variant', 'defaultTag', 'color', 'align', 'weight']) {
    expect(link.hasAttribute(prop)).toBe(false)
  }
})

it('lets style take precedence over variants and convenience props', () => {
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(
    <Typography.txtM
      color="red"
      align="center"
      weight={500}
      style={{ color: 'blue', textAlign: 'right', fontWeight: 600, fontSize: 20, margin: 8 }}
    >
      Styled text
    </Typography.txtM>
  )
  const paragraph = container.querySelector('p')!

  expect(paragraph.style.color).toBe('blue')
  expect(paragraph.style.textAlign).toBe('right')
  expect(paragraph.style.fontWeight).toBe('600')
  expect(paragraph.style.fontSize).toBe('20px')
  expect(paragraph.style.margin).toBe('8px')
})

it('forwards native button events and disabled behavior', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const container = document.createElement('div')
  const root = createRoot(container)
  const onClick = vi.fn()

  try {
    await act(async () => {
      root.render(
        <Typography.txtM as="button" onClick={onClick}>
          Run
        </Typography.txtM>
      )
    })
    const button = container.querySelector('button')!
    await act(async () => button.click())
    expect(onClick).toHaveBeenCalledOnce()

    await act(async () => {
      root.render(
        <Typography.txtM as="button" disabled onClick={onClick}>
          Run
        </Typography.txtM>
      )
    })
    await act(async () => button.click())
    expect(onClick).toHaveBeenCalledOnce()
  } finally {
    await act(async () => root.unmount())
  }
})

it('infers attributes and event targets from as and rejects mismatched attributes', () => {
  const examples = (
    <>
      <Typography.h1
        as="a"
        href="/about"
        onClick={(event) => {
          expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLAnchorElement>>()
        }}
      >
        About
      </Typography.h1>
      <Typography.txtM
        as="button"
        disabled
        onClick={(event) => {
          expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLButtonElement>>()
        }}
      >
        Run
      </Typography.txtM>
      <Typography.h1
        onClick={(event) => {
          expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLHeadingElement>>()
        }}
      >
        Heading
      </Typography.h1>
      <Typography.txtM as="label" htmlFor="name">
        Name
      </Typography.txtM>
      {/* @ts-expect-error Default heading does not accept href. */}
      <Typography.h1 href="/about">Invalid</Typography.h1>
      {/* @ts-expect-error A button does not accept href. */}
      <Typography.txtM as="button" href="/about">
        Invalid
      </Typography.txtM>
      {/* @ts-expect-error An anchor does not accept disabled. */}
      <Typography.h1 as="a" disabled>
        Invalid
      </Typography.h1>
      {/* @ts-expect-error as must be an HTML tag. */}
      <Typography.h1 as="invalid-tag">Invalid</Typography.h1>
    </>
  )

  expect(examples).toBeDefined()
})
