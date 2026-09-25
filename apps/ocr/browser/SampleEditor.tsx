import { useState } from 'react'
import { Typo } from '@dfragon/ui/typo'
import { primary, secondary } from './buttons.js'
import { requestOcr, OcrApiError } from './client.js'
import type { Sample, Split } from '../src/model.js'
import { parseSplit } from '../src/input.js'

export function SampleEditor({ sample, onSaved }: { sample: Sample; onSaved: () => void }) {
  const [text, setText] = useState(sample.text ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function saveSample(excluded: boolean) {
    setBusy(true)
    setMessage('')
    const body = { text: text === '' ? null : text, excluded }
    try {
      try {
        await requestOcr(`/api/samples/${sample.id}`, 'PATCH', body)
      } catch (error) {
        if (
          error instanceof OcrApiError &&
          error.code === 'LABEL_SPLIT_CHANGE' &&
          window.confirm(
            '정답을 바꾸면 새 닉네임의 분할을 따릅니다. 배정이 없으면 미배정으로 바뀝니다. 저장할까요?'
          )
        ) {
          await requestOcr(`/api/samples/${sample.id}`, 'PATCH', {
            ...body,
            confirmSplitChange: true
          })
        } else {
          throw error
        }
      }
      onSaved()
      setMessage('저장했습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function assignNicknameSplit(split: Split) {
    if (sample.text === null || sample.text.length === 0) {
      return
    }
    if (!window.confirm(`같은 정답의 모든 이미지를 ${split}에 배정합니다. 계속할까요?`)) {
      return
    }
    setBusy(true)
    try {
      await requestOcr('/api/splits', 'PUT', { text: sample.text, split })
      onSaved()
      setMessage('같은 닉네임의 분할을 변경했습니다.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '분할하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="editor" aria-label="정답 편집">
      <div className="editor-heading">
        <Typo.h5>정답 입력</Typo.h5>
        <span className="badge">
          {sample.kind === 'hud' ? 'HUD' : '파티원창'} · 위치 {sample.slot}
        </span>
      </div>
      <div className="large-preview">
        <img src={`/api/samples/${sample.id}/image`} alt="정답을 입력할 닉네임 크롭" />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void saveSample(sample.excluded)
        }}
      >
        <label>
          닉네임 정답
          <input
            className="label-input"
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={100}
            placeholder="이미지에 보이는 그대로 입력"
          />
        </label>
        <div className="actions">
          <button className={primary} disabled={busy}>
            정답 저장
          </button>
          <button
            type="button"
            className={secondary}
            disabled={busy}
            onClick={() => void saveSample(!sample.excluded)}
          >
            {sample.excluded ? '제외 복원' : '학습에서 제외'}
          </button>
        </div>
      </form>
      <label>
        닉네임 단위 분할
        <select
          value={sample.split}
          disabled={
            busy || sample.text === null || sample.text.length === 0 || text !== sample.text
          }
          onChange={(e) => void assignNicknameSplit(parseSplit(e.target.value))}
        >
          <option value="unassigned">미배정</option>
          <option>train</option>
          <option>val</option>
          <option>test</option>
        </select>
      </label>
      <p className="muted">같은 정답 닉네임의 모든 이미지에 적용됩니다.</p>
      <dl>
        <dt>원본 해상도</dt>
        <dd>
          {sample.frameWidth} × {sample.frameHeight}
        </dd>
        <dt>UI 크기</dt>
        <dd>
          {sample.uiScale === null
            ? '미상'
            : `${Math.round(sample.uiScale * 100)}% · ${sample.uiScaleSource === 'game' ? '게임 설정' : '추정'}`}
        </dd>
        <dt>수집 시각</dt>
        <dd>{new Date(sample.capturedAt).toLocaleString('ko-KR')}</dd>
        <dt>크롭 영역</dt>
        <dd>
          ({sample.x}, {sample.y}) · {sample.width} × {sample.height}
        </dd>
      </dl>
      <a href={`/api/captures/${sample.captureId}/image`} target="_blank" rel="noreferrer">
        원본 화면 열기 ↗
      </a>
      <p role="status">{message}</p>
    </section>
  )
}
