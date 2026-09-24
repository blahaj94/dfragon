import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, Typo } from '@dfragon/ui'
import { DeveloperCropEditor } from '../components/DeveloperCropEditor'
import { DeveloperSampleEditor } from '../components/DeveloperSampleEditor'
import { useDeveloperSamples } from '../hooks/useDeveloperSamples'
import { useDeveloperEvaluation } from '../hooks/useDeveloperEvaluation'
import { summarizeDeveloperEvaluation } from '../lib/developer-evaluation'
import { styles } from './DeveloperWorkbench.style'

export function DeveloperWorkbench({ onClose }: { onClose: () => void }): React.JSX.Element {
  const dataset = useDeveloperSamples()
  const evaluation = useDeveloperEvaluation()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [unlabeledOnly, setUnlabeledOnly] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [notice, setNotice] = useState('')
  const samples = dataset.samples
  const selected = samples.find((sample) => sample.id === selectedId) ?? samples[0]
  const visible = unlabeledOnly ? samples.filter((sample) => sample.text == null) : samples
  const summary = summarizeDeveloperEvaluation(samples, evaluation.results)
  const labeled = samples.filter((sample) => sample.text != null).length
  const dirty = Object.keys(drafts).some((id) => {
    const sample = samples.find((sample) => sample.id === id)
    return sample != null && (sample.text == null || drafts[id] !== sample.text)
  })

  async function saveLabel(text: string | null): Promise<void> {
    if (!selected) {
      return
    }
    const id = selected.id
    const saved = await dataset.saveLabel(id, text)
    if (!saved) {
      return
    }
    setDrafts((previous) => {
      const next = { ...previous }
      delete next[id]
      return next
    })
    setNotice(text == null ? '미작성 상태로 저장했습니다.' : '정답을 저장했습니다.')
    if (text != null && evaluation.results[id] == null) {
      void evaluation.evaluate([saved])
    }
  }

  return (
    <section aria-label="개발자 작업 공간" {...stylex.props(styles.workbench)}>
      <header {...stylex.props(styles.header)}>
        <div>
          <Typo.h3 as="h1">개발자 작업 공간</Typo.h3>
          <Typo.txtS {...stylex.props(styles.muted)}>
            DFRAGON · 테스트 이미지 수집, 라벨링, 모델 평가
          </Typo.txtS>
        </div>
        <ActionButton
          size="small"
          variant="neutralWeak"
          disabled={dataset.saving}
          onClick={() => (dirty ? setConfirmClose(true) : onClose())}
        >
          일반 화면으로 돌아가기
        </ActionButton>
      </header>
      {confirmClose && (
        <div role="alert" {...stylex.props(styles.panel)}>
          <Typo.txtS>저장하지 않은 정답 입력이 있습니다.</Typo.txtS>
          <div {...stylex.props(styles.actions)}>
            <ActionButton size="small" variant="neutralWeak" onClick={() => setConfirmClose(false)}>
              계속 작성
            </ActionButton>
            <ActionButton size="small" variant="ghost" onClick={onClose}>
              저장하지 않고 돌아가기
            </ActionButton>
          </div>
        </div>
      )}
      <section aria-label="모델 성능 평가" {...stylex.props(styles.panel)}>
        <Typo.h4 as="h2">현재 모델 성능</Typo.h4>
        <Typo.txtS>탑재된 PP-OCRv5 한국어 인식 모델 · 닉네임 한 줄 기준</Typo.txtS>
        <div {...stylex.props(styles.actions)}>
          <ActionButton
            size="small"
            variant={evaluation.preprocessing === 'party' ? 'neutralSolid' : 'ghost'}
            aria-pressed={evaluation.preprocessing === 'party'}
            disabled={evaluation.running}
            onClick={() => evaluation.setPreprocessing('party')}
          >
            제품 전처리
          </ActionButton>
          <ActionButton
            size="small"
            variant={evaluation.preprocessing === 'raw' ? 'neutralSolid' : 'ghost'}
            aria-pressed={evaluation.preprocessing === 'raw'}
            disabled={evaluation.running}
            onClick={() => evaluation.setPreprocessing('raw')}
          >
            원본 입력
          </ActionButton>
          <ActionButton
            size="small"
            disabled={evaluation.running || dataset.loading || samples.length === 0}
            onClick={() => void evaluation.evaluate(samples)}
          >
            전체 {samples.length}개 평가
          </ActionButton>
          {evaluation.running && (
            <ActionButton size="small" variant="neutralWeak" onClick={evaluation.cancel}>
              평가 중지
            </ActionButton>
          )}
        </div>
        <Typo.caption {...stylex.props(styles.muted)}>
          {evaluation.preprocessing === 'party'
            ? '반전 회색조를 적용합니다. 실제 앱의 슬롯 감지·연속 프레임 안정화는 평가하지 않습니다.'
            : '크롭 원본을 모델에 입력합니다.'}{' '}
          모델 내부 크기 조정은 동일합니다. 신뢰도는 정답률이 아닙니다.
        </Typo.caption>
        <div {...stylex.props(styles.summary)} role="status">
          <Typo.txtS>
            정답 {labeled}/{samples.length}개
          </Typo.txtS>
          <Typo.txtS>
            평가 성공 {summary.completed}개 · 실패 {summary.failed}개 · 미평가{' '}
            {samples.length - summary.completed - summary.failed}개
          </Typo.txtS>
          <Typo.txtS>
            원문 일치율 {summary.accuracy == null ? '—' : `${(summary.accuracy * 100).toFixed(1)}%`}{' '}
            ({summary.matched}/{summary.scored})
          </Typo.txtS>
          <Typo.txtS>
            문자 오류율{' '}
            {summary.characterErrorRate == null
              ? '—'
              : `${(summary.characterErrorRate * 100).toFixed(1)}%`}
          </Typo.txtS>
          {evaluation.progress.total > 0 && (
            <Typo.txtS>
              {evaluation.canceled
                ? '평가 중지 · 일부 결과'
                : evaluation.running
                  ? '평가 진행'
                  : '최근 실행'}{' '}
              {evaluation.progress.done}/{evaluation.progress.total}
            </Typo.txtS>
          )}
        </div>
        <Typo.caption {...stylex.props(styles.muted)}>
          정답을 저장하고 평가에 성공한 이미지만 채점합니다. 공백·대소문자를 포함한 원문 기준이며,
          빈 정답은 일치율에 포함됩니다. 정답 문자 합계가 0이면 문자 오류율은 표시하지 않습니다.
        </Typo.caption>
        {evaluation.error && (
          <Typo.txtS role="alert" {...stylex.props(styles.error)}>
            {evaluation.error}
          </Typo.txtS>
        )}
      </section>
      <div {...stylex.props(styles.columns)}>
        <DeveloperCropEditor
          saving={dataset.saving || dataset.loading}
          onSave={async (dataUrl) => {
            const sample = await dataset.addSample(dataUrl)
            if (!sample) {
              return false
            }
            setSelectedId(sample.id)
            setUnlabeledOnly(false)
            if (evaluation.running) {
              setNotice(
                '이미지를 저장했습니다. 진행 중인 평가가 끝나면 선택 이미지 평가를 눌러 주세요.'
              )
            } else {
              void evaluation.evaluate([sample])
            }
            return true
          }}
        />
        <section aria-label="테스트 이미지와 정답" {...stylex.props(styles.panel)}>
          <Typo.h4 as="h2">이미지와 정답</Typo.h4>
          <div {...stylex.props(styles.actions)}>
            <label>
              <input
                type="checkbox"
                checked={unlabeledOnly}
                onChange={(event) => setUnlabeledOnly(event.target.checked)}
              />{' '}
              <Typo.txtS as="span">미작성만 보기</Typo.txtS>
            </label>
            <ActionButton
              size="small"
              variant="ghost"
              disabled={dataset.loading || dataset.saving}
              onClick={() => void dataset.refresh()}
            >
              다시 불러오기
            </ActionButton>
          </div>
          {dataset.error && (
            <Typo.txtS role="alert" {...stylex.props(styles.error)}>
              {dataset.error}
            </Typo.txtS>
          )}
          {dataset.loading ? (
            <Typo.txtS role="status">이미지를 불러오는 중입니다.</Typo.txtS>
          ) : samples.length === 0 ? (
            <Typo.txtS>아직 테스트 이미지가 없습니다. 영역을 잘라 저장해 주세요.</Typo.txtS>
          ) : (
            <>
              <ul aria-label="테스트 이미지 목록" {...stylex.props(styles.list)}>
                {visible.map((sample) => (
                  <li key={sample.id}>
                    <ActionButton
                      size="small"
                      variant={selected?.id === sample.id ? 'neutralSolid' : 'ghost'}
                      aria-pressed={selected?.id === sample.id}
                      onClick={() => {
                        setSelectedId(sample.id)
                        setNotice('')
                      }}
                    >
                      {samples.indexOf(sample) + 1} ·{' '}
                      {sample.text == null ? '미작성' : sample.text || '(빈 정답)'}
                    </ActionButton>
                  </li>
                ))}
              </ul>
              {visible.length === 0 && <Typo.txtS>미작성 이미지가 없습니다.</Typo.txtS>}
              {selected && (
                <DeveloperSampleEditor
                  key={selected.id}
                  sample={selected}
                  draft={drafts[selected.id] ?? selected.text ?? ''}
                  result={evaluation.results[selected.id]}
                  saving={dataset.saving}
                  evaluating={evaluation.running}
                  onDraft={(value) => setDrafts({ ...drafts, [selected.id]: value })}
                  onSave={(text) => void saveLabel(text)}
                  onEvaluate={() => void evaluation.evaluate([selected])}
                />
              )}
            </>
          )}
          {notice && <Typo.txtS role="status">{notice}</Typo.txtS>}
          <Typo.caption {...stylex.props(styles.muted)}>
            저장한 이미지와 정답은 이 기기의 앱 데이터에 보관합니다. 개발자 모드를 꺼도 유지됩니다.
          </Typo.caption>
        </section>
      </div>
    </section>
  )
}
