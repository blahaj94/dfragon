import {
  createElement,
  type ComponentPropsWithRef,
  type CSSProperties,
  type JSX,
  type ReactNode
} from 'react'

export const typographyVariants = {
  h1: { fontSize: 48, lineHeight: '56px', fontWeight: 700 },
  h2: { fontSize: 40, lineHeight: '48px', fontWeight: 700 },
  h3: { fontSize: 32, lineHeight: '40px', fontWeight: 700 },
  h4: { fontSize: 24, lineHeight: '32px', fontWeight: 600 },
  h5: { fontSize: 20, lineHeight: '28px', fontWeight: 600 },
  h6: { fontSize: 18, lineHeight: '26px', fontWeight: 600 },
  txtL: { fontSize: 18, lineHeight: '28px', fontWeight: 400 },
  txtM: { fontSize: 16, lineHeight: '24px', fontWeight: 400 },
  txtS: { fontSize: 14, lineHeight: '20px', fontWeight: 400 },
  caption: { fontSize: 12, lineHeight: '18px', fontWeight: 400 }
} as const

export type TypoVariant = keyof typeof typographyVariants
export type TypoTag = Extract<keyof JSX.IntrinsicElements, keyof HTMLElementTagNameMap>

type TypoOwnProps<Tag extends TypoTag> = {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  as?: Tag
  color?: CSSProperties['color']
  align?: CSSProperties['textAlign']
  weight?: CSSProperties['fontWeight']
}

export type TypoProps<Tag extends TypoTag = 'p'> = TypoOwnProps<Tag> &
  Omit<ComponentPropsWithRef<NoInfer<Tag>>, keyof TypoOwnProps<Tag>>

type TypoBaseProps<Tag extends TypoTag> = TypoProps<Tag> & {
  variant: TypoVariant
  defaultTag: TypoTag
}

function TypoBase<Tag extends TypoTag>({
  variant,
  defaultTag,
  as,
  children,
  className,
  style,
  color,
  align,
  weight,
  ...htmlProps
}: TypoBaseProps<Tag>) {
  const { fontSize, lineHeight, fontWeight } = typographyVariants[variant]

  return createElement(
    as ?? defaultTag,
    {
      ...htmlProps,
      className,
      style: {
        margin: 0,
        fontSize,
        lineHeight,
        fontWeight: weight ?? fontWeight,
        color,
        textAlign: align,
        ...style
      }
    },
    children
  )
}

function createTypo<DefaultTag extends TypoTag>(variant: TypoVariant, defaultTag: DefaultTag) {
  return function TypoVariantComponent<Tag extends TypoTag = DefaultTag>(props: TypoProps<Tag>) {
    return <TypoBase<Tag> {...props} variant={variant} defaultTag={defaultTag} />
  }
}

export const Typo = {
  h1: createTypo('h1', 'h1'),
  h2: createTypo('h2', 'h2'),
  h3: createTypo('h3', 'h3'),
  h4: createTypo('h4', 'h4'),
  h5: createTypo('h5', 'h5'),
  h6: createTypo('h6', 'h6'),
  txtL: createTypo('txtL', 'p'),
  txtM: createTypo('txtM', 'p'),
  txtS: createTypo('txtS', 'p'),
  caption: createTypo('caption', 'span')
} as const
