import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, Typo } from '@dfragon/ui'
import { DeveloperPartyCollectionSection } from './DeveloperPartyCollectionSection'
import { DeveloperLabelingSection, type DeveloperLabelFilter } from './DeveloperLabelingSection'
import { useDeveloperSamples } from '../hooks/useDeveloperSamples'
import { useDeveloperEvaluation } from '../hooks/useDeveloperEvaluation'
import { summarizeDeveloperEvaluation } from '../lib/developer-evaluation'
import { normalizeNickname } from '../lib/recognition'
import type { DeveloperWorkbenchSample } from '../lib/developer-party'
import { sortDeveloperWorkbenchSamples } from '../lib/developer-sample-order'
import { styles } from './DeveloperWorkbench.style'

type WorkbenchTab = 'collection' | 'labeling'

export function DeveloperWorkbench({ onClose }: { onClose: () => void }): React.JSX.Element {
  const dataset = useDeveloperSamples()
  const evaluation = useDeveloperEvaluation()
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('collection')
  const [filter, setFilter] = useState<DeveloperLabelFilter>('unlabeled')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [confirmClose, setConfirmClose] = useState(false)
  const [notice, setNotice] = useState('')
  const samples = sortDeveloperWorkbenchSamples(dataset.samples as DeveloperWorkbenchSample[])
  const visibleSamples = samples.filter((sample) => {
    if (filter === 'excluded') {
      return sample.excluded === true
    }
    if (sample.excluded === true) {
      return false
    }
    return filter === 'unlabeled' ? sample.text == null : sample.text != null
  })
  const selected =
    visibleSamples.find((sample) => sample.id === selectedId) ?? visibleSamples[0] ?? null
  const selectedResult = selected ? evaluation.results[selected.id] : undefined
  const draft = selected ? (drafts[selected.id] ?? selected.text ?? '') : ''
  const evaluationSamples = samples.filter((sample) => sample.excluded !== true)
  const summary = summarizeDeveloperEvaluation(evaluationSamples, evaluation.results)
  const dirty = Object.entries(drafts).some(([id, value]) => {
    const sample = samples.find((row) => row.id === id)
    return sample != null && (sample.text == null ? value !== '' : value !== sample.text)
  })

  function nextVisibleId(currentId: string): string | null {
    const otherSamples = visibleSamples.filter((sample) => sample.id !== currentId)
    if (otherSamples.length === 0) {
      return null
    }

    const currentIndex = visibleSamples.findIndex((sample) => sample.id === currentId)
    return (
      visibleSamples.slice(currentIndex + 1).find((sample) => sample.id !== currentId)?.id ??
      otherSamples[0].id
    )
  }

  async function saveAndNext(): Promise<void> {
    if (!selected || dataset.saving || draft.length === 0) {
      return
    }

    const id = selected.id
    const nextId = nextVisibleId(id)
    const saved = await dataset.saveLabel(id, draft)
    if (!saved) {
      return
    }

    setDrafts((previous) => {
      const next = { ...previous }
      delete next[id]
      return next
    })
    setNotice('정답을 저장했습니다.')
    setSelectedId(nextId)
  }

  function skipSelected(): void {
    if (!selected) {
      return
    }
    setSelectedId(nextVisibleId(selected.id) ?? selected.id)
    setNotice('')
  }

  async function setSelectedExcluded(excluded: boolean): Promise<void> {
    if (!selected || dataset.saving) {
      return
    }

    const id = selected.id
    const nextId = nextVisibleId(id)
    const updated = await dataset.setSampleExcluded(id, excluded)
    if (!updated) {
      return
    }

    setSelectedId(nextId)
    setNotice(excluded ? '크롭을 제외했습니다.' : '크롭을 다시 포함했습니다.')
  }

  function requestClose(): void {
    if (dirty) {
      setConfirmClose(true)
      return
    }
    onClose()
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return
    }
    event.preventDefault()
    const nextTab: WorkbenchTab =
      event.key === 'Home' || (event.key === 'ArrowLeft' && activeTab === 'labeling')
        ? 'collection'
        : event.key === 'End' || (event.key === 'ArrowRight' && activeTab === 'collection')
          ? 'labeling'
          : activeTab
    setActiveTab(nextTab)
    requestAnimationFrame(() => document.getElementById(`developer-${nextTab}-tab`)?.focus())
  }

  return (
    <section aria-label="개발자 작업 공간" {...stylex.props(styles.workbench)}>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.heading)}>
          <Typo.h3 as="h1">개발자 작업 공간</Typo.h3>
          <Typo.txtS {...stylex.props(styles.muted)}>
            게임 화면 크롭을 모으고 정답을 입력합니다.
          </Typo.txtS>
        </div>
        <ActionButton
          size="small"
          variant="neutralWeak"
          disabled={dataset.saving}
          onClick={requestClose}
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

      <div role="tablist" aria-label="개발자 도구" {...stylex.props(styles.tabs)}>
        <ActionButton
          id="developer-collection-tab"
          role="tab"
          aria-selected={activeTab === 'collection'}
          aria-controls="developer-collection-panel"
          tabIndex={activeTab === 'collection' ? 0 : -1}
          size="small"
          variant="ghost"
          {...stylex.props(styles.tab, activeTab === 'collection' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => setActiveTab('collection')}
        >
          이미지 수집
        </ActionButton>
        <ActionButton
          id="developer-labeling-tab"
          role="tab"
          aria-selected={activeTab === 'labeling'}
          aria-controls="developer-labeling-panel"
          tabIndex={activeTab === 'labeling' ? 0 : -1}
          size="small"
          variant="ghost"
          {...stylex.props(styles.tab, activeTab === 'labeling' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => {
            setActiveTab('labeling')
            setNotice('')
          }}
        >
          정답 입력
        </ActionButton>
      </div>
      <div aria-hidden="true" {...stylex.props(styles.separator)} />

      <div {...stylex.props(styles.tabPanel)}>
        {activeTab === 'collection' ? (
          <DeveloperPartyCollectionSection onSaved={() => void dataset.refresh()} />
        ) : (
          <>
            <DeveloperLabelingSection
              samples={visibleSamples}
              selected={selected}
              selectedNumber={
                selected == null ? 0 : samples.findIndex((sample) => sample.id === selected.id) + 1
              }
              filter={filter}
              draft={draft}
              loading={dataset.loading}
              saving={dataset.saving}
              error={dataset.error}
              notice={notice}
              onFilterChange={(nextFilter) => {
                setFilter(nextFilter)
                setSelectedId(null)
                setNotice('')
              }}
              onSelect={(id) => {
                setSelectedId(id)
                setNotice('')
              }}
              onDraft={(value) => {
                if (selected) {
                  setDrafts((previous) => ({ ...previous, [selected.id]: value }))
                }
              }}
              onSaveAndNext={() => void saveAndNext()}
              onSkip={skipSelected}
              onSetExcluded={(excluded) => void setSelectedExcluded(excluded)}
            />

            <details aria-label="모델 성능 평가" {...stylex.props(styles.evaluation)}>
              <summary {...stylex.props(styles.evaluationSummary)}>모델 성능 평가</summary>
              <div {...stylex.props(styles.evaluationBody)}>
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
                    disabled={
                      evaluation.running || dataset.loading || evaluationSamples.length === 0
                    }
                    onClick={() => void evaluation.evaluate(evaluationSamples)}
                  >
                    전체 평가
                  </ActionButton>
                  {evaluation.running && (
                    <ActionButton size="small" variant="neutralWeak" onClick={evaluation.cancel}>
                      평가 중지
                    </ActionButton>
                  )}
                </div>
                <Typo.caption {...stylex.props(styles.muted)}>
                  제품 전처리는 반전 회색조를 적용하며, 원본 입력은 크롭 그대로 평가합니다. 신뢰도는
                  정답률이 아닙니다.
                </Typo.caption>
                <div role="status" {...stylex.props(styles.evaluationSummaryGrid)}>
                  <Typo.txtS>
                    평가 성공 {summary.completed}개 · 실패 {summary.failed}개
                  </Typo.txtS>
                  <Typo.txtS>
                    원문 일치율{' '}
                    {summary.accuracy == null ? '—' : `${(summary.accuracy * 100).toFixed(1)}%`} (
                    {summary.matched}/{summary.scored})
                  </Typo.txtS>
                  <Typo.txtS>
                    문자 오류율{' '}
                    {summary.characterErrorRate == null
                      ? '—'
                      : `${(summary.characterErrorRate * 100).toFixed(1)}%`}
                  </Typo.txtS>
                </div>
                {evaluation.error && (
                  <Typo.txtS role="alert" {...stylex.props(styles.error)}>
                    {evaluation.error}
                  </Typo.txtS>
                )}
                {evaluation.progress.total > 0 && (
                  <Typo.txtS role="status">
                    {evaluation.canceled
                      ? '평가 중지'
                      : evaluation.running
                        ? '평가 진행'
                        : '최근 실행'}{' '}
                    {evaluation.progress.done}/{evaluation.progress.total}
                  </Typo.txtS>
                )}
                {selected && (
                  <section
                    aria-label="선택 이미지 모델 평가"
                    {...stylex.props(styles.evaluationResult)}
                  >
                    <Typo.txtM as="h3" weight={700}>
                      선택 이미지 평가
                    </Typo.txtM>
                    {selected.excluded ? (
                      <Typo.txtS>제외한 이미지는 평가에 포함하지 않습니다.</Typo.txtS>
                    ) : selectedResult?.status === 'success' ? (
                      <>
                        <Typo.txtM>원문: {selectedResult.text || '(빈 문자열)'}</Typo.txtM>
                        <Typo.txtS>
                          제품 닉네임 정리 후:{' '}
                          {normalizeNickname(selectedResult.text) || '(빈 문자열)'}
                        </Typo.txtS>
                        <Typo.caption>
                          신뢰도 {selectedResult.confidence.toFixed(1)} · 추론{' '}
                          {selectedResult.milliseconds.toFixed(0)}ms
                        </Typo.caption>
                        <Typo.txtS>
                          {selected.text == null
                            ? '정답을 저장하면 일치 여부를 확인할 수 있습니다.'
                            : selectedResult.text === selected.text
                              ? '저장된 정답과 원문 일치'
                              : '저장된 정답과 원문 불일치'}
                        </Typo.txtS>
                      </>
                    ) : selectedResult?.status === 'failed' ? (
                      <Typo.txtS>인식 실패. 이미지가 닉네임 한 줄인지 확인해 주세요.</Typo.txtS>
                    ) : (
                      <Typo.txtS>아직 평가하지 않은 이미지입니다.</Typo.txtS>
                    )}
                    <ActionButton
                      size="small"
                      variant="neutralWeak"
                      disabled={selected.excluded === true || evaluation.running || dataset.loading}
                      onClick={() => void evaluation.evaluate([selected])}
                    >
                      선택 이미지 평가
                    </ActionButton>
                  </section>
                )}
              </div>
            </details>
          </>
        )}
      </div>
    </section>
  )
}
