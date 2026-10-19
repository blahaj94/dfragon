import { useEffect, useEffectEvent, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Button, Select, Typo } from '@dfragon/ui'
import { DeveloperPartyCollectionSection } from './DeveloperPartyCollectionSection'
import { DeveloperLabelingSection } from './DeveloperLabelingSection'
import { useOcrSamples } from '../hooks/useOcrSamples'
import { useDeveloperSamples } from '../hooks/useDeveloperSamples'
import { useDeveloperEvaluation } from '../hooks/useDeveloperEvaluation'
import { useDeveloperLabeling } from '../hooks/useDeveloperLabeling'
import { summarizeDeveloperEvaluation, type DeveloperEvaluation } from '../lib/developer-evaluation'
import { normalizeNickname } from '../lib/recognition'
import type { DeveloperWorkbenchSample } from '../lib/developer-party'
import { selectDeveloperEvaluationSamples } from '../lib/developer-workbench-samples'
import { buttonStyles } from '../constants/button.style'
import { styles } from './DeveloperWorkbench.style'
import {
  DEFAULT_DEVELOPER_PREVIEW_INTERVAL_MS,
  DEVELOPER_PREVIEW_INTERVALS_MS
} from '../constants/developer'

// Select가 trigger의 값 글자와 목록 항목을 같은 이름으로 그리도록 한 곳에서 만든다.
const previewIntervalItems = DEVELOPER_PREVIEW_INTERVALS_MS.map((intervalMs) => ({
  value: String(intervalMs),
  label: `${intervalMs / 1000}초`
}))
const workbenchTabs = ['collection', 'participants', 'raid', 'labeling'] as const
type WorkbenchTab = (typeof workbenchTabs)[number]

