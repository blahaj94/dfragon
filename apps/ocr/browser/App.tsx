import { useState, useEffect } from 'react'
import { Typo } from '@dfragon/ui/typo'
import { primary, secondary } from './buttons.js'
import { requestOcr, OcrApiError } from './client.js'
import type { Sample } from '../src/model.js'
import { CaptureUpload } from './CaptureUpload.js'
import { SampleEditor } from './SampleEditor.js'

export function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const [samples, setSamples] = useState<Sample[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [stats, setStats] = useState<{
    captures: number
    samples: number
    pending: number
    storedBytes: number
  } | null>(null)
  const [state, setState] = useState('')
  const [kind, setKind] = useState('')
  const [split, setSplit] = useState('')
  const [offset, setOffset] = useState(0)
  const [next, setNext] = useState<number | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    void requestOcr('/api/session')
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false))
  }, [])
  useEffect(() => {
    if (authenticated !== true) {
      return
    }
    let active = true
    const query = new URLSearchParams({
      offset: String(offset),
      ...(state.length > 0 ? { state } : {}),
      ...(kind.length > 0 ? { kind } : {}),
      ...(split.length > 0 ? { split } : {})
    })
    void Promise.all([
      requestOcr<{ samples: Sample[]; nextOffset: number | null }>(`/api/samples?${query}`),
      requestOcr<NonNullable<typeof stats>>('/api/stats')
    ])
      .then(([list, counts]) => {
        if (active) {
          setSamples(list.samples)
          setNext(list.nextOffset)
          setStats(counts)
          setMessage('')
          setSelected((current) =>
            list.samples.some((sample) => sample.id === current)
              ? current
              : (list.samples[0]?.id ?? null)
          )
        }
      })
      .catch((error) => {
        if (active) {
          setMessage(
            error instanceof OcrApiError
              ? error.message
              : '처리하지 못했습니다. 다시 시도해 주세요.'
          )
          if (error instanceof OcrApiError && error.code === 'LOGIN_REQUIRED') {
            setAuthenticated(false)
          }
        }
      })
    return () => {
      active = false
    }
  }, [authenticated, state, kind, split, offset, revision])

  async function login() {
    try {
      const result = await requestOcr<{ url: string }>('/auth/login', 'POST')
      location.assign(result.url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '로그인하지 못했습니다.')
    }
  }
  function refreshSamples() {
    setRevision((current) => current + 1)
  }
  const sample = samples.find((sample) => sample.id === selected)

  return (
    <main>
      <header>
        <div>
          <div className="eyebrow">DFRAGON / DEVELOPER</div>
          <Typo.h3>OCR 자료실</Typo.h3>
          <p className="muted">수집한 장면에서, 학습할 정답까지.</p>
        </div>
        {authenticated === true && (
          <div className="actions">
            <a className={secondary} href="/api/export">
              전체 다운로드
            </a>
            <button
              className={secondary}
              onClick={() =>
                void requestOcr('/auth/logout', 'POST')
                  .then(() => {
                    setAuthenticated(false)
                    setSamples([])
                    setStats(null)
                  })
                  .catch((error) =>
                    setMessage(
                      error instanceof OcrApiError
                        ? error.message
                        : '처리하지 못했습니다. 다시 시도해 주세요.'
                    )
                  )
              }
            >
              로그아웃
            </button>
          </div>
        )}
      </header>
      <p role="alert" className="error">
        {message}
      </p>
      {authenticated === null ? (
        <p>로그인 상태를 확인하고 있습니다.</p>
      ) : !authenticated ? (
        <section className="login">
          <div className="eyebrow">PRIVATE WORKSPACE</div>
          <Typo.h4>패스키로 자료실 열기</Typo.h4>
          <p>
            기존 DFRAGON 계정으로 로그인합니다.
            <br />
            관리자로 지정한 계정만 자료를 확인하고 수정할 수 있습니다.
          </p>
          <button className={primary} onClick={() => void login()}>
            패스키 로그인
          </button>
        </section>
      ) : (
        <>
          <section className="stats" aria-label="수집 현황">
            {[
              ['원본 화면', stats?.captures ?? 0],
              ['닉네임 크롭', stats?.samples ?? 0],
              ['정답 대기', stats?.pending ?? 0],
              ['원본 용량', `${((stats?.storedBytes ?? 0) / 1024 / 1024).toFixed(1)} MiB`]
            ].map(([name, value]) => (
              <div key={name}>
                <span>{name}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
          <CaptureUpload onSaved={refreshSamples} />
          <div className="filters">
            <label>
              작성 상태
              <select
                value={state}
                onChange={(e) => {
                  setState(e.target.value)
                  setOffset(0)
                }}
              >
                <option value="">전체 상태</option>
                <option value="pending">미작성</option>
                <option value="labeled">정답 완료</option>
                <option value="excluded">제외</option>
              </select>
            </label>
            <label>
              수집 종류
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value)
                  setOffset(0)
                }}
              >
                <option value="">전체 종류</option>
                <option value="hud">HUD</option>
                <option value="participants">파티원창</option>
              </select>
            </label>
            <label>
              분할
              <select
                value={split}
                onChange={(e) => {
                  setSplit(e.target.value)
                  setOffset(0)
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
          <div className="workspace">
            <section aria-label="수집 이미지" className="gallery">
              {samples.length === 0 ? (
                <div className="empty">
                  <Typo.h5>아직 이미지가 없습니다</Typo.h5>
                  <p>
                    원본과 크롭 영역을 업로드하면 여기에 표시됩니다.
                    <br />
                    필터를 사용 중이라면 조건을 바꿔보세요.
                  </p>
                </div>
              ) : (
                samples.map((item) => (
                  <button
                    key={item.id}
                    className={`sample ${item.id === selected ? 'selected' : ''}`}
                    onClick={() => setSelected(item.id)}
                    aria-pressed={item.id === selected}
                  >
                    <div className="thumb">
                      <img
                        loading="lazy"
                        src={`/api/samples/${item.id}/image`}
                        alt={item.text ?? '미작성 닉네임'}
                      />
                    </div>
                    <strong>{item.text ?? '정답 미작성'}</strong>
                    <span>
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
                onSaved={refreshSamples}
              />
            )}
          </div>
          <nav className="pagination" aria-label="페이지">
            <button
              className={secondary}
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - 100))}
            >
              이전
            </button>
            <span>{offset / 100 + 1} 페이지</span>
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
