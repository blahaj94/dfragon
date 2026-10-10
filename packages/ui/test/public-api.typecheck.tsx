// 이 파일은 Vitest runtime 사례가 아니다. package의 tsc --noEmit이 JSX 사용과
// expectTypeOf, @ts-expect-error를 검사하며 test/examples도 같은 입력에 포함한다.
import {
  createRef,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type Ref
} from 'react'
import { expectTypeOf } from 'vitest'
import {
  ActionButton,
  ContentStack,
  DialogAction,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogRoot,
  DialogTrigger,
  ExampleSection,
  IconButton,
  LayoutBlock,
  ProgressCircle,
  StatusBadge,
  SupportingText,
  TextField,
  TextFieldInput,
  Typo,
  typographyVariants,
  type ActionButtonProps,
  type DialogActionProps,
  type DialogBodyProps,
  type DialogContentProps,
  type DialogFooterProps,
  type DialogRootProps,
  type DialogTriggerProps,
  type IconButtonProps,
  type ProgressCircleProps,
  type StatusBadgeProps,
  type StatusBadgeTone,
  type TextFieldInputProps,
  type TextFieldProps,
  type TypoProps
} from '@dfragon/ui'

// 공개 Snippet props는 semantic 옵션과 native ref를 보존하고 외형 override를 노출하지 않는다.
type SnippetPropKeys =
  | keyof ActionButtonProps
  | keyof ProgressCircleProps
  | keyof TextFieldProps
  | keyof TextFieldInputProps
  | keyof DialogRootProps
  | keyof DialogTriggerProps
  | keyof DialogContentProps
  | keyof DialogBodyProps
  | keyof DialogFooterProps
  | keyof DialogActionProps

type AppearanceOverrides =
  | 'style'
  | 'className'
  | 'color'
  | 'fontWeight'
  | 'bleed'
  | 'paddingX'
  | 'width'
  | 'maxWidth'
  | 'layerIndex'

expectTypeOf<Extract<SnippetPropKeys, AppearanceOverrides>>().toEqualTypeOf<never>()
expectTypeOf<ActionButtonProps['ref']>().toEqualTypeOf<Ref<HTMLButtonElement> | undefined>()
expectTypeOf<ProgressCircleProps['ref']>().toEqualTypeOf<Ref<SVGSVGElement> | undefined>()
expectTypeOf<TextFieldProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>()
expectTypeOf<TextFieldProps['fieldRef']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>()
expectTypeOf<TextFieldInputProps['ref']>().toEqualTypeOf<Ref<HTMLInputElement> | undefined>()
expectTypeOf<DialogTriggerProps['ref']>().toEqualTypeOf<Ref<HTMLButtonElement> | undefined>()
expectTypeOf<DialogContentProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>()
expectTypeOf<DialogBodyProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>()
expectTypeOf<DialogFooterProps['ref']>().toEqualTypeOf<Ref<HTMLDivElement> | undefined>()
expectTypeOf<DialogActionProps['ref']>().toEqualTypeOf<Ref<HTMLButtonElement> | undefined>()
expectTypeOf<DialogRootProps>().not.toHaveProperty('ref')

// 디자인 컴포넌트도 SEED 변수로 외형을 소유하고 화면별 외형 override를 노출하지 않는다.
type DesignPropKeys = keyof IconButtonProps | keyof StatusBadgeProps
expectTypeOf<
  Extract<DesignPropKeys, AppearanceOverrides | 'size' | 'layout'>
>().toEqualTypeOf<never>()
expectTypeOf<IconButtonProps['ref']>().toEqualTypeOf<Ref<HTMLButtonElement> | undefined>()
expectTypeOf<IconButtonProps['variant']>().toEqualTypeOf<'neutralWeak' | 'ghost'>()
expectTypeOf<StatusBadgeTone>().toEqualTypeOf<
  'neutral' | 'informative' | 'critical' | 'warning' | 'positive'
>()

const buttonRef = createRef<HTMLButtonElement>()
const inputRef = createRef<HTMLInputElement>()
const divRef = createRef<HTMLDivElement>()
const svgRef = createRef<SVGSVGElement>()
const headingRef = createRef<HTMLHeadingElement>()
const paragraphRef = createRef<HTMLParagraphElement>()
const captionRef = createRef<HTMLSpanElement>()
const anchorRef = createRef<HTMLAnchorElement>()

