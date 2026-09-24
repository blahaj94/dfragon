import { useEffect, useRef, useState, type PointerEvent } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, TextField, TextFieldInput, Typo } from '@dfragon/ui'
import {
  cropDeveloperImage,
  developerDragRegion,
  readDeveloperFile,
  readDeveloperImage,
  validDeveloperCrop
} from '../lib/developer-images'
import type { Rectangle } from '../types/capture'
import { styles } from './DeveloperCropEditor.style'

export function DeveloperCropEditor({
  saving,
  onSave
}: {
  saving: boolean
  onSave: (pngDataUrl: string) => Promise<boolean>
}): React.JSX.Element {
  const [source, setSource] = useState<HTMLCanvasElement | null>(null)
  const [image, setImage] = useState('')
  const [region, setRegion] = useState<Rectangle>({ x: 0, y: 0, width: 1, height: 1 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const loading = useRef(false)
  const generation = useRef(0)
  const drag = useRef<{ x: number; y: number } | null>(null)
  useEffect(
    () => () => {
      generation.current += 1
    },
    []
  )

  async function load(read: () => Promise<HTMLCanvasElement>): Promise<void> {
    if (loading.current) {
      return
    }
    loading.current = true
    const current = ++generation.current
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const canvas = await read()
      if (current !== generation.current) {
        return
      }
      setSource(canvas)
      setImage(canvas.toDataURL('image/png'))
      setRegion((previous) =>
        validDeveloperCrop(previous, canvas.width, canvas.height) && source != null
          ? previous
          : { x: 0, y: 0, width: canvas.width, height: canvas.height }
      )
    } catch {
      if (current === generation.current) {
        setError(
          '이미지를 가져오지 못했습니다. 파일은 16MB 이하 PNG·JPEG·WebP, 한 변 8192px·총 3300만 픽셀 이하여야 합니다. 화면 캡처는 Windows에서 사용할 수 있습니다.'
        )
      }
    } finally {
      loading.current = false
      if (current === generation.current) {
        setBusy(false)
      }
    }
  }

  function point(event: PointerEvent<HTMLImageElement>): { x: number; y: number } {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: Math.max(
        0,
        Math.min(
          source!.width,
          Math.round(((event.clientX - bounds.left) * source!.width) / bounds.width)
        )
      ),
      y: Math.max(
        0,
        Math.min(
          source!.height,
          Math.round(((event.clientY - bounds.top) * source!.height) / bounds.height)
        )
      )
    }
  }

  async function save(): Promise<void> {
    if (source == null || saving || loading.current) {
      return
    }
    setError('')
    setNotice('')
    try {
      const crop = cropDeveloperImage(source, region)
      const saved = await onSave(crop.toDataURL('image/png'))
      if (saved) {
        setNotice('테스트 이미지를 저장했습니다. 옆에서 정답을 입력하세요.')
      }
    } catch {
      setError('원본 안의 유효한 영역을 지정해 주세요.')
    }
  }

  return (
    <section aria-label="테스트 이미지 만들기" {...stylex.props(styles.panel)}>
      <Typo.h4 as="h2">테스트 이미지 만들기</Typo.h4>
      <Typo.txtS {...stylex.props(styles.muted)}>
        화면이나 파일에서 닉네임 한 줄을 잘라 저장하세요. 저장 전에는 원본 화면을 디스크에 기록하지
        않습니다.
      </Typo.txtS>
      <div {...stylex.props(styles.actions)}>
        <ActionButton
          size="small"
          variant="neutralWeak"
          disabled={busy || saving}
          loading={busy}
          onClick={() =>
            void load(async () =>
              readDeveloperImage((await window.developer.captureFrame()).pngDataUrl)
            )
          }
        >
          화면 가져오기
        </ActionButton>
        <Typo.caption>Windows 주 모니터 · dfragon 창은 잠시 숨겨집니다.</Typo.caption>
      </div>
      <label>
        <Typo.txtS as="span">이미지 파일 가져오기</Typo.txtS>
        <input
          {...stylex.props(styles.file)}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy || saving}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) {
              void load(() => readDeveloperFile(file))
            }
          }}
        />
      </label>
      {source && (
        <>
          <div {...stylex.props(styles.preview)}>
            <img
              src={image}
              alt="크롭 원본. 드래그하거나 아래 좌표를 입력해 영역을 지정하세요."
              draggable={false}
              {...stylex.props(styles.image)}
              onPointerDown={(event) => {
                if (busy || saving) {
                  return
                }
                drag.current = point(event)
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                if (drag.current) {
                  setRegion(developerDragRegion(drag.current, point(event)))
                }
              }}
              onPointerUp={(event) => {
                if (drag.current) {
                  setRegion(developerDragRegion(drag.current, point(event)))
                }
                drag.current = null
              }}
              onPointerCancel={() => {
                drag.current = null
              }}
            />
            <div
              {...stylex.props(
                styles.selection(
                  (region.x / source.width) * 100,
                  (region.y / source.height) * 100,
                  (region.width / source.width) * 100,
                  (region.height / source.height) * 100
                )
              )}
            />
          </div>
          <Typo.caption>
            원본 {source.width}×{source.height}px · 선택 {region.width}×{region.height}px
          </Typo.caption>
          <div {...stylex.props(styles.coordinates)}>
            {(['x', 'y', 'width', 'height'] as const).map((field) => (
              <TextField
                key={field}
                label={{ x: 'X 좌표', y: 'Y 좌표', width: '너비', height: '높이' }[field]}
              >
                <TextFieldInput
                  type="number"
                  min={field === 'x' || field === 'y' ? 0 : 1}
                  step={1}
                  value={Number.isNaN(region[field]) ? '' : region[field]}
                  disabled={busy || saving}
                  onChange={(event) =>
                    setRegion({ ...region, [field]: event.target.valueAsNumber })
                  }
                />
              </TextField>
            ))}
          </div>
          <ActionButton
            size="small"
            disabled={busy || saving || !validDeveloperCrop(region, source.width, source.height)}
            loading={saving}
            onClick={() => void save()}
          >
            크롭 저장
          </ActionButton>
        </>
      )}
      {error && (
        <Typo.txtS role="alert" {...stylex.props(styles.error)}>
          {error}
        </Typo.txtS>
      )}
      {notice && <Typo.txtS role="status">{notice}</Typo.txtS>}
    </section>
  )
}
