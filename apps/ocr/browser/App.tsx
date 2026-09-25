import * as stylex from '@stylexjs/stylex'
import { styles } from './styles.js'
import { useOcrSession } from './hooks/use-ocr-session.js'
import { useSampleWorkspace } from './hooks/use-sample-workspace.js'
import { errorMessage } from './client.js'
import { OCR_SAMPLES } from '../src/constants.js'
import { Typo } from '@dfragon/ui/typo'
import { primary, secondary } from './buttons.js'
import { CaptureUpload } from './CaptureUpload.js'
import { SampleEditor } from './SampleEditor.js'

export function App() {
  const { authenticated, login, logout, error: sessionError } = useOcrSession()
  const {
    filters: { state, kind, split, offset },
    setFilter,
    setOffset,
    setSelected,
    sample,
    samples,
    next,
    stats,
    error: workspaceError
  } = useSampleWorkspace(authenticated)
  const error = sessionError ?? workspaceError
  const message = error === null ? '' : errorMessage(error)

  return (
    <main {...stylex.props(styles.main)}>
      <header {...stylex.props(styles.header)}>
        <div>
          <div {...stylex.props(styles.eyebrow)}>DFRAGON / DEVELOPER</div>
          <Typo.h3 {...stylex.props(styles.heading)}>OCR 자료실</Typo.h3>
          <p {...stylex.props(styles.paragraph, styles.muted)}>수집한 장면에서, 학습할 정답까지.</p>
        </div>
        {authenticated === true && (
          <div {...stylex.props(styles.actions)}>
            <a
              className={`${secondary} ${stylex.props(styles.actionLink).className}`}
              href="/api/export"
            >
              전체 다운로드
            </a>
            <button className={secondary} onClick={() => logout.mutate()}>
              로그아웃
            </button>
          </div>
        )}
      </header>
      <p {...stylex.props(styles.paragraph, styles.error)} role="alert">
        {message}
      </p>
      {authenticated === null ? (
        <p {...stylex.props(styles.paragraph)}>로그인 상태를 확인하고 있습니다.</p>
      ) : !authenticated ? (
        <section {...stylex.props(styles.login)}>
          <div {...stylex.props(styles.eyebrow)}>PRIVATE WORKSPACE</div>
          <Typo.h4 {...stylex.props(styles.heading)}>패스키로 자료실 열기</Typo.h4>
          <p {...stylex.props(styles.paragraph, styles.loginParagraph)}>
            기존 DFRAGON 계정으로 로그인합니다.
            <br />
            관리자로 지정한 계정만 자료를 확인하고 수정할 수 있습니다.
          </p>
          <button className={primary} onClick={() => login.mutate()}>
            패스키 로그인
          </button>
        </section>
      ) : (
        <>
          <section {...stylex.props(styles.stats)} aria-label="수집 현황">
            {[
              ['원본 화면', stats?.captures ?? 0],
              ['닉네임 크롭', stats?.samples ?? 0],
              ['정답 대기', stats?.pending ?? 0],
              ['원본 용량', `${((stats?.storedBytes ?? 0) / 1024 / 1024).toFixed(1)} MiB`]
            ].map(([name, value]) => (
              <div key={name} {...stylex.props(styles.statCard)}>
                <span {...stylex.props(styles.statLabel)}>{name}</span>
                <strong {...stylex.props(styles.statValue)}>{value}</strong>
              </div>
            ))}
          </section>
          <CaptureUpload />
          <div {...stylex.props(styles.filters)} role="group" aria-label="자료 필터">
            <label {...stylex.props(styles.label, styles.filterLabel)}>
              작성 상태
              <select
                {...stylex.props(styles.control)}
                value={state}
                onChange={(e) => {
                  setFilter('state', e.target.value)
                }}
              >
                <option value="">전체 상태</option>
                <option value="pending">미작성</option>
                <option value="labeled">정답 완료</option>
                <option value="excluded">제외</option>
              </select>
            </label>
            <label {...stylex.props(styles.label, styles.filterLabel)}>
              수집 종류
              <select
                {...stylex.props(styles.control)}
                value={kind}
                onChange={(e) => {
                  setFilter('kind', e.target.value)
                }}
              >
                <option value="">전체 종류</option>
                <option value="hud">HUD</option>
                <option value="participants">파티원창</option>
              </select>
            </label>
            <label {...stylex.props(styles.label, styles.filterLabel)}>
              분할
              <select
                {...stylex.props(styles.control)}
                value={split}
                onChange={(e) => {
                  setFilter('split', e.target.value)
                }}
              >
                <option value="">전체 분할</option>
                <option value="unassigned">미배정</option>
                <option>train</option>
                <option>val</option>
                <option>test</option>
              </select>
            </label>
          </div>
          <div {...stylex.props(styles.workspace)}>
            <section aria-label="수집 이미지" {...stylex.props(styles.gallery)}>
              {samples.length === 0 ? (
                <div {...stylex.props(styles.empty)}>
                  <Typo.h5 {...stylex.props(styles.heading)}>아직 이미지가 없습니다</Typo.h5>
                  <p {...stylex.props(styles.paragraph, styles.emptyParagraph)}>
                    원본과 크롭 영역을 업로드하면 여기에 표시됩니다.
                    <br />
                    필터를 사용 중이라면 조건을 바꿔보세요.
                  </p>
                </div>
              ) : (
                samples.map((item) => (
                  <button
                    key={item.id}
                    {...stylex.props(
                      styles.sample,
                      item.id === sample?.id && styles.selectedSample
                    )}
                    onClick={() => setSelected(item.id)}
                    aria-pressed={item.id === sample?.id}
                  >
                    <div {...stylex.props(styles.thumb)}>
                      <img
                        {...stylex.props(styles.thumbnailImage)}
                        loading="lazy"
                        src={`/api/samples/${item.id}/image`}
                        alt={item.text ?? '미작성 닉네임'}
                      />
                    </div>
                    <strong {...stylex.props(styles.sampleTitle)}>
                      {item.text ?? '정답 미작성'}
                    </strong>
                    <span {...stylex.props(styles.sampleMeta)}>
                      {item.kind === 'hud' ? 'HUD' : '파티원창'} · 위치 {item.slot} ·{' '}
                      {item.excluded ? '제외' : item.split}
                    </span>
                  </button>
                ))
              )}
            </section>
            {sample !== undefined && (
              <SampleEditor
                key={`${sample.id}:${sample.text}:${sample.excluded}:${sample.split}`}
                sample={sample}
              />
            )}
          </div>
          <nav {...stylex.props(styles.pagination)} aria-label="페이지">
            <button
              className={secondary}
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - OCR_SAMPLES.pageSize))}
            >
              이전
            </button>
            <span>{offset / OCR_SAMPLES.pageSize + 1} 페이지</span>
            <button
              className={secondary}
              disabled={next === null}
              onClick={() => {
                if (next !== null) {
                  setOffset(next)
                }
              }}
            >
              다음
            </button>
          </nav>
        </>
      )}
    </main>
  )
}
