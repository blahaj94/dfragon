import { useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { styles } from './styles.js'
import { darkTheme } from './theme.stylex.js'
import { useColorMode } from './hooks/use-color-mode.js'
import { useOcrSession } from './hooks/use-ocr-session.js'
import { useSampleWorkspace } from './hooks/use-sample-workspace.js'
import { errorMessage } from './client.js'
import { OCR_SAMPLES } from '../src/constants.js'
import { Typo } from '@dfragon/ui/typo'
import { primary, secondary } from './buttons.js'
import { CaptureUpload } from './CaptureUpload.js'
import { SampleEditor } from './SampleEditor.js'
import { OcrIcon } from './OcrIcon.js'

export function App() {
  const { mode, toggle } = useColorMode()
  const [uploadOpen, setUploadOpen] = useState(false)
  const uploadButton = useRef<HTMLButtonElement>(null)
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
    <div
      {...stylex.props(styles.root, mode === 'dark' && darkTheme, mode === 'dark' && styles.dark)}
    >
      <main {...stylex.props(styles.main)}>
        <header {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.eyebrow, styles.brand)}>DFRAGON / DEVELOPER</div>
          <Typo.h3 as="h1" {...stylex.props(styles.heading, styles.title)}>
            OCR 자료실
          </Typo.h3>
          {authenticated === true && (
            <>
              <div {...stylex.props(styles.fileActions)}>
                <button
                  ref={uploadButton}
                  className={`${primary} ${stylex.props(styles.headerButton).className}`}
                  aria-expanded={uploadOpen}
                  aria-controls="capture-upload"
                  onClick={() => setUploadOpen(!uploadOpen)}
                >
                  <OcrIcon name="upload" />
                  이미지 업로드
                </button>
                <a
                  className={`${secondary} ${stylex.props(styles.headerButton).className}`}
                  href="/api/export"
                >
                  <OcrIcon name="download" />
                  전체 다운로드
                </a>
              </div>
              <div {...stylex.props(styles.accountActions)}>
                <button
                  className={secondary}
                  disabled={logout.isPending}
                  onClick={() =>
                    logout.mutate(undefined, { onSuccess: () => setUploadOpen(false) })
                  }
                >
                  로그아웃
                </button>
                <button
                  className={`${secondary} ${stylex.props(styles.themeButton).className}`}
                  onClick={toggle}
                  aria-label={mode === 'light' ? '다크 테마로 전환' : '라이트 테마로 전환'}
                >
                  <OcrIcon name={mode === 'light' ? 'moon' : 'sun'} size={20} />
                </button>
              </div>
            </>
          )}
        </header>
        {message && (
          <p {...stylex.props(styles.paragraph, styles.error)} role="alert">
            {message}
          </p>
        )}
        {authenticated === null ? (
          <p {...stylex.props(styles.paragraph)}>로그인 상태를 확인하고 있습니다.</p>
        ) : !authenticated ? (
          <>
            <section {...stylex.props(styles.login)} aria-label="자료실 로그인">
              <div {...stylex.props(styles.loginIcon)}>
                <OcrIcon name="lock" size={28} />
              </div>
              <div {...stylex.props(styles.eyebrow)}>PRIVATE WORKSPACE</div>
              <button
                className={`${primary} ${stylex.props(styles.loginButton).className}`}
                disabled={login.isPending}
                onClick={() => login.mutate()}
              >
                <OcrIcon name="lock" />
                패스키 로그인
              </button>
            </section>
            <span {...stylex.props(styles.serviceAddress)}>ocr.dfragon.com</span>
          </>
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
                  <strong
                    {...stylex.props(styles.statValue, name === '정답 대기' && styles.accent)}
                  >
                    {value}
                  </strong>
                </div>
              ))}
            </section>
            <CaptureUpload
              open={uploadOpen}
              onClose={() => {
                setUploadOpen(false)
                uploadButton.current?.focus()
              }}
            />
            <div {...stylex.props(styles.filterBar)}>
              <div {...stylex.props(styles.collectionHeading)}>
                <Typo.h5 as="h2">수집 이미지</Typo.h5>
                <span {...stylex.props(styles.sampleCount)}>{stats?.samples ?? 0}개의 크롭</span>
              </div>
              <div {...stylex.props(styles.filters)} role="group" aria-label="자료 필터">
                <label {...stylex.props(styles.label)}>
                  작성 상태
                  <select
                    {...stylex.props(styles.control)}
                    value={state}
                    onChange={(e) => setFilter('state', e.target.value)}
                  >
                    <option value="">전체 상태</option>
                    <option value="pending">미작성</option>
                    <option value="labeled">정답 완료</option>
                    <option value="excluded">제외</option>
                  </select>
                </label>
                <label {...stylex.props(styles.label)}>
                  수집 종류
                  <select
                    {...stylex.props(styles.control)}
                    value={kind}
                    onChange={(e) => setFilter('kind', e.target.value)}
                  >
                    <option value="">전체 종류</option>
                    <option value="hud">HUD</option>
                    <option value="participants">파티원창</option>
                  </select>
                </label>
                <label {...stylex.props(styles.label)}>
                  분할
                  <select
                    {...stylex.props(styles.control)}
                    value={split}
                    onChange={(e) => setFilter('split', e.target.value)}
                  >
                    <option value="">전체 분할</option>
                    <option value="unassigned">미배정</option>
                    <option>train</option>
                    <option>val</option>
                    <option>test</option>
                  </select>
                </label>
              </div>
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
                        item.excluded && styles.excludedSample,
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
                        {item.kind === 'hud' ? 'HUD' : '파티원창'} · 위치 {item.slot}
                      </span>
                      <span
                        {...stylex.props(
                          styles.sampleSplit,
                          !item.excluded && item.split === 'unassigned' && styles.unassigned
                        )}
                      >
                        {item.excluded
                          ? '제외'
                          : item.split === 'unassigned'
                            ? '미배정'
                            : item.split}
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
              <nav {...stylex.props(styles.pagination)} aria-label="페이지">
                <button
                  className={`${secondary} ${stylex.props(styles.paginationButton).className}`}
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - OCR_SAMPLES.pageSize))}
                >
                  이전
                </button>
                <span>{offset / OCR_SAMPLES.pageSize + 1} 페이지</span>
                <button
                  className={`${secondary} ${stylex.props(styles.paginationButton).className}`}
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
            </div>
          </>
        )}
      </main>
    </div>
  )
}
