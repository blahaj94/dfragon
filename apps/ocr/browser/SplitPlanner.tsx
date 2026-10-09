import * as stylex from '@stylexjs/stylex'
import { assignedSplits as splits, characterGroups } from '../src/model.js'
import { OCR_CHARACTER_GROUP_LABELS } from './constants.js'
import { useSplitPlanner } from './hooks/use-split-planner.js'
import { styles } from './styles.js'
import { layout } from './SplitPlanner.style.js'
import { primary, secondary } from './buttons.js'

const percent = (count: number, total: number) => {
  if (total) {
    return (100 * count) / total
  }

  return 0
}

export function SplitPlanner() {
  const {
    stats,
    ratios,
    replaceExisting,
    preview,
    applied,
    busy,
    canPreview,
    error,
    changeRatio,
    changeReplacement,
    previewSplit,
    applySplit
  } = useSplitPlanner()
  const shown = preview?.after ?? stats

  function handleApplySplit() {
    if (preview === null) {
      return
    }
    const confirmed = window.confirm(
      `미리보기대로 ${preview.changedNicknames}개 닉네임을 배정합니다. 기존 분할 이동은 ${preview.reassignedNicknames}개입니다. 적용하시겠습니까?`
    )
    if (confirmed) {
      applySplit(preview)
    }
  }

  return (
    <details {...stylex.props(styles.upload)}>
      <summary>자동 분할 · 실제 자료 분포</summary>
      <p {...stylex.props(styles.uploadParagraph)}>
        정답 완료·미제외 자료를 닉네임 단위로 나눕니다. 원하는 이미지 비율을 직접 입력해
        미리보기하세요. 적용 전에는 배정이 바뀌지 않습니다.
      </p>
      {stats && (
        <p>
          실제 이미지 {stats.total.images}장 · 고유 닉네임 {stats.total.nicknames}개 · 정답 문자{' '}
          {stats.total.characters}개 · 제외·미작성 {stats.skipped}장
        </p>
      )}
      <p>
        {stats?.initialized
          ? '자동 추가 활성: 기존 닉네임은 원래 분할, 새 닉네임은 train을 따릅니다.'
          : '첫 적용 후 새 닉네임의 정답을 저장하면 train에 자동 배정됩니다.'}
      </p>
      <div {...stylex.props(layout.fields)}>
        {splits.map((split) => (
          <label key={split} {...stylex.props(layout.field)}>
            {split} 목표 (%)
            <input
              {...stylex.props(styles.control, layout.input)}
              type="number"
              min="0"
              max="100"
              step="any"
              value={ratios[split]}
              disabled={busy}
              onChange={(event) => changeRatio(split, event.target.value)}
            />
          </label>
        ))}
      </div>
      <label>
        <input
          type="checkbox"
          checked={replaceExisting}
          disabled={busy}
          onChange={(event) => changeReplacement(event.target.checked)}
        />{' '}
        기존 배정도 재배정할 수 있도록 미리보기 (기본은 기존 배정 유지)
      </label>
      <p {...stylex.props(styles.muted)}>
        합계 100%. 닉네임 묶음과 기존 배정 때문에 목표와 차이가 생길 수 있습니다. 희귀 문자를 모든
        분할에 강제로 넣지 않습니다. 수동으로 미배정한 닉네임은 자동 분할에서 유지합니다. 합성
        이미지는 실제 자료 분포에서 제외하며, 합성과 같은 닉네임의 실제 자료는 train을 유지합니다.
      </p>
      <button className={secondary} disabled={busy || !canPreview} onClick={previewSplit}>
        분할 미리보기
      </button>
      {error && (
        <p role="alert" {...stylex.props(styles.error)}>
          {error}
        </p>
      )}
      {applied && <p role="status">분할을 적용했습니다. 이후 새 닉네임은 train에 배정됩니다.</p>}
      {shown && (
        <>
          <div {...stylex.props(layout.scroll)}>
            <table {...stylex.props(layout.table)}>
              <caption>{preview ? '적용 예상' : '현재'} 분할 규모</caption>
              <thead>
                <tr>
                  {['분할', '이미지', '닉네임', '이미지 비율', '목표와 차이 (%p)'].map((label) => (
                    <th key={label} {...stylex.props(layout.cell)}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {([...splits, 'unassigned'] as const).map((split) => {
                  const data = shown.splits[split]
                  const actual = percent(data.images, shown.total.images)

                  return (
                    <tr key={split}>
                      <th {...stylex.props(layout.cell)}>{split}</th>
                      <td {...stylex.props(layout.cell)}>{data.images}</td>
                      <td {...stylex.props(layout.cell)}>{data.nicknames}</td>
                      <td {...stylex.props(layout.cell)}>{actual.toFixed(2)}%</td>
                      <td {...stylex.props(layout.cell)}>
                        {preview && split !== 'unassigned'
                          ? (actual - preview.options.ratios[split]).toFixed(2)
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div {...stylex.props(layout.scroll)}>
            <table {...stylex.props(layout.table)}>
              <caption>정답 문자 수 기준 분포 · 괄호는 전체 실제 분포와의 차이 (%p)</caption>
              <thead>
                <tr>
                  {['문자군', '실제 전체', ...splits].map((label) => (
                    <th key={label} {...stylex.props(layout.cell)}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {characterGroups.map((group) => {
                  const original = percent(shown.total.groups[group], shown.total.characters)

                  return (
                    <tr key={group}>
                      <th {...stylex.props(layout.cell)}>{OCR_CHARACTER_GROUP_LABELS[group]}</th>
                      <td {...stylex.props(layout.cell)}>
                        {shown.total.groups[group]} · {original.toFixed(2)}%
                      </td>
                      {splits.map((split) => {
                        const data = shown.splits[split]
                        const actual = percent(data.groups[group], data.characters)

                        return (
                          <td key={split} {...stylex.props(layout.cell)}>
                            {data.groups[group]} · {actual.toFixed(2)}% (
                            {(actual - original).toFixed(2)})
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <details>
            <summary>개별 문자 빈도 보기</summary>
            <p {...stylex.props(layout.frequencies)}>
              {shown.total.frequencies
                .map(({ character, count }) => `${JSON.stringify(character)}: ${count}`)
                .join(' · ')}
            </p>
          </details>
        </>
      )}
      {preview && (
        <>
          <p role="status">
            배정 변경 {preview.changedNicknames}개 닉네임 · 이 중 기존 분할 이동{' '}
            {preview.reassignedNicknames}개 · 수동 미배정 유지{' '}
            {preview.preservedUnassignedNicknames}개
          </p>
          {splits.some((split) => preview.after.splits[split].images === 0) && (
            <p>빈 분할이 있습니다. Windows 학습에는 train/val/test가 모두 필요합니다.</p>
          )}
          <button className={primary} disabled={busy} onClick={handleApplySplit}>
            미리보기 분할 적용
          </button>
        </>
      )}
    </details>
  )
}
