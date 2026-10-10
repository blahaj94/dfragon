import type { unstable_StyleProps as SeedStyleProps } from '@seed-design/react'
import type { ComponentPropsWithRef, ElementType } from 'react'

// 공개 props는 semantic 옵션과 ref를 유지하고 화면별 외형 override prop을 제외한다.
export type PublicProps<T extends ElementType> = Omit<
  ComponentPropsWithRef<T>,
  'style' | 'className' | 'fontWeight' | keyof SeedStyleProps
>
