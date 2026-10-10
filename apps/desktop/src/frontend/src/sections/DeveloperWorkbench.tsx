import { useEffect, useEffectEvent, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, Typo } from '@dfragon/ui'
import { Select } from '@seed-design/react'
import { paginate } from '@dfragon/lib/utils/pagination'
import { CheckIcon } from '../components/CheckIcon'
import { ChevronDownIcon } from '../components/ChevronDownIcon'
import { DeveloperPartyCollectionSection } from './DeveloperPartyCollectionSection'
import { DeveloperLabelingSection } from './DeveloperLabelingSection'
import { useOcrSamples } from '../hooks/useOcrSamples'
import { useDeveloperSamples } from '../hooks/useDeveloperSamples'
import { useDeveloperEvaluation } from '../hooks/useDeveloperEvaluation'
import { summarizeDeveloperEvaluation, type DeveloperEvaluation } from '../lib/developer-evaluation'
import { normalizeNickname } from '../lib/recognition'
import type { DeveloperPartySlotNumber, DeveloperWorkbenchSample } from '../lib/developer-party'
import {
  queryDeveloperWorkbenchSamples,
  selectDeveloperEvaluationSamples,
  selectDeveloperWorkbenchSample,
  nextDeveloperWorkbenchSampleId,
  type DeveloperLabelFilter
} from '../lib/developer-workbench-samples'
import { buttonStyles } from '../constants/button.style'
import { styles } from './DeveloperWorkbench.style'
import { DEVELOPER_COLLECTION_SLOTS } from '../../../preload/common/developer-collection'
import {
  DEFAULT_DEVELOPER_PREVIEW_INTERVAL_MS,
  DEVELOPER_PREVIEW_INTERVALS_MS
} from '../constants/developer'
import type { DeveloperCollectionKind } from '../../../preload/common/types/developer'

const REMOTE_PAGE_SIZE = 50
const workbenchTabs = ['collection', 'participants', 'raid', 'labeling'] as const
type WorkbenchTab = (typeof workbenchTabs)[number]

