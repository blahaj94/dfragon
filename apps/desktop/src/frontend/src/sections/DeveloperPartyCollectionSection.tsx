import { DEVELOPER_ERROR_CODES } from '../../../preload/common/developer-errors'
import * as stylex from '@stylexjs/stylex'
import { Typo } from '@dfragon/ui'
import { useEffect, useRef } from 'react'
import { useDeveloperPartyCollection } from '../hooks/useDeveloperPartyCollection'
import type { DeveloperPartySlotNumber } from '../lib/developer-party'
import { getDeveloperCollectionErrorMessage } from '../lib/developer-party'
import type { DeveloperCollectionKind } from '../../../preload/common/types/developer'
import { DeveloperParticipantCollectionSection } from './DeveloperParticipantCollectionSection'
import { styles } from './DeveloperPartyCollectionSection.style'
import { DeveloperUploadNotice } from '../components/DeveloperUploadNotice'

const slotNumbers: DeveloperPartySlotNumber[] = [1, 2, 3, 4]

export function DeveloperPartyCollectionSection({
  onSaved,
  slots,
  onSlotsChange,
  active,
  onDisarmed,
  kind = 'hud',
  onLabeling
}: {
  onSaved: () => void
  slots: DeveloperPartySlotNumber[]
  onSlotsChange: (slots: DeveloperPartySlotNumber[]) => void
  active: boolean
  onDisarmed: () => void
  kind?: DeveloperCollectionKind
  onLabeling?: () => void
}): React.JSX.Element | null {
  const collection = useDeveloperPartyCollection(slots, onSlotsChange, active, onDisarmed, kind)
  const onSavedRef = useRef(onSaved)
  const lastRevision = useRef<number | null>(null)
  const frame = collection.frame
  const rasterScale = frame && Number.isFinite(frame.scale) ? `${frame.scale.toFixed(2)}×` : null
  const errorCode =
    collection.collection?.error ??
    (collection.commandError ? DEVELOPER_ERROR_CODES.OPERATION_FAILED : collection.previewError)

  useEffect(() => {
    onSavedRef.current = onSaved
  }, [onSaved])

  useEffect(() => {
    const revision = collection.collection?.revision
    if (revision == null) {
      return
    }

    if (lastRevision.current == null) {
      lastRevision.current = revision
      if (revision > 0) {
        onSavedRef.current()
      }
      return
    }

    if (revision !== lastRevision.current) {
      lastRevision.current = revision
      onSavedRef.current()
    }
  }, [collection.collection?.revision])

  if (!active) {
    return null
  }

  if (kind === 'participants') {
    return <DeveloperParticipantCollectionSection collection={collection} onLabeling={onLabeling} />
  }

  return (
    <section
      role="tabpanel"
      id="developer-collection-panel"
      aria-labelledby="developer-collection-tab"
      aria-label="이미지 수집"
      {...stylex.props(styles.section)}
    >
      <div aria-live="polite" {...stylex.props(styles.connection)}>
        <DeveloperUploadNotice status={collection.collection?.upload} />
        <Typo.txtM as="p" weight={700}>
          {frame ? '게임 화면 연결됨' : '게임 화면 연결 확인 필요'}
        </Typo.txtM>
        <div {...stylex.props(styles.connectionDetails)}>
          {frame ? (
            <Typo.txtS>
              원본 {frame.width} × {frame.height}px
            </Typo.txtS>
          ) : null}
          {rasterScale && <Typo.txtS>감지 배율 {rasterScale}</Typo.txtS>}
        </div>
        {errorCode && (
          <Typo.txtS role="alert" {...stylex.props(styles.error)}>
            {getDeveloperCollectionErrorMessage(errorCode)}
          </Typo.txtS>
        )}
        {collection.slots.length === 0 && (
          <Typo.txtS role="status">저장할 크롭을 선택하세요.</Typo.txtS>
        )}
      </div>

      <div>
        <Typo.h4 as="h2">미리보기</Typo.h4>
        <div aria-label="수집할 크롭 미리보기" {...stylex.props(styles.crops)}>
          {slotNumbers.map((slotNumber) => {
            const preview = frame?.slots.find((slot) => slot.slot === slotNumber)
            const included = collection.slots.includes(slotNumber)

            return (
              <article key={slotNumber} {...stylex.props(styles.crop)}>
                <div {...stylex.props(styles.cropHeader)}>
                  <Typo.txtM as="span" weight={700}>
                    {slotNumber}
                  </Typo.txtM>
                  <input
                    type="checkbox"
                    aria-label={`${slotNumber}번 크롭 저장`}
                    checked={included}
                    {...stylex.props(styles.checkbox)}
                    onChange={(event) =>
                      collection.setSlotIncluded(slotNumber, event.target.checked)
                    }
                  />
                </div>
                <div {...stylex.props(styles.cropImageArea, !included && styles.unchecked)}>
                  {preview ? (
                    <img
                      src={preview.dataUrl}
                      alt={`${slotNumber}번 크롭 원본 미리보기`}
                      {...stylex.props(styles.cropImage)}
                    />
                  ) : (
                    <Typo.caption {...stylex.props(styles.emptyCrop)}>
                      크롭을 기다리는 중입니다.
                    </Typo.caption>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
