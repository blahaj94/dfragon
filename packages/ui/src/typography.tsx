import {
  createElement,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type JSX,
  type ReactNode
} from 'react'

export const typographyVariants = {
  h1: { fontSize: 48, lineHeight: 56, fontWeight: 700 },
  h2: { fontSize: 40, lineHeight: 48, fontWeight: 700 },
  h3: { fontSize: 32, lineHeight: 40, fontWeight: 700 },
  h4: { fontSize: 24, lineHeight: 32, fontWeight: 600 },
  h5: { fontSize: 20, lineHeight: 28, fontWeight: 600 },
  h6: { fontSize: 18, lineHeight: 26, fontWeight: 600 },
  txtL: { fontSize: 18, lineHeight: 28, fontWeight: 400 },
  txtM: { fontSize: 16, lineHeight: 24, fontWeight: 400 },
  txtS: { fontSize: 14, lineHeight: 20, fontWeight: 400 },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: 400 }
} as const

export type TypographyVariant = keyof typeof typographyVariants
export type TypographyTag = Extract<keyof JSX.IntrinsicElements, keyof HTMLElementTagNameMap>

type TypographyOwnProps<Tag extends TypographyTag> = {
  children?: ReactNode
  className?: string
  style?: CSSProperties
  as?: Tag
  color?: CSSProperties['color']
  align?: CSSProperties['textAlign']
  weight?: CSSProperties['fontWeight']
}

export type TypographyProps<Tag extends TypographyTag = 'p'> = TypographyOwnProps<Tag> &
  Omit<ComponentPropsWithoutRef<NoInfer<Tag>>, keyof TypographyOwnProps<Tag>>

type TypographyBaseProps<Tag extends TypographyTag> = TypographyProps<Tag> & {
  variant: TypographyVariant
  defaultTag: TypographyTag
}

function TypographyBase<Tag extends TypographyTag>({
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
}: TypographyBaseProps<Tag>) {
  const { fontSize, lineHeight, fontWeight } = typographyVariants[variant]

  return createElement(
    as ?? defaultTag,
    {
      ...htmlProps,
      className,
      style: {
        margin: 0,
        fontSize,
        // React treats a numeric lineHeight as a multiplier, so keep the spec in px.
        lineHeight: `${lineHeight}px`,
        fontWeight: weight ?? fontWeight,
        color,
        textAlign: align,
        ...style
      }
    },
    children
  )
}

function createTypography<DefaultTag extends TypographyTag>(
  variant: TypographyVariant,
  defaultTag: DefaultTag
) {
  return function TypographyVariantComponent<Tag extends TypographyTag = DefaultTag>(
    props: TypographyProps<Tag>
  ) {
    return <TypographyBase<Tag> {...props} variant={variant} defaultTag={defaultTag} />
  }
}

export const Typography = {
  h1: createTypography('h1', 'h1'),
  h2: createTypography('h2', 'h2'),
  h3: createTypography('h3', 'h3'),
  h4: createTypography('h4', 'h4'),
  h5: createTypography('h5', 'h5'),
  h6: createTypography('h6', 'h6'),
  txtL: createTypography('txtL', 'p'),
  txtM: createTypography('txtM', 'p'),
  txtS: createTypography('txtS', 'p'),
  caption: createTypography('caption', 'span')
} as const
