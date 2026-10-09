import * as stylex from '@stylexjs/stylex'
import { styles } from './styles.js'
import { useCaptureUpload } from './hooks/use-capture-upload.js'
import { OCR_UPLOAD } from '../src/constants.js'
import { OCR_DATA_LIMITS } from '@dfragon/lib/ocr-contract'
import { UI_SCALE_PERCENT } from './constants.js'
import { parseCaptureKind } from '../src/input.js'
import { primary, secondary, secondarySmall } from './buttons.js'
import { Typo } from '@dfragon/ui/typo'
import { OcrIcon } from './OcrIcon.js'

export function CaptureUpload({ open, onClose }: { open: boolean; onClose(): void }) {
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
    submission,
    message,
    failed,
    busy,
    uploadNew,
    retryPrevious
  } = useCaptureUpload()
  const maximumCrops = OCR_UPLOAD.maximumCropsByKind[kind]
  const maximumUiPercent = OCR_DATA_LIMITS.maximumUiScale * UI_SCALE_PERCENT
  const slots = Array.from({ length: maximumCrops }, (_, index) => index + 1)

  return (
    <section
      id="capture-upload"
      hidden={!open}
      aria-labelledby="capture-upload-title"
      {...stylex.props(styles.upload)}
    >
      <div {...stylex.props(styles.uploadHeader)}>
        <div {...stylex.props(styles.uploadHeading)}>
          <span {...stylex.props(styles.accent)}>
            <OcrIcon name="upload" size={22} />
          </span>
          <Typo.h5 as="h2" id="capture-upload-title">
            원본 이미지 업로드
          </Typo.h5>
        </div>
        <button type="button" className={secondarySmall} onClick={onClose}>
          접기
        </button>
      </div>
      <p {...stylex.props(styles.paragraph, styles.uploadParagraph)}>원본 PNG와 크롭 영역 등록</p>
      <div {...stylex.props(styles.fields)}>
        <label {...stylex.props(styles.label)}>
          원본 PNG
          <input
            {...stylex.props(styles.control, styles.fileInput)}
            type="file"
            accept="image/png"
            disabled={busy}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
            }}
          />
        </label>
        <label {...stylex.props(styles.label)}>
          수집 종류
          <select
            {...stylex.props(styles.control, styles.select)}
            value={kind}
            disabled={busy}
            onChange={(e) => setKind(parseCaptureKind(e.target.value))}
          >
            <option value="hud">HUD</option>
            <option value="participants">파티원창</option>
            <option value="raid">공대원창</option>
          </select>
        </label>
        <label {...stylex.props(styles.label)}>
          UI 크기 (%)
          <input
            {...stylex.props(styles.control)}
            type="number"
            min="1"
            max={maximumUiPercent}
            placeholder="모르면 비워두기"
            value={scale}
            onChange={(e) => setScale(e.target.value)}
          />
        </label>
        <label {...stylex.props(styles.label)}>
          UI 크기 확인 방법
          <select
            {...stylex.props(styles.control, styles.select)}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="game">게임 설정</option>
            <option value="estimated">화면에서 추정</option>
          </select>
        </label>
      </div>
      <div {...stylex.props(styles.cropSection)}>
        <Typo.h6 as="h3">크롭 영역</Typo.h6>
        <p {...stylex.props(styles.paragraph, styles.cropDescription)}>
          좌표와 크기는 원본 픽셀 기준 · 최대 {maximumCrops}개
        </p>
        {crops.map((crop, index) => (
          <div {...stylex.props(styles.cropFields)} key={crop.slot}>
            <label {...stylex.props(styles.label, styles.cropPosition)}>
              위치
              <select
                {...stylex.props(styles.control, styles.select)}
                aria-label={`크롭 ${index + 1} 위치`}
                value={crop.slot}
                disabled={busy}
                onChange={(e) => {
                  const slot = Number(e.target.value)
                  setCrops((current) =>
                    current.map((item, i) => {
                      if (i !== index) {
                        return item
                      }
                      const updatedCrop = { ...item, slot }

                      return updatedCrop
                    })
                  )
                }}
              >
                {slots.map((slot) => (
                  <option
                    key={slot}
                    value={slot}
                    disabled={crops.some((item, i) => i !== index && item.slot === slot)}
                  >
                    {slot}
                  </option>
                ))}
              </select>
            </label>
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
                      current.map((item, i) => {
                        if (i !== index) {
                          return item
                        }
                        const updatedCrop = { ...item }
                        const fieldValue = Number(e.target.value)
                        updatedCrop[key] = fieldValue

                        return updatedCrop
                      })
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
            disabled={busy || crops.length >= maximumCrops}
            onClick={() =>
              setCrops((current) => {
                const slot = slots.find((slot) => !current.some((crop) => crop.slot === slot))

                if (slot === undefined) {
                  return current
                }

                return [...current, { slot, x: 0, y: 0, width: 1, height: 1 }]
              })
            }
          >
            <OcrIcon name="plus" />
            크롭 추가
          </button>
          <button
            className={secondary}
            disabled={busy || crops.length === 1}
            onClick={() => setCrops((current) => current.slice(0, -1))}
          >
            마지막 크롭 제거
          </button>
        </div>
      </div>
      <div {...stylex.props(styles.uploadFooter)}>
        <span {...stylex.props(styles.muted)}>등록 후 자료실에서 정답 입력</span>
        <div {...stylex.props(styles.actions)}>
          {submission !== null && (
            <button className={secondary} disabled={busy} onClick={retryPrevious}>
              실패한 업로드 재시도
            </button>
          )}
          <button className={primary} disabled={busy || file === null} onClick={uploadNew}>
            <OcrIcon name="upload" />
            {busy ? '업로드 중' : '업로드'}
          </button>
        </div>
      </div>
      <p
        {...stylex.props(
          styles.paragraph,
          message !== '' && styles.uploadStatus,
          failed && styles.failedStatus
        )}
        role="status"
      >
        {message}
      </p>
    </section>
  )
}