export function DeveloperWorkbench({ onClose }: { onClose: () => void }): React.JSX.Element {
  const dataset = useDeveloperSamples()
  const [source, setSource] = useState<'local' | 'ocr'>('local')
  const [split, setSplit] = useState('all')
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('collection')
  const [previewIntervalMs, setPreviewIntervalMs] = useState(DEFAULT_DEVELOPER_PREVIEW_INTERVAL_MS)
  const remote = useOcrSamples(source === 'ocr' && activeTab === 'labeling')
  const readingRemote = source === 'ocr'
  const displayedDataset = readingRemote ? remote : dataset
  const evaluation = useDeveloperEvaluation()
  const labeling = useDeveloperLabeling({
    local: dataset,
    samples: displayedDataset.samples,
    source,
    split
  })
  const { selected } = labeling
  const collectionKind = activeTab === 'participants' || activeTab === 'raid' ? activeTab : 'hud'
  const [confirmClose, setConfirmClose] = useState(false)
  const stopEvaluation = useEffectEvent(() => evaluation.cancel())
  useEffect(() => {
    stopEvaluation()
  }, [remote.revision, source, activeTab])
  const evaluationSamples = selectDeveloperEvaluationSamples(labeling.splitSamples, source)
  const canEvaluateSelected =
    selected != null &&
    !selected.excluded &&
    (!readingRemote || selected.text != null) &&
    !evaluation.running &&
    !displayedDataset.loading
  const selectedResult = selected ? evaluation.results[selected.id] : undefined
  const summary = summarizeDeveloperEvaluation(evaluationSamples, evaluation.results)

  function selectTab(tab: WorkbenchTab): void {
    labeling.cancelAdvance()
    setActiveTab(tab)
  }

  function requestClose(): void {
    if (labeling.dirty) {
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
    const index = workbenchTabs.indexOf(activeTab)
    let nextIndex: number
    if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = workbenchTabs.length - 1
    } else {
      const direction = event.key === 'ArrowRight' ? 1 : -1
      nextIndex = (index + direction + workbenchTabs.length) % workbenchTabs.length
    }
    const nextTab = workbenchTabs[nextIndex]
    selectTab(nextTab)
    requestAnimationFrame(() => document.getElementById(`developer-${nextTab}-tab`)?.focus())
  }

  function getEvaluationProgress(): string {
    if (evaluation.canceled) {
      return '평가 중지'
    }

    if (evaluation.running) {
      return '평가 진행'
    }

    return '최근 실행'
  }

  function getLabelComparison(
    sample: DeveloperWorkbenchSample,
    result: Extract<DeveloperEvaluation, { status: 'success' }>
  ): string {
    if (sample.text == null) {
      return '정답을 저장하면 일치 여부를 확인할 수 있습니다.'
    }

    if (result.text === sample.text) {
      return '저장된 정답과 원문 일치'
    }

    return '저장된 정답과 원문 불일치'
  }

  function renderSelectedResult(sample: DeveloperWorkbenchSample): React.JSX.Element {
    if (sample.excluded) {
      return <Typo.txtS>제외한 이미지는 평가에 포함하지 않습니다.</Typo.txtS>
    }

    if (readingRemote && sample.text == null) {
      return <Typo.txtS>자료실에서 정답을 입력한 뒤 다시 불러오세요.</Typo.txtS>
    }

    if (selectedResult?.status === 'success') {
      return (
        <>
          <Typo.txtM>원문: {selectedResult.text || '(빈 문자열)'}</Typo.txtM>
          <Typo.txtS>
            제품 닉네임 정리 후: {normalizeNickname(selectedResult.text) || '(빈 문자열)'}
          </Typo.txtS>
          <Typo.caption>
            모델 점수 {selectedResult.confidence.toFixed(1)}, 추론{' '}
            {selectedResult.milliseconds.toFixed(0)}ms
          </Typo.caption>
          <Typo.txtS>{getLabelComparison(sample, selectedResult)}</Typo.txtS>
        </>
      )
    }

    if (selectedResult?.status === 'failed') {
      return <Typo.txtS>인식 실패. 이미지가 닉네임 한 줄인지 확인해 주세요.</Typo.txtS>
    }

    return <Typo.txtS>아직 평가하지 않은 이미지입니다.</Typo.txtS>
  }

  return (
    <section aria-label="개발자 작업 공간" {...stylex.props(styles.workbench)}>
      <header {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.heading)}>
          <Typo.h3 as="h1">개발자 작업 공간</Typo.h3>
          <Typo.txtS {...stylex.props(styles.muted)}>게임 중 수집, 정답은 나중에 입력</Typo.txtS>
        </div>
        <Button
          {...stylex.props(buttonStyles.secondary)}
          disabled={dataset.saving}
          onClick={requestClose}
        >
          <Typo.txtM as="span" weight={700}>
            일반 화면으로 돌아가기
          </Typo.txtM>
        </Button>
      </header>

      {confirmClose && (
        <div role="alert" {...stylex.props(styles.panel)}>
          <Typo.txtS>저장하지 않은 정답 입력이 있습니다.</Typo.txtS>
          <div {...stylex.props(styles.actions)}>
            <Button
              size="sm"
              {...stylex.props(buttonStyles.secondary)}
              onClick={() => setConfirmClose(false)}
            >
              계속 작성
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              저장하지 않고 돌아가기
            </Button>
          </div>
        </div>
      )}

      <div role="tablist" aria-label="개발자 도구" {...stylex.props(styles.tabs)}>
        <Button
          variant="ghost"
          id="developer-collection-tab"
          role="tab"
          aria-selected={activeTab === 'collection'}
          aria-controls="developer-collection-panel"
          tabIndex={activeTab === 'collection' ? 0 : -1}
          {...stylex.props(styles.tab, activeTab === 'collection' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => selectTab('collection')}
        >
          <Typo.txtM as="span" weight={700}>
            이미지 수집
          </Typo.txtM>
        </Button>
        <Button
          variant="ghost"
          id="developer-participants-tab"
          role="tab"
          aria-selected={activeTab === 'participants'}
          aria-controls="developer-participants-panel"
          tabIndex={activeTab === 'participants' ? 0 : -1}
          {...stylex.props(styles.tab, activeTab === 'participants' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => selectTab('participants')}
        >
          <Typo.txtM as="span" weight={700}>
            파티원창 크롭
          </Typo.txtM>
        </Button>
        <Button
          variant="ghost"
          id="developer-raid-tab"
          role="tab"
          aria-selected={activeTab === 'raid'}
          aria-controls="developer-raid-panel"
          tabIndex={activeTab === 'raid' ? 0 : -1}
          {...stylex.props(styles.tab, activeTab === 'raid' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => selectTab('raid')}
        >
          <Typo.txtM as="span" weight={700}>
            공대원창 크롭
          </Typo.txtM>
        </Button>
        <Button
          variant="ghost"
          id="developer-labeling-tab"
          role="tab"
          aria-selected={activeTab === 'labeling'}
          aria-controls="developer-labeling-panel"
          tabIndex={activeTab === 'labeling' ? 0 : -1}
          {...stylex.props(styles.tab, activeTab === 'labeling' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => {
            selectTab('labeling')
            labeling.clearNotice()
          }}
        >
          <Typo.txtM as="span" weight={700}>
            정답 입력
          </Typo.txtM>
        </Button>
      </div>
      <div aria-hidden="true" {...stylex.props(styles.separator)} />

      <div {...stylex.props(styles.tabPanel)}>
        {activeTab !== 'labeling' && (
          <div {...stylex.props(styles.captureInterval)}>
            <Typo.txtS as="span">캡처 주기</Typo.txtS>
            <Select.Root
              value={String(previewIntervalMs)}
              onValueChange={(value: string | null) => {
                if (value != null) {
                  setPreviewIntervalMs(Number(value))
                }
              }}
              items={previewIntervalItems}
            >
              <Select.Trigger
                size="md"
                aria-label="캡처 주기"
                {...stylex.props(styles.captureIntervalTrigger)}
              >
                <Select.Value />
              </Select.Trigger>
              <Select.Popup aria-label="캡처 주기">
                {previewIntervalItems.map((item) => (
                  <Select.Item key={item.value} value={item.value}>
                    <Select.ItemText>{item.label}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Root>
          </div>
        )}
        <DeveloperPartyCollectionSection
          active={activeTab !== 'labeling'}
          kind={collectionKind}
          previewIntervalMs={previewIntervalMs}
          onLabeling={() => selectTab('labeling')}
          onSaved={() => void dataset.refresh()}
          onDisarmed={() => void dataset.refresh()}
        />
        {activeTab === 'labeling' && (
          <>
            <div role="group" aria-label="자료 위치" {...stylex.props(styles.actions)}>
              {(['local', 'ocr'] as const).map((value) => (
                <Button
                  size="sm"
                  key={value}
                  variant={source === value ? 'secondary' : 'ghost'}
                  aria-pressed={source === value}
                  disabled={dataset.saving}
                  onClick={() => {
                    setSource(value)
                    labeling.reset(value === 'ocr' ? 'complete' : 'unlabeled')
                    evaluation.setPreprocessing(evaluation.preprocessing)
                  }}
                >
                  {value === 'local' ? '로컬 자료' : 'OCR 자료실'}
                </Button>
              ))}
              {readingRemote && (
                <>
                  <Button
                    size="sm"
                    {...stylex.props(buttonStyles.secondary)}
                    disabled={remote.loading || evaluation.running}
                    onClick={() => {
                      labeling.resetPage()
                      remote.refresh()
                    }}
                  >
                    자료실 다시 불러오기
                  </Button>
                  <label>
                    평가 분할{' '}
                    <select
                      aria-label="평가 분할"
                      value={split}
                      disabled={evaluation.running}
                      onChange={(event) => {
                        setSplit(event.target.value)
                        labeling.resetPage()
                      }}
                    >
                      <option value="all">전체 분할</option>
                      <option value="test">test</option>
                      <option value="val">val</option>
                      <option value="train">train</option>
                      <option value="unassigned">미배정</option>
                    </select>
                  </label>
                </>
              )}
            </div>
            {readingRemote && (
              <Typo.txtS>
                ocr.dfragon.com의 정답, 이미지를 읽어 평가합니다. 정답과 제외 여부는 자료실에서
                수정한 뒤 다시 불러오세요.
              </Typo.txtS>
            )}
            <DeveloperLabelingSection
              labeling={labeling}
              loading={displayedDataset.loading}
              saving={dataset.saving}
              error={displayedDataset.error}
            />

            <details aria-label="모델 성능 평가" {...stylex.props(styles.evaluation)}>
              <summary {...stylex.props(styles.evaluationSummary)}>모델 성능 평가</summary>
              <div {...stylex.props(styles.evaluationBody)}>
                <Typo.txtS>탑재된 PP-OCRv5 한국어 인식 모델, 닉네임 한 줄 기준</Typo.txtS>
                <div {...stylex.props(styles.actions)}>
                  <Button
                    size="sm"
                    variant={evaluation.preprocessing === 'party' ? 'secondary' : 'ghost'}
                    aria-pressed={evaluation.preprocessing === 'party'}
                    disabled={evaluation.running}
                    onClick={() => evaluation.setPreprocessing('party')}
                  >
                    제품 전처리
                  </Button>
                  <Button
                    size="sm"
                    variant={evaluation.preprocessing === 'raw' ? 'secondary' : 'ghost'}
                    aria-pressed={evaluation.preprocessing === 'raw'}
                    disabled={evaluation.running}
                    onClick={() => evaluation.setPreprocessing('raw')}
                  >
                    원본 입력
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={
                      evaluation.running ||
                      displayedDataset.loading ||
                      evaluationSamples.length === 0
                    }
                    onClick={() => void evaluation.evaluate(evaluationSamples)}
                  >
                    {readingRemote ? '정답 완료 자료 평가' : '전체 평가'}
                  </Button>
                  {evaluation.running && (
                    <Button
                      size="sm"
                      {...stylex.props(buttonStyles.secondary)}
                      onClick={evaluation.cancel}
                    >
                      평가 중지
                    </Button>
                  )}
                </div>
                <Typo.caption {...stylex.props(styles.muted)}>
                  제품 전처리는 Otsu 반전 이진화를 적용하며, 원본 입력은 이를 생략합니다. 두 방식
                  모두 48×320 입력으로 변환합니다. 모델 점수는 정답률이 아닙니다.
                </Typo.caption>
                <div role="status" {...stylex.props(styles.evaluationSummaryGrid)}>
                  <Typo.txtS>
                    평가 성공 {summary.completed}개, 실패 {summary.failed}개
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
                    {getEvaluationProgress()} {evaluation.progress.done}/{evaluation.progress.total}
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
                    {renderSelectedResult(selected)}
                    <Button
                      size="sm"
                      {...stylex.props(buttonStyles.secondary)}
                      disabled={!canEvaluateSelected}
                      onClick={() => {
                        if (canEvaluateSelected) {
                          void evaluation.evaluate([selected])
                        }
                      }}
                    >
                      선택 이미지 평가
                    </Button>
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
