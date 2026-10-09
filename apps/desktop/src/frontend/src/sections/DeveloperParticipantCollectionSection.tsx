import { DEVELOPER_ERROR_CODES } from '../../../preload/common/developer-errors'
import * as stylex from '@stylexjs/stylex'
import { ActionButton, Typo } from '@dfragon/ui'
import { Badge, Checkbox } from '@seed-design/react'
import type { useDeveloperPartyCollection } from '../hooks/useDeveloperPartyCollection'
import { getParticipantPreviewMessage } from '../lib/developer-participants'
import { styles } from './DeveloperParticipantCollectionSection.style'
import { CheckIcon } from '../components/CheckIcon'
import { DEVELOPER_COLLECTION_SLOTS } from '../../../preload/common/developer-collection'
import type { DeveloperCollectionKind } from '../../../preload/common/types/developer'

function getWindowImageAlt(raid: boolean): string {
  if (raid) {
    return '검출된 공대 상세 창 원본'
  }

  return '검출된 파티참가인원 창 원본'
}

function getRowUnit(raid: boolean): string {
  if (raid) {
    return '행'
  }

  return '번'
}

export function DeveloperParticipantCollectionSection({
  collection,
  kind,
  onLabeling
}: {
  collection: ReturnType<typeof useDeveloperPartyCollection>
  kind: Exclude<DeveloperCollectionKind, 'hud'>
  onLabeling?: () => void
}): React.JSX.Element {
  const raid = kind === 'raid'
  const windowName = raid ? '공대원창' : '파티원창'
  const frame = collection.frame
  const popup = frame?.participantWindow
  const occupiedCount = frame?.slots.length ?? 0
  const count = frame?.slots.filter(({ slot }) => collection.slots.includes(slot)).length ?? 0
  const collectionError = collection.collection?.error
  let error: string
  if (collection.commandError) {
    error = DEVELOPER_ERROR_CODES.OPERATION_FAILED
  } else if (collectionError === DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE) {
    error = collection.previewError || collectionError
  } else {
    error = collectionError || collection.previewError
  }
  const message = getParticipantPreviewMessage(
    error || (popup && count === 0 ? DEVELOPER_ERROR_CODES.PARTY_SLOTS_NOT_FOUND : ''),
    kind
  )
  const saved = collection.collection?.lastSavedCount ?? 0
  const connected =
    popup != null ||
    collection.previewError === DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_NOT_FOUND ||
    collection.previewError === DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_UNCERTAIN ||
    collection.previewError === DEVELOPER_ERROR_CODES.RAID_WINDOW_NOT_FOUND ||
    collection.previewError === DEVELOPER_ERROR_CODES.RAID_WINDOW_UNCERTAIN

  return (
    <section
      role="tabpanel"
      id={`developer-${kind}-panel`}
      aria-labelledby={`developer-${kind}-tab`}
      {...stylex.props(styles.section)}
    >
      <div {...stylex.props(styles.connection)}>
        <div {...stylex.props(styles.connectionText)}>
          <Typo.h6 as="p">
            {connected ? (
              <>
                <span {...stylex.props(styles.connectedDot)}>●</span> 던전앤파이터 연결됨
              </>
            ) : (
              '던전앤파이터 연결 확인 중'
            )}
          </Typo.h6>
          <Typo.txtS {...stylex.props(styles.muted)}>
            {frame
              ? `원본 ${frame.width} × ${frame.height}px`
              : '게임 창이 보이면 자동으로 연결합니다.'}
          </Typo.txtS>
        </div>
        <Badge
          size="large"
          variant="weak"
          tone={popup ? 'positive' : 'warning'}
          {...stylex.props(styles.badge, popup ? styles.badgeFound : styles.badgeSearching)}
        >
          <span aria-hidden="true" {...stylex.props(styles.badgeDot)} />
          {windowName} {popup ? '찾음' : '찾는 중'}
        </Badge>
      </div>

      <div {...stylex.props(styles.heading)}>
        <Typo.h5 as="h2">{windowName} 크롭</Typo.h5>
        <Typo.txtS {...stylex.props(styles.muted)}>닉네임 영역과 저장할 행을 확인하세요.</Typo.txtS>
      </div>

      <div {...stylex.props(styles.saveGuide)}>
        <kbd {...stylex.props(styles.keycap)}>Print Screen</kbd>
        <div {...stylex.props(styles.guideText)}>
          <Typo.h6 as="p">현재 저장 대상 {count}개</Typo.h6>
          <Typo.txtS {...stylex.props(styles.muted)}>
            {raid
              ? '게임에서 Print Screen을 누르면 선택한 행 저장'
              : '게임에서 Print Screen을 누르면 저장'}
          </Typo.txtS>
        </div>
      </div>

      {(error || (popup && count === 0) || saved > 0) && (
        <div role="status" {...stylex.props(styles.notice)}>
          {saved > 0 && <Typo.txtS>닉네임 {saved}개를 저장했습니다.</Typo.txtS>}
          {(error || (popup && count === 0)) && (
            <>
              <Typo.txtS weight={700}>{message.title}</Typo.txtS>
              {message.detail && <Typo.caption>{message.detail}</Typo.caption>}
            </>
          )}
          {saved > 0 && onLabeling && (
            <ActionButton
              size="small"
              variant="neutralWeak"
              {...stylex.props(styles.secondaryButton)}
              onClick={onLabeling}
            >
              정답 입력으로
            </ActionButton>
          )}
        </div>
      )}

      <div {...stylex.props(styles.previews)}>
        <div {...stylex.props(styles.windowPanel)}>
          <div {...stylex.props(styles.windowHeader)}>
            <Typo.txtM weight={700}>검출된 {windowName}</Typo.txtM>
            {raid && popup && (
              <Typo.caption {...stylex.props(styles.muted)}>{occupiedCount} / 12명</Typo.caption>
            )}
          </div>
          <div {...stylex.props(styles.windowArea)}>
            {popup ? (
              <div {...stylex.props(styles.windowImage)}>
                <img
                  src={popup.dataUrl}
                  alt={getWindowImageAlt(raid)}
                  {...stylex.props(styles.dialog)}
                />
                {popup.rows
                  .filter((row) => row.occupied)
                  .map((row) => (
                    <span
                      key={row.slot}
                      aria-hidden="true"
                      {...stylex.props(styles.outline)}
                      style={{
                        left: `${(row.x / popup.width) * 100}%`,
                        top: `${(row.y / popup.height) * 100}%`,
                        width: `${(row.width / popup.width) * 100}%`,
                        height: `${(row.height / popup.height) * 100}%`
                      }}
                    />
                  ))}
              </div>
            ) : (
              <div role="status" {...stylex.props(styles.placeholder)}>
                <Typo.txtM weight={700}>{message.title}</Typo.txtM>
                <Typo.txtS>{message.detail}</Typo.txtS>
              </div>
            )}
          </div>
          <Typo.caption {...stylex.props(styles.legend)}>
            <span aria-hidden="true" {...stylex.props(styles.swatch)} />
            닉네임 영역
          </Typo.caption>
        </div>
        <div aria-label="행별 닉네임 크롭" {...stylex.props(styles.rows, raid && styles.raidRows)}>
          {DEVELOPER_COLLECTION_SLOTS[kind].map((slot) => {
            const crop = frame?.slots.find((row) => row.slot === slot)
            const included = collection.slots.includes(slot)
            let rowLabel: string
            if (crop) {
              rowLabel = included ? '저장 포함' : '저장 안 함'
            } else if (popup) {
              rowLabel = raid ? '빈 행' : '빈 행 · 저장 안 함'
            } else {
              rowLabel = '검출 대기'
            }
            let emptyMessage = ''
            if (!crop) {
              if (raid) {
                emptyMessage = popup ? '저장할 닉네임 없음' : '검출 대기 중'
              } else {
                emptyMessage = popup ? '저장할 닉네임이 없습니다' : '닉네임을 기다리고 있습니다'
              }
            }

            return (
              <article key={slot} {...stylex.props(styles.row, raid && styles.raidRow)}>
                <Checkbox.Root.Primitive
                  checked={included && (!raid || crop != null)}
                  disabled={!crop}
                  onCheckedChange={(checked) => collection.setSlotIncluded(slot, checked)}
                  {...stylex.props(
                    styles.rowHeader,
                    raid && styles.raidRowHeader,
                    !crop && styles.rowHeaderDisabled
                  )}
                >
                  <Typo.txtS weight={700}>
                    {slot}
                    {raid ? '행' : '번'}
                  </Typo.txtS>
                  <Typo.caption {...stylex.props(styles.rowLabel)}>{rowLabel}</Typo.caption>
                  <Checkbox.Control>
                    <Checkbox.Indicator checked={<CheckIcon />} />
                  </Checkbox.Control>
                  <Checkbox.HiddenInput
                    aria-label={
                      raid ? `${slot}행 공대원 닉네임 저장` : `${slot}번 파티원 닉네임 저장`
                    }
                  />
                </Checkbox.Root.Primitive>
                <div {...stylex.props(styles.cropArea, crop && !included && styles.unchecked)}>
                  {crop ? (
                    <img
                      src={crop.dataUrl}
                      alt={`${slot}${getRowUnit(raid)} 닉네임 원본 크롭`}
                      {...stylex.props(styles.cropImage)}
                    />
                  ) : (
                    <Typo.caption {...stylex.props(styles.muted)}>{emptyMessage}</Typo.caption>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </div>
      <div {...stylex.props(styles.footnotes)}>
        <Typo.caption>미리보기는 캡처 주기마다 갱신, 저장은 원본 크기</Typo.caption>
        <Typo.caption>
          {raid
            ? '선택은 화면의 행 위치 기준, 빈 행은 저장하지 않음'
            : '빈 행은 건너뛰고 행 번호는 유지'}
        </Typo.caption>
      </div>
    </section>
  )
}
