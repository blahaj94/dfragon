import * as stylex from '@stylexjs/stylex'
import { styles } from './styles.js'
import { useCaptureUpload } from './hooks/use-capture-upload.js'
import { OCR_UPLOAD } from '../src/constants.js'
import { primary, secondary } from './buttons.js'

export function CaptureUpload() {
  const {
    file,
    setFile,
    kind,
    setKind,
    scale,
    setScale,
    source,
    setSource,
    crops,
    setCrops,
    pending,
    setPending,
    message,
    busy,
    uploadCapture
  } = useCaptureUpload()

  return (
    <details {...stylex.props(styles.upload)}>
      <summary {...stylex.props(styles.uploadSummary)}>원본 이미지 업로드</summary>
      <p {...stylex.props(styles.paragraph, styles.uploadParagraph)}>
        원본 PNG와 원본 기준 크롭 영역을 등록합니다. 수집 앱 연동 전 수동으로 자료를 추가할 수
        있습니다.
      </p>
      <div {...stylex.props(styles.fields)}>
        <label {...stylex.props(styles.label)}>
          원본 PNG
          <input
            {...stylex.props(styles.control)}
            type="file"
            accept="image/png"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPending(null)
            }}
          />
        </label>
        <label {...stylex.props(styles.label)}>
          수집 종류
          <select
            {...stylex.props(styles.control)}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="hud">HUD</option>
            <option value="participants">파티원창</option>
          </select>
        </label>
        <label {...stylex.props(styles.label)}>
          UI 크기 (%)
          <input
            {...stylex.props(styles.control)}
            type="number"
            min="1"
            max="1000"
            placeholder="모르면 비워두기"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
          />
        </label>
        <label {...stylex.props(styles.label)}>
          UI 크기 확인 방법
          <select
            {...stylex.props(styles.control)}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="game">게임 설정</option>
            <option value="estimated">화면에서 추정</option>
          </select>
        </label>
      </div>
      <p {...stylex.props(styles.paragraph, styles.uploadParagraph)}>
        좌표와 크기는 원본 픽셀 기준입니다.
      </p>
      {crops.map((crop, index) => (
        <div {...stylex.props(styles.cropFields)} key={crop.slot}>
          <strong {...stylex.props(styles.cropHeading)}>위치 {crop.slot}</strong>
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <label {...stylex.props(styles.label)} key={key}>
              {{ x: '왼쪽 X', y: '위쪽 Y', width: '너비', height: '높이' }[key]}
              <input
                {...stylex.props(styles.control)}
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
      <div {...stylex.props(styles.actions)}>
        <button
          className={secondary}
          disabled={busy || crops.length === OCR_UPLOAD.maximumCrops}
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
      <p {...stylex.props(styles.paragraph, styles.uploadParagraph)} role="status">
        {message}
      </p>
    </details>
  )
}