// 실제 공개 컴포넌트 사용으로 semantic props, 이벤트 target과 ref의 연결을 검사한다.
export const snippetExamples = (
  <LayoutBlock header="공개 API 예시" footer="예시 끝">
    <ContentStack>
      <ExampleSection title="작업 상태">
        <ActionButton
          ref={buttonRef}
          type="button"
          variant="neutralOutline"
          size="medium"
          layout="withText"
          loading
          disabled
          aria-label="작업 실행"
          onClick={(event) => {
            expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLButtonElement>>()
          }}
        >
          실행
        </ActionButton>
        <ProgressCircle ref={svgRef} value={50} size="24" tone="brand" aria-label="진행률" />
        <TextField
          ref={divRef}
          fieldRef={divRef}
          label="표시 이름"
          description="예시 이름입니다."
          errorMessage="이름을 입력하세요."
          invalid
          required
          readOnly
          value="예시"
          maxGraphemeCount={8}
          onValueChange={(details) => {
            expectTypeOf(details.value).toEqualTypeOf<string>()
          }}
        >
          <TextFieldInput
            ref={inputRef}
            name="displayName"
            placeholder="이름 입력"
            autoComplete="off"
            onChange={(event) => {
              expectTypeOf(event).toEqualTypeOf<ChangeEvent<HTMLInputElement>>()
            }}
          />
        </TextField>
        <DialogRoot
          open
          closeOnInteractOutside={false}
          onOpenChange={(open, details) => {
            expectTypeOf(open).toEqualTypeOf<boolean>()
            expectTypeOf(details?.reason).toExtend<string | undefined>()
          }}
        >
          <DialogTrigger asChild ref={buttonRef}>
            <ActionButton>상세 열기</ActionButton>
          </DialogTrigger>
          <DialogContent
            ref={divRef}
            title={<span>작업 상세</span>}
            description="진행 상태를 확인하세요."
            showCloseButton={false}
            onKeyDown={(event) => {
              expectTypeOf(event).toEqualTypeOf<KeyboardEvent<HTMLDivElement>>()
            }}
          >
            <DialogBody ref={divRef}>
              <SupportingText>본문</SupportingText>
            </DialogBody>
            <DialogFooter ref={divRef}>
              <DialogAction ref={buttonRef} variant="neutralSolid" disabled>
                확인
              </DialogAction>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>
      </ExampleSection>
    </ContentStack>
  </LayoutBlock>
)

export const designExamples = (
  <>
    <IconButton
      ref={buttonRef}
      variant="ghost"
      aria-label="설정"
      aria-haspopup="dialog"
      icon={<svg aria-hidden="true" />}
      disabled
      onClick={(event) => {
        expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLButtonElement>>()
      }}
    />
    <DialogRoot>
      <DialogTrigger asChild>
        <IconButton
          variant="neutralWeak"
          aria-label="화면 캡처"
          icon={<svg aria-hidden="true" />}
        />
      </DialogTrigger>
    </DialogRoot>
    <StatusBadge tone="positive" role="status">
      창 감지됨
    </StatusBadge>
  </>
)

export const invalidDesignExamples = (
  <>
    {/* @ts-expect-error 아이콘만 보이는 IconButton은 접근 가능한 이름을 요구한다. */}
    <IconButton variant="ghost" icon={<svg aria-hidden="true" />} />
    {/* @ts-expect-error IconButton variant는 디자인의 neutralWeak, ghost 중 하나여야 한다. */}
    <IconButton variant="brandSolid" aria-label="설정" icon={<svg aria-hidden="true" />} />
    {/* @ts-expect-error IconButton의 임의 className은 공개 prop이 아니다. */}
    <IconButton className="square" variant="ghost" aria-label="설정" icon={<svg />} />
    {/* @ts-expect-error StatusBadge tone은 디자인 상태 tone 중 하나여야 한다. */}
    <StatusBadge tone="brand">상태</StatusBadge>
  </>
)

// Typo는 Snippet과 달리 명시된 style/className/표현 옵션을 허용한다.
expectTypeOf<TypoProps<'a'>['ref']>().toEqualTypeOf<Ref<HTMLAnchorElement> | undefined>()
expectTypeOf<TypoProps<'input'>['ref']>().toEqualTypeOf<Ref<HTMLInputElement> | undefined>()
expectTypeOf<TypoProps['ref']>().toEqualTypeOf<Ref<HTMLParagraphElement> | undefined>()
expectTypeOf<typeof typographyVariants.h1>().toExtend<CSSProperties>()

export const typographyExamples = (
  <>
    <Typo.h1 ref={headingRef}>제목 1</Typo.h1>
    <Typo.h2 ref={headingRef}>제목 2</Typo.h2>
    <Typo.h3 ref={headingRef}>제목 3</Typo.h3>
    <Typo.h4 ref={headingRef}>제목 4</Typo.h4>
    <Typo.h5 ref={headingRef}>제목 5</Typo.h5>
    <Typo.h6 ref={headingRef}>제목 6</Typo.h6>
    <Typo.txtL ref={paragraphRef}>큰 본문</Typo.txtL>
    <Typo.txtM
      ref={paragraphRef}
      className="description"
      style={{ margin: 8, display: 'block' }}
      color="blue"
      align="center"
      weight={500}
      onClick={(event) => {
        expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLParagraphElement>>()
      }}
    >
      본문
    </Typo.txtM>
    <Typo.txtS ref={paragraphRef}>작은 본문</Typo.txtS>
    <Typo.caption ref={captionRef}>설명</Typo.caption>
    <Typo.h1
      as="a"
      ref={anchorRef}
      href="/about"
      target="_blank"
      onClick={(event) => {
        expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLAnchorElement>>()
      }}
    >
      소개
    </Typo.h1>
    <Typo.txtM
      as="button"
      ref={buttonRef}
      type="button"
      disabled
      onClick={(event) => {
        expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLButtonElement>>()
      }}
    >
      실행
    </Typo.txtM>
    <Typo.txtM
      as="input"
      ref={inputRef}
      type="search"
      defaultValue="예시"
      onChange={(event) => {
        expectTypeOf(event).toEqualTypeOf<ChangeEvent<HTMLInputElement>>()
      }}
    />
    <Typo.txtM as="label" htmlFor="name">
      이름
    </Typo.txtM>
    <Typo.h1
      onClick={(event) => {
        expectTypeOf(event).toEqualTypeOf<MouseEvent<HTMLHeadingElement>>()
      }}
    >
      기본 제목
    </Typo.h1>
  </>
)

