import { useState } from 'react'
import { primary, secondary } from './buttons.js'
import { requestOcr } from './client.js'

export function CaptureUpload({ onSaved }: { onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState('hud')
  const [scale, setScale] = useState('')
  const [source, setSource] = useState('game')
  const [crops, setCrops] = useState([{ slot: 1, x: 0, y: 0, width: 1, height: 1 }])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<unknown>(null)

  async function uploadCapture({ retry }: { retry: boolean }) {
    setBusy(true)
    setMessage('')
    try {
      let body = pending
      if (!retry) {
        if (file === null) {
          throw new Error('원본 PNG를 선택해 주세요.')
        }
        if (file.size > 16 * 1024 * 1024) {
          throw new Error('원본 PNG는 16 MiB 이하로 선택해 주세요.')
        }
        const originalPng = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(',')[1])
          reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'))
          reader.readAsDataURL(file)
        })
        body = {
          id: crypto.randomUUID(),
          capturedAt: new Date().toISOString(),
          kind,
          uiScale: scale === '' ? null : Number(scale) / 100,
          uiScaleSource: scale === '' ? 'unknown' : source,
          crops,
          originalPng
        }
        setPending(body)
      }
      await requestOcr('/api/captures', 'POST', body)
      setPending(null)
      setMessage('업로드했습니다. 정답을 입력할 수 있습니다.')
      onSaved()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '업로드하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="upload">
      <summary>원본 이미지 업로드</summary>
      <p>
        원본 PNG와 원본 기준 크롭 영역을 등록합니다. 수집 앱 연동 전 수동으로 자료를 추가할 수
        있습니다.
      </p>
      <div className="fields">
        <label>
          원본 PNG
          <input
            type="file"
            accept="image/png"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPending(null)
            }}
          />
        </label>
        <label>
          수집 종류
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="hud">HUD</option>
            <option value="participants">파티원창</option>
          </select>
        </label>
        <label>
          UI 크기 (%)
          <input
            type="number"
            min="1"
            max="1000"
            placeholder="모르면 비워두기"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
          />
        </label>
        <label>
          UI 크기 확인 방법
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="game">게임 설정</option>
            <option value="estimated">화면에서 추정</option>
          </select>
        </label>
      </div>
      <p>좌표와 크기는 원본 픽셀 기준입니다.</p>
      {crops.map((crop, index) => (
        <div className="crop-fields" key={crop.slot}>
          <strong>위치 {crop.slot}</strong>
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <label key={key}>
              {{ x: '왼쪽 X', y: '위쪽 Y', width: '너비', height: '높이' }[key]}
              <input
                type="number"
                min={key === 'x' || key === 'y' ? 0 : 1}
                value={crop[key]}
                onChange={(e) =>
                  setCrops((current) =>
                    current.map((item, i) =>
                      i === index ? { ...item, [key]: Number(e.target.value) } : item
                    )
                  )
                }
              />
            </label>
          ))}
        </div>
      ))}
      <div className="actions">
        <button
          className={secondary}
          disabled={busy || crops.length === 4}
          onClick={() =>
            setCrops((current) => [
              ...current,
              { slot: current.length + 1, x: 0, y: 0, width: 1, height: 1 }
            ])
          }
        >
          크롭 추가
        </button>
        <button
          className={secondary}
          disabled={busy || crops.length === 1}
          onClick={() => setCrops((current) => current.slice(0, -1))}
        >
          마지막 크롭 제거
        </button>
        <button
          className={primary}
          disabled={busy || file === null}
          onClick={() => void uploadCapture({ retry: false })}
        >
          업로드
        </button>
        {pending !== null && (
          <button
            className={secondary}
            disabled={busy}
            onClick={() => void uploadCapture({ retry: true })}
          >
            실패한 업로드 재시도
          </button>
        )}
      </div>
      <p role="status">{message}</p>
    </details>
  )
}
