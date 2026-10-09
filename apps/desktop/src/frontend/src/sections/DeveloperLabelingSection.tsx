import * as stylex from '@stylexjs/stylex'
import { ActionButton, Typo } from '@dfragon/ui'
import { Chip } from '@seed-design/react'
import { DeveloperSampleThumbnail } from '../components/DeveloperSampleThumbnail'
import { DeveloperSampleEditor } from '../components/DeveloperSampleEditor'
import type { DeveloperWorkbenchSample } from '../lib/developer-party'
import type { DeveloperLabelFilter } from '../lib/developer-workbench-samples'
import { styles } from './DeveloperLabelingSection.style'

const filters: { id: DeveloperLabelFilter; label: string }[] = [
  { id: 'unlabeled', label: '미입력' },
  { id: 'complete', label: '완료' },
  { id: 'excluded', label: '제외' }
]

function getEmptySampleMessage(filter: DeveloperLabelFilter): string {
  if (filter === 'unlabeled') {
    return '입력할 이미지가 없습니다.'
  }

  if (filter === 'complete') {
    return '완료된 이미지가 없습니다.'
  }

  return '제외한 이미지가 없습니다.'
}

export function DeveloperLabelingSection({
  samples,
  pagination,
  selected,
  selectedNumber,
  filter,
  draft,
  loading,
  saving,
  error,
  notice,
  onFilterChange,
  onSelect,
  onDraft,
  onSaveAndNext,
  onSkip,
  onSetExcluded
}: {
  samples: DeveloperWorkbenchSample[]
  pagination?: {
    page: number
    pageCount: number
    total: number
    onPageChange: (page: number) => void
  }
  selected: DeveloperWorkbenchSample | null
  selectedNumber: number
  filter: DeveloperLabelFilter
  draft: string
  loading: boolean
  saving: boolean
  error: string
  notice: string
  onFilterChange: (filter: DeveloperLabelFilter) => void
  onSelect: (id: string) => void
  onDraft: (value: string) => void
  onSaveAndNext: () => void
  onSkip: () => void
  onSetExcluded: (excluded: boolean) => void
}): React.JSX.Element {
  function renderSamples(): React.JSX.Element {
    if (loading && samples.length === 0) {
      return <Typo.txtS role="status">이미지를 불러오는 중입니다.</Typo.txtS>
    }

    if (samples.length === 0) {
      return (
        <Typo.txtS {...stylex.props(styles.listEmpty)}>{getEmptySampleMessage(filter)}</Typo.txtS>
      )
    }

    return (
      <ul aria-label="저장된 테스트 이미지" {...stylex.props(styles.list)}>
        {samples.map((sample) => (
          <DeveloperSampleThumbnail
            key={sample.id}
            sample={sample}
            selected={selected?.id === sample.id}
            onSelect={() => onSelect(sample.id)}
          />
        ))}
      </ul>
    )
  }

  function renderSelectedSample(): React.JSX.Element {
    if (selected) {
      return (
        <DeveloperSampleEditor
          key={selected.id}
          sample={selected}
          number={selectedNumber}
          draft={draft}
          saving={saving}
          onDraft={onDraft}
          onSaveAndNext={onSaveAndNext}
          onSkip={onSkip}
          onSetExcluded={onSetExcluded}
        />
      )
    }

    return (
      <Typo.txtS role="status">
        {loading ? '이미지를 불러오는 중입니다.' : '정답을 입력할 이미지를 선택하세요.'}
      </Typo.txtS>
    )
  }

  return (
    <section
      role="tabpanel"
      id="developer-labeling-panel"
      aria-labelledby="developer-labeling-tab"
      aria-label="정답 입력"
      {...stylex.props(styles.section)}
    >
      <Typo.h4 as="h2">저장된 크롭</Typo.h4>
      <div role="group" aria-label="이미지 상태 필터" {...stylex.props(styles.filters)}>
        {filters.map(({ id, label }) => {
          const selected = filter === id

          return (
            <Chip.Root
              key={id}
              type="button"
              size="small"
              aria-pressed={selected}
              onClick={() => onFilterChange(id)}
              {...stylex.props(selected && styles.filterSelected)}
            >
              <Chip.Label {...stylex.props(selected && styles.filterSelectedLabel)}>
                {label}
              </Chip.Label>
            </Chip.Root>
          )
        })}
      </div>
      {pagination && (
        <nav aria-label="자료실 페이지" {...stylex.props(styles.filters)}>
          <ActionButton
            size="small"
            variant="neutralWeak"
            {...stylex.props(styles.secondaryButton)}
            disabled={pagination.page === 0}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
          >
            이전 페이지
          </ActionButton>
          <Typo.txtS role="status">
            {pagination.page + 1} / {pagination.pageCount} 페이지 · {pagination.total}개
          </Typo.txtS>
          <ActionButton
            size="small"
            variant="neutralWeak"
            {...stylex.props(styles.secondaryButton)}
            disabled={pagination.page + 1 >= pagination.pageCount}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
          >
            다음 페이지
          </ActionButton>
        </nav>
      )}
      {error && (
        <Typo.txtS role="alert" {...stylex.props(styles.error)}>
          {error}
        </Typo.txtS>
      )}
      {notice && <Typo.txtS role="status">{notice}</Typo.txtS>}
      <div {...stylex.props(styles.layout)}>
        <section aria-label="저장 이미지 목록" {...stylex.props(styles.panel)}>
          {renderSamples()}
        </section>
        <section aria-label="선택한 이미지 정답" {...stylex.props(styles.panel)}>
          {renderSelectedSample()}
        </section>
      </div>
      <Typo.caption {...stylex.props(styles.muted)}>
        {selected?.remote
          ? '제외한 크롭은 평가에 포함하지 않습니다.'
          : '제외한 크롭은 제외 탭에서 다시 포함 가능'}
      </Typo.caption>
    </section>
  )
}