// 오류 지시자는 실제 거부가 사라지면 tsc의 unused @ts-expect-error로 실패한다.
export const invalidSnippetExamples = (
  <>
    {/* @ts-expect-error ActionButton의 임의 inline style은 공개 prop이 아니다. */}
    <ActionButton style={{ padding: 8 }}>실행</ActionButton>
    {/* @ts-expect-error variant는 공식 semantic 옵션 중 하나여야 한다. */}
    <ActionButton variant="invalid">실행</ActionButton>
    {/* @ts-expect-error TextField의 임의 className은 공개 prop이 아니다. */}
    <TextField className="field" />
    {/* @ts-expect-error TextFieldInput의 임의 color는 공개 prop이 아니다. */}
    <TextFieldInput color="red" />
    {/* @ts-expect-error ProgressCircle의 ref는 SVG element를 가리킨다. */}
    <ProgressCircle ref={inputRef} />
    {/* @ts-expect-error TextFieldInput의 ref는 input element를 가리킨다. */}
    <TextFieldInput ref={buttonRef} />
    {/* @ts-expect-error DialogTrigger의 ref는 button element를 가리킨다. */}
    <DialogTrigger ref={inputRef}>열기</DialogTrigger>
    {/* @ts-expect-error DialogContent의 width override는 공개 prop이 아니다. */}
    <DialogContent width="400px" title="상세" />
    {/* @ts-expect-error DialogContent의 layerIndex는 공개 prop이 아니다. */}
    <DialogContent layerIndex={2} title="상세" />
    {/* @ts-expect-error DialogBody의 paddingX는 공개 prop이 아니다. */}
    <DialogBody paddingX="x8">본문</DialogBody>
    {/* @ts-expect-error DialogFooter의 className은 공개 prop이 아니다. */}
    <DialogFooter className="footer">확인</DialogFooter>
    {/* @ts-expect-error DialogAction의 fontWeight는 공개 prop이 아니다. */}
    <DialogAction fontWeight="medium">확인</DialogAction>
    {/* @ts-expect-error ExampleSection은 제목을 요구한다. */}
    <ExampleSection>본문</ExampleSection>
    {/* @ts-expect-error SupportingText는 children만 받는다. */}
    <SupportingText color="red">설명</SupportingText>
  </>
)

export const invalidTypographyExamples = (
  <>
    {/* @ts-expect-error 기본 heading의 href로 as 태그를 추론하지 않는다. */}
    <Typo.h1 href="/about">잘못된 제목</Typo.h1>
    {/* @ts-expect-error 기본 본문의 htmlFor로 as 태그를 추론하지 않는다. */}
    <Typo.txtM htmlFor="name">잘못된 본문</Typo.txtM>
    {/* @ts-expect-error button은 href를 받지 않는다. */}
    <Typo.txtM as="button" href="/about">
      잘못된 버튼
    </Typo.txtM>
    {/* @ts-expect-error 링크는 disabled를 받지 않는다. */}
    <Typo.h1 as="a" disabled>
      잘못된 링크
    </Typo.h1>
    {/* @ts-expect-error as는 유효한 HTML 태그여야 한다. */}
    <Typo.h1 as="invalid-tag">잘못된 태그</Typo.h1>
    {/* @ts-expect-error SVG 태그는 HTML as 계약에 포함되지 않는다. */}
    <Typo.caption as="svg">잘못된 SVG</Typo.caption>
    {/* @ts-expect-error as는 custom component가 아닌 HTML 태그를 받는다. */}
    <Typo.h1 as={ActionButton}>잘못된 custom component</Typo.h1>
    {/* @ts-expect-error input ref는 링크를 가리킬 수 없다. */}
    <Typo.txtM as="a" ref={inputRef}>
      잘못된 ref
    </Typo.txtM>
    {/* @ts-expect-error SVG ref로 기본 heading의 태그를 추론하지 않는다. */}
    <Typo.h1 ref={svgRef}>잘못된 heading ref</Typo.h1>
    {/* @ts-expect-error variant는 각 공개 컴포넌트가 결정하는 내부 prop이다. */}
    <Typo.txtM variant="h1">잘못된 variant</Typo.txtM>
  </>
)
