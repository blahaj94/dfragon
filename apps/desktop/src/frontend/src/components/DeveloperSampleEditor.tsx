import { useEffect, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, TextField, TextFieldInput, Typo } from '@dfragon/ui'
import type { DeveloperWorkbenchSample } from '../lib/developer-party'
import { styles } from './DeveloperSampleEditor.style'
import { DEVELOPER_COLLECTION_LABELS } from '../constants/developer'

export function DeveloperSampleEditor({
  sample,
  number,
  draft,
  saving,
  onDraft,
  onSaveAndNext,
  onSkip,
  onSetExcluded
}: {
  sample: DeveloperWorkbenchSample
  number: number
  draft: string
  saving: boolean
  onDraft: (value: string) => void
  onSaveAndNext: () => void
  onSkip: () => void
  onSetExcluded: (excluded: boolean) => void
}): React.JSX.Element {
  const [retry, setRetry] = useState(0)
  const [imageResult, setImageResult] = useState<
    | { sampleId: string; retry: number; status: 'loaded'; dataUrl: string }
    | { sampleId: string; retry: number; status: 'failed' }
    | null
  >(null)

  useEffect(() => {
    let current = true
    void window.developer
      .readImage(sample.id)
      .then((data) => {
        if (current) {
          setImageResult({ sampleId: sample.id, retry, status: 'loaded', dataUrl: data })
        }
      })
      .catch(() => {
        if (current) {
          setImageResult({ sampleId: sample.id, retry, status: 'failed' })
        }
      })
    return () => {
      current = false
    }
  }, [sample.id, retry])

  const isCurrentImageResult = imageResult?.sampleId === sample.id && imageResult.retry === retry
  const image = isCurrentImageResult && imageResult.status === 'loaded' ? imageResult.dataUrl : ''
  const failed = isCurrentImageResult && imageResult.status === 'failed'

  const readOnly = sample.remote != null
  const source = sample.source
  const capturedAt = new Date(sample.createdAt)
  const capturedAtText = Number.isNaN(capturedAt.valueOf())
    ? ''
    : capturedAt.toLocaleString('ko-KR')

  return (
    <div {...stylex.props(styles.editor)}>
      <Typo.h4 as="h2">
        이미지 {number}
        {source
          ? source.kind === 'raid'
            ? ` · 공대원창 ${source.slot}행 크롭`
            : ` · ${source.slot}번 크롭`
          : ' · 기존 이미지'}
      </Typo.h4>
      <Typo.caption {...stylex.props(styles.muted)}>
        {[capturedAtText, `${sample.width} × ${sample.height}px`].filter(Boolean).join(' · ')}
      </Typo.caption>
      <div {...stylex.props(styles.imageArea)}>
        {image ? (
          <img src={image} alt="선택한 저장 크롭" {...stylex.props(styles.image)} />
        ) : (
          <Typo.txtS>
            {failed ? '이미지를 읽지 못했습니다.' : '이미지를 불러오는 중입니다.'}
          </Typo.txtS>
        )}
      </div>
      {failed && (
        <ActionButton
          size="small"
          variant="ghost"
          onClick={() => {
            setRetry((value) => value + 1)
          }}
        >
          이미지 다시 읽기
        </ActionButton>
      )}
      {source && (
        <Typo.caption {...stylex.props(styles.muted)}>
          원본 {source.frameWidth} × {source.frameHeight}px
          {Number.isFinite(source.scale) ? ` · 감지 배율 ${source.scale.toFixed(2)}×` : ''}
        </Typo.caption>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!readOnly && !saving && draft.length > 0) {
            onSaveAndNext()
          }
        }}
      >
        <TextField
          label={
            <Typo.txtS as="span" weight={700}>
              정답 닉네임
            </Typo.txtS>
          }
        >
          <TextFieldInput
            value={draft}
            maxLength={500}
            disabled={saving}
            readOnly={readOnly}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.nativeEvent.isComposing) {
                event.preventDefault()
              }
            }}
            autoComplete="off"
          />
        </TextField>
        <Typo.caption as="p" {...stylex.props(styles.muted)}>
          {readOnly
            ? `자료실 정답 · ${DEVELOPER_COLLECTION_LABELS[sample.remote!.kind]} · ${sample.remote!.split}`
            : '정답을 직접 입력합니다. 빈 입력은 저장할 수 없습니다.'}
        </Typo.caption>
        {!readOnly && (
          <div {...stylex.props(styles.actions)}>
            <ActionButton
              type="submit"
              size="small"
              disabled={saving || draft.length === 0}
              loading={saving}
              {...stylex.props(styles.primaryAction)}
            >
              저장하고 다음
            </ActionButton>
            <div {...stylex.props(styles.secondaryActions)}>
              <ActionButton
                type="button"
                size="small"
                variant="neutralWeak"
                disabled={saving}
                onClick={onSkip}
              >
                건너뛰기
              </ActionButton>
              <ActionButton
                type="button"
                size="small"
                variant="ghost"
                disabled={saving}
                onClick={() => onSetExcluded(!sample.excluded)}
              >
                {sample.excluded ? '포함으로 복원' : '학습에서 제외'}
              </ActionButton>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