export function DeveloperWorkbench({ onClose }: { onClose: () => void }): React.JSX.Element {
  const dataset = useDeveloperSamples()
  const [source, setSource] = useState<'local' | 'ocr'>('local')
  const [split, setSplit] = useState('all')
  const [remotePage, setRemotePage] = useState(0)
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('collection')
  const [previewIntervalMs, setPreviewIntervalMs] = useState(DEFAULT_DEVELOPER_PREVIEW_INTERVAL_MS)
  const remote = useOcrSamples(source === 'ocr' && activeTab === 'labeling')
  const readingRemote = source === 'ocr'
  const displayedDataset = readingRemote ? remote : dataset
  const evaluation = useDeveloperEvaluation()
  const [filter, setFilter] = useState<DeveloperLabelFilter>('unlabeled')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectionRevision = useRef(0)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [slotsByKind, setSlotsByKind] = useState<
    Record<DeveloperCollectionKind, DeveloperPartySlotNumber[]>
  >({
    hud: [...DEVELOPER_COLLECTION_SLOTS.hud],
    participants: [...DEVELOPER_COLLECTION_SLOTS.participants],
    raid: [...DEVELOPER_COLLECTION_SLOTS.raid]
  })
  const collectionKind = activeTab === 'participants' || activeTab === 'raid' ? activeTab : 'hud'
  const [confirmClose, setConfirmClose] = useState(false)
  const [notice, setNotice] = useState('')
  const stopEvaluation = useEffectEvent(() => evaluation.cancel())
  useEffect(() => {
    stopEvaluation()
  }, [remote.revision, source, activeTab])
  const { splitSamples, visibleSamples } = queryDeveloperWorkbenchSamples({
    samples: displayedDataset.samples,
    source,
    split,
    labelFilter: filter
  })
  const evaluationSamples = selectDeveloperEvaluationSamples(splitSamples, source)
  const pagination = readingRemote
    ? paginate(visibleSamples, { page: remotePage, pageSize: REMOTE_PAGE_SIZE })
    : null
  const pageSamples = pagination?.items ?? visibleSamples
  const { selected, selectedNumber } = selectDeveloperWorkbenchSample({
    splitSamples,
    pageSamples,
    selectedId
  })
  const canEvaluateSelected =
    selected != null &&
    !selected.excluded &&
    (!readingRemote || selected.text != null) &&
    !evaluation.running &&
    !displayedDataset.loading
  const selectedResult = selected ? evaluation.results[selected.id] : undefined
  const draft = selected ? (drafts[selected.id] ?? selected.text ?? '') : ''
  const summary = summarizeDeveloperEvaluation(evaluationSamples, evaluation.results)
  const dirty = Object.entries(drafts).some(([id, value]) => {
    const sample = dataset.samples.find((row) => row.id === id)

    if (sample == null) {
      return false
    }

    if (sample.text == null) {
      return value !== ''
    }

    return value !== sample.text
  })

  function selectSample(id: string | null): void {
    selectionRevision.current += 1
    setSelectedId(id)
  }

  function selectTab(tab: WorkbenchTab): void {
    selectionRevision.current += 1
    setActiveTab(tab)
  }

  async function saveAndNext(): Promise<void> {
    if (readingRemote || !selected || dataset.saving || draft.length === 0) {
      return
    }

    const id = selected.id
    const revision = selectionRevision.current
    const nextId = nextDeveloperWorkbenchSampleId(visibleSamples, id)
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
    if (revision === selectionRevision.current) {
      setSelectedId(nextId)
    }
  }

  function skipSelected(): void {
    if (!selected) {
      return
    }
    selectSample(nextDeveloperWorkbenchSampleId(visibleSamples, selected.id) ?? selected.id)
    setNotice('')
  }

  async function setSelectedExcluded(excluded: boolean): Promise<void> {
    if (readingRemote || !selected || dataset.saving) {
      return
    }

    const id = selected.id
    const revision = selectionRevision.current
    const nextId = nextDeveloperWorkbenchSampleId(visibleSamples, id)
    const updated = await dataset.setSampleExcluded(id, excluded)
    if (!updated) {
      return
    }

    if (revision === selectionRevision.current) {
      setSelectedId(nextId)
    }
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
        <ActionButton
          size="medium"
          variant="neutralWeak"
          {...stylex.props(buttonStyles.secondaryOnCanvas)}
          disabled={dataset.saving}
          onClick={requestClose}
        >
          <Typo.txtM as="span" weight={700}>
            일반 화면으로 돌아가기
          </Typo.txtM>
        </ActionButton>
      </header>

      {confirmClose && (
        <div role="alert" {...stylex.props(styles.panel)}>
          <Typo.txtS>저장하지 않은 정답 입력이 있습니다.</Typo.txtS>
          <div {...stylex.props(styles.actions)}>
            <ActionButton
              size="small"
              variant="neutralWeak"
              {...stylex.props(buttonStyles.secondaryOnCanvas)}
              onClick={() => setConfirmClose(false)}
            >
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
          size="medium"
          variant="ghost"
          {...stylex.props(styles.tab, activeTab === 'collection' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => selectTab('collection')}
        >
          <Typo.txtM as="span" weight={700}>
            이미지 수집
          </Typo.txtM>
        </ActionButton>
        <ActionButton
          id="developer-participants-tab"
          role="tab"
          aria-selected={activeTab === 'participants'}
          aria-controls="developer-participants-panel"
          tabIndex={activeTab === 'participants' ? 0 : -1}
          size="medium"
          variant="ghost"
          {...stylex.props(styles.tab, activeTab === 'participants' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => selectTab('participants')}
        >
          <Typo.txtM as="span" weight={700}>
            파티원창 크롭
          </Typo.txtM>
        </ActionButton>
        <ActionButton
          id="developer-raid-tab"
          role="tab"
          aria-selected={activeTab === 'raid'}
          aria-controls="developer-raid-panel"
          tabIndex={activeTab === 'raid' ? 0 : -1}
          size="medium"
          variant="ghost"
          {...stylex.props(styles.tab, activeTab === 'raid' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => selectTab('raid')}
        >
          <Typo.txtM as="span" weight={700}>
            공대원창 크롭
          </Typo.txtM>
        </ActionButton>
        <ActionButton
          id="developer-labeling-tab"
          role="tab"
          aria-selected={activeTab === 'labeling'}
          aria-controls="developer-labeling-panel"
          tabIndex={activeTab === 'labeling' ? 0 : -1}
          size="medium"
          variant="ghost"
          {...stylex.props(styles.tab, activeTab === 'labeling' && styles.tabSelected)}
          onKeyDown={handleTabKeyDown}
          onClick={() => {
            selectTab('labeling')
            setNotice('')
          }}
        >
          <Typo.txtM as="span" weight={700}>
            정답 입력
          </Typo.txtM>
        </ActionButton>
      </div>
      <div aria-hidden="true" {...stylex.props(styles.separator)} />

      <div {...stylex.props(styles.tabPanel)}>
        {activeTab !== 'labeling' && (
          <div {...stylex.props(styles.captureInterval)}>
            <Typo.txtS as="span">캡처 주기</Typo.txtS>
            <Select.Root
              size="medium"
              value={[String(previewIntervalMs)]}
              onValueChange={(values) => {
                if (values[0] != null) {
                  setPreviewIntervalMs(Number(values[0]))
                }
              }}
              placement="bottom-start"
              strategy="fixed"
              gutter={4}
            >
              <Select.Trigger
                aria-label="캡처 주기"
                {...stylex.props(styles.captureIntervalTrigger)}
              >
                <Select.Value />
                <Select.SuffixIcon
                  svg={<ChevronDownIcon />}
                  {...stylex.props(styles.captureIntervalChevron)}
                />
              </Select.Trigger>
              <Select.Positioner>
                <Select.Content aria-label="캡처 주기">
                  <Select.ScrollArea>
                    {DEVELOPER_PREVIEW_INTERVALS_MS.map((intervalMs) => (
                      <Select.Item
                        key={intervalMs}
                        value={String(intervalMs)}
                        label={`${intervalMs / 1000}초`}
                      >
                        <Select.ItemLabel />
                        <Select.ItemIndicator selected={<CheckIcon />} />
                      </Select.Item>
                    ))}
                  </Select.ScrollArea>
                </Select.Content>
              </Select.Positioner>
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
          slots={slotsByKind[collectionKind]}
          onSlotsChange={(slots) =>
            setSlotsByKind((previous) => ({ ...previous, [collectionKind]: slots }))
          }
        />
        {activeTab === 'labeling' && (
          <>
            <div role="group" aria-label="자료 위치" {...stylex.props(styles.actions)}>
              {(['local', 'ocr'] as const).map((value) => (
                <ActionButton
                  key={value}
                  size="small"
                  variant={source === value ? 'neutralSolid' : 'ghost'}
                  aria-pressed={source === value}
                  disabled={dataset.saving}
                  onClick={() => {
                    setSource(value)
                    setRemotePage(0)
                    setFilter(value === 'ocr' ? 'complete' : 'unlabeled')
                    selectSample(null)
                    setNotice('')
                    evaluation.setPreprocessing(evaluation.preprocessing)
                  }}
                >
                  {value === 'local' ? '로컬 자료' : 'OCR 자료실'}
                </ActionButton>
              ))}
              {readingRemote && (
                <>
                  <ActionButton
                    size="small"
                    variant="neutralWeak"
                    {...stylex.props(buttonStyles.secondaryOnCanvas)}
                    disabled={remote.loading || evaluation.running}
                    onClick={() => {
                      setRemotePage(0)
                      selectSample(null)
                      remote.refresh()
                    }}
                  >
                    자료실 다시 불러오기
                  </ActionButton>
                  <label>
                    평가 분할{' '}
                    <select
                      aria-label="평가 분할"
                      value={split}
                      disabled={evaluation.running}
                      onChange={(event) => {
                        setSplit(event.target.value)
                        setRemotePage(0)
                        selectSample(null)
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
              samples={pageSamples}
              pagination={
                pagination != null && visibleSamples.length > 0
                  ? {
                      page: pagination.currentPage,
                      pageCount: pagination.pageCount,
                      total: visibleSamples.length,
                      onPageChange: (page) => {
                        setRemotePage(page)
                        selectSample(null)
                      }
                    }
                  : undefined
              }
              selected={selected}
              selectedNumber={selectedNumber}
              filter={filter}
              draft={draft}
              loading={displayedDataset.loading}
              saving={dataset.saving}
              error={displayedDataset.error}
              notice={notice}
              onFilterChange={(nextFilter) => {
                const nextQuery = queryDeveloperWorkbenchSamples({
                  samples: displayedDataset.samples,
                  source,
                  split,
                  labelFilter: nextFilter
                })
                setFilter(nextFilter)
                setRemotePage(0)
                selectSample(nextQuery.visibleSamples[0]?.id ?? null)
                setNotice('')
              }}
              onSelect={(id) => {
                selectSample(id)
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
                      evaluation.running ||
                      displayedDataset.loading ||
                      evaluationSamples.length === 0
                    }
                    onClick={() => void evaluation.evaluate(evaluationSamples)}
                  >
                    {readingRemote ? '정답 완료 자료 평가' : '전체 평가'}
                  </ActionButton>
                  {evaluation.running && (
                    <ActionButton
                      size="small"
                      variant="neutralWeak"
                      {...stylex.props(buttonStyles.secondaryOnCanvas)}
                      onClick={evaluation.cancel}
                    >
                      평가 중지
                    </ActionButton>
                  )}
                </div>
                <Typo.caption {...stylex.props(styles.muted)}>
                  제품 전처리는 Otsu 반전 이진화를 적용하며, 원본 입력은 이를 생략합니다. 두 방식
                  모두 48×320 입력으로 변환합니다. 모델 점수는 정답률이 아닙니다.
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
                    <ActionButton
                      size="small"
                      variant="neutralWeak"
                      {...stylex.props(buttonStyles.secondaryOnCanvas)}
                      disabled={!canEvaluateSelected}
                      onClick={() => {
                        if (canEvaluateSelected) {
                          void evaluation.evaluate([selected])
                        }
                      }}
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
