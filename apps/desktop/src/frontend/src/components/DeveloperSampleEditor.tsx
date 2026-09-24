import { useEffect, useState } from 'react'
import { ActionButton, TextField, TextFieldInput, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import type { DeveloperEvaluation } from '../lib/developer-evaluation'
import { normalizeNickname } from '../lib/recognition'
import { styles } from './DeveloperSampleEditor.style'

export function DeveloperSampleEditor({
  sample,
  draft,
  result,
  saving,
  evaluating,
  onDraft,
  onSave,
  onEvaluate
}: {
  sample: DeveloperSample
  draft: string
  result?: DeveloperEvaluation
  saving: boolean
  evaluating: boolean
  onDraft: (value: string) => void
  onSave: (text: string | null) => void
  onEvaluate: () => void
}): React.JSX.Element {
  const [image, setImage] = useState('')
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let current = true
    void window.developer
      .readImage(sample.id)
      .then((data) => {
        if (current) {
          setImage(data)
        }
      })
      .catch(() => {
        if (current) {
          setFailed(true)
        }
      })
    return () => {
      current = false
    }
  }, [sample.id, retry])
  return (
    <div {...stylex.props(styles.editor)}>
      <Typo.txtS>
        {sample.width}×{sample.height}px ·{' '}
        {sample.text == null
          ? '정답 미작성'
          : sample.text === ''
            ? '빈 문자열 정답'
            : '정답 저장됨'}
      </Typo.txtS>
      <div {...stylex.props(styles.imageArea)}>
        {image ? (
          <img src={image} alt="선택한 테스트 이미지" {...stylex.props(styles.image)} />
        ) : (
          <Typo.txtS>{failed ? '이미지를 읽지 못했습니다.' : '이미지를 읽는 중입니다.'}</Typo.txtS>
        )}
      </div>
      {failed && (
        <ActionButton
          size="small"
          variant="ghost"
          onClick={() => {
            setFailed(false)
            setRetry(retry + 1)
          }}
        >
          이미지 다시 읽기
        </ActionButton>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!saving) {
            onSave(draft)
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
          Enter로 저장합니다. 빈 값도 정답으로 저장되며, 미작성으로 되돌리기는 별도입니다.
        </Typo.caption>
        <div {...stylex.props(styles.actions)}>
          <ActionButton type="submit" size="small" disabled={saving} loading={saving}>
            정답 저장
          </ActionButton>
          <ActionButton
            type="button"
            size="small"
            variant="ghost"
            disabled={saving}
            onClick={() => onSave(null)}
          >
            미작성으로 되돌리기
          </ActionButton>
        </div>
      </form>
      <div {...stylex.props(styles.result)} aria-label="모델 인식 결과">
        <Typo.txtM as="h3" weight={700}>
          모델 인식 결과
        </Typo.txtM>
        {result?.status === 'success' ? (
          <>
            <Typo.txtM>원문: {result.text === '' ? '(빈 문자열)' : result.text}</Typo.txtM>
            <Typo.txtS>
              제품 닉네임 정리 후: {normalizeNickname(result.text) || '(빈 문자열)'}
            </Typo.txtS>
            <Typo.caption>
              신뢰도 {result.confidence.toFixed(1)} · 추론 {result.milliseconds.toFixed(0)}ms
            </Typo.caption>
            <Typo.txtS>
              {sample.text == null
                ? '정답을 저장하면 일치 여부를 확인할 수 있습니다.'
                : result.text === sample.text
                  ? '저장된 정답과 원문 일치'
                  : '저장된 정답과 원문 불일치'}
            </Typo.txtS>
          </>
        ) : (
          <Typo.txtS {...stylex.props(result?.status === 'failed' && styles.error)}>
            {result?.status === 'failed'
              ? '인식 실패. 이미지가 닉네임 한 줄인지 확인하고 다시 평가해 주세요.'
              : '아직 평가하지 않은 이미지입니다.'}
          </Typo.txtS>
        )}
        <ActionButton size="small" variant="neutralWeak" disabled={evaluating} onClick={onEvaluate}>
          선택 이미지 평가
        </ActionButton>
      </div>
    </div>
  )
}
