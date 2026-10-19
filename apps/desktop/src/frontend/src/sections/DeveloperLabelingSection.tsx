import * as stylex from '@stylexjs/stylex'
import { Button, Chip, Typo } from '@dfragon/ui'
import { DeveloperSampleThumbnail } from '../components/DeveloperSampleThumbnail'
import { DeveloperSampleEditor } from '../components/DeveloperSampleEditor'
import type { DeveloperLabeling } from '../hooks/useDeveloperLabeling'
import type { DeveloperLabelFilter } from '../lib/developer-workbench-samples'
import { buttonStyles } from '../constants/button.style'
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
  labeling,
  loading,
  saving,
  error
}: {
  labeling: DeveloperLabeling
  /** 지금 자료 위치의 목록을 읽는 중인지 */
  loading: boolean
  /** 로컬 자료에 정답이나 제외 여부를 저장하는 중인지 */
  saving: boolean
  /** 지금 자료 위치의 목록을 읽지 못한 이유 */
  error: string
}): React.JSX.Element {
  const { samples, pagination, selected, filter, notice } = labeling

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
            onSelect={() => labeling.select(sample.id)}
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
          number={labeling.selectedNumber}
          saving={saving}
          editing={labeling}
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
            <Chip key={id} pressed={selected} onPressedChange={() => labeling.changeFilter(id)}>
              {label}
            </Chip>
          )
        })}
      </div>
      {pagination && (
        <nav aria-label="자료실 페이지" {...stylex.props(styles.filters)}>
          <Button
            size="sm"
            {...stylex.props(buttonStyles.secondary)}
            disabled={pagination.page === 0}
            onClick={() => labeling.changePage(pagination.page - 1)}
          >
            이전 페이지
          </Button>
          <Typo.txtS role="status">
            {pagination.page + 1} / {pagination.pageCount} 페이지, {pagination.total}개
          </Typo.txtS>
          <Button
            size="sm"
            {...stylex.props(buttonStyles.secondary)}
            disabled={pagination.page + 1 >= pagination.pageCount}
            onClick={() => labeling.changePage(pagination.page + 1)}
          >
            다음 페이지
          </Button>
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
