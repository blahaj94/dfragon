import * as stylex from '@stylexjs/stylex'
import { ActionButton, Typo } from '@dfragon/ui'
import { DeveloperSampleThumbnail } from '../components/DeveloperSampleThumbnail'
import { DeveloperSampleEditor } from '../components/DeveloperSampleEditor'
import type { DeveloperWorkbenchSample } from '../lib/developer-party'
import { styles } from './DeveloperLabelingSection.style'

export type DeveloperLabelFilter = 'unlabeled' | 'complete' | 'excluded'

const filters: { id: DeveloperLabelFilter; label: string }[] = [
  { id: 'unlabeled', label: '미입력' },
  { id: 'complete', label: '완료' },
  { id: 'excluded', label: '제외' }
]

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
        {filters.map(({ id, label }) => (
          <ActionButton
            key={id}
            size="small"
            variant={filter === id ? 'neutralSolid' : 'ghost'}
            aria-pressed={filter === id}
            onClick={() => onFilterChange(id)}
          >
            {label}
          </ActionButton>
        ))}
      </div>
      {pagination && (
        <nav aria-label="자료실 페이지" {...stylex.props(styles.filters)}>
          <ActionButton
            size="small"
            variant="neutralWeak"
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
          {loading && samples.length === 0 ? (
            <Typo.txtS role="status">이미지를 불러오는 중입니다.</Typo.txtS>
          ) : samples.length === 0 ? (
            <Typo.txtS {...stylex.props(styles.listEmpty)}>
              {filter === 'unlabeled'
                ? '입력할 이미지가 없습니다.'
                : filter === 'complete'
                  ? '완료된 이미지가 없습니다.'
                  : '제외한 이미지가 없습니다.'}
            </Typo.txtS>
          ) : (
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
          )}
        </section>
        <section aria-label="선택한 이미지 정답" {...stylex.props(styles.panel)}>
          {selected ? (
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
          ) : (
            <Typo.txtS role="status">
              {loading ? '이미지를 불러오는 중입니다.' : '정답을 입력할 이미지를 선택하세요.'}
            </Typo.txtS>
          )}
        </section>
      </div>
      <Typo.caption {...stylex.props(styles.muted)}>
        {selected?.remote
          ? '제외한 크롭은 평가에 포함하지 않습니다.'
          : '제외한 크롭은 보존됩니다. 제외 탭에서 다시 포함할 수 있습니다.'}
      </Typo.caption>
    </section>
  )
}
