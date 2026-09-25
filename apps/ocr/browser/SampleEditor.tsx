import * as stylex from '@stylexjs/stylex'
import { styles } from './styles.js'
import { useSampleEditor } from './hooks/use-sample-editor.js'
import { OCR_SAMPLES } from '../src/constants.js'
import { Typo } from '@dfragon/ui/typo'
import { primary, secondary } from './buttons.js'
import type { Sample } from '../src/model.js'
import { parseSplit } from '../src/input.js'
import { OcrIcon } from './OcrIcon.js'

export function SampleEditor({ sample }: { sample: Sample }) {
  const { text, setText, message, busy, saveSample, assignNicknameSplit } = useSampleEditor(sample)

  return (
    <section {...stylex.props(styles.editor)} aria-label="정답 편집">
      <div {...stylex.props(styles.editorHeading)}>
        <Typo.h5 as="h2" {...stylex.props(styles.heading)}>
          정답 입력
        </Typo.h5>
        <span {...stylex.props(styles.badge)}>
          {sample.kind === 'hud' ? 'HUD' : '파티원창'} · 위치 {sample.slot}
        </span>
      </div>
      <div {...stylex.props(styles.largePreview)}>
        <img
          {...stylex.props(styles.previewImage)}
          src={`/api/samples/${sample.id}/image`}
          alt="정답을 입력할 닉네임 크롭"
        />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void saveSample(sample.excluded)
        }}
      >
        <label {...stylex.props(styles.label)}>
          닉네임 정답
          <input
            {...stylex.props(styles.control)}
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={OCR_SAMPLES.maximumLabelLength}
            placeholder="이미지에 보이는 그대로 입력"
          />
        </label>
        <div {...stylex.props(styles.actions, styles.editorActions)}>
          <button className={primary} disabled={busy}>
            <OcrIcon name="check" />
            정답 저장
          </button>
          <button
            type="button"
            className={secondary}
            disabled={busy}
            onClick={() => void saveSample(!sample.excluded)}
          >
            {sample.excluded ? '제외 복원' : '학습에서 제외'}
          </button>
        </div>
      </form>
      <label {...stylex.props(styles.label)}>
        닉네임 단위 분할
        <select
          {...stylex.props(styles.control)}
          value={sample.split}
          disabled={
            busy || sample.text === null || sample.text.length === 0 || text !== sample.text
          }
          onChange={(e) => void assignNicknameSplit(parseSplit(e.target.value))}
        >
          <option value="unassigned">미배정</option>
          <option>train</option>
          <option>val</option>
          <option>test</option>
        </select>
      </label>
      <p {...stylex.props(styles.paragraph, styles.muted)}>
        같은 정답 닉네임의 모든 이미지에 적용됩니다.
      </p>
      <dl {...stylex.props(styles.metadata)}>
        <div>
          <dt {...stylex.props(styles.metadataLabel)}>원본 해상도</dt>
          <dd {...stylex.props(styles.metadataValue)}>
            {sample.frameWidth} × {sample.frameHeight}
          </dd>
        </div>
        <div>
          <dt {...stylex.props(styles.metadataLabel)}>UI 크기</dt>
          <dd {...stylex.props(styles.metadataValue)}>
            {sample.uiScale === null
              ? '미상'
              : `${Math.round(sample.uiScale * 100)}% · ${sample.uiScaleSource === 'game' ? '게임 설정' : '추정'}`}
          </dd>
        </div>
        <div>
          <dt {...stylex.props(styles.metadataLabel)}>수집 시각</dt>
          <dd {...stylex.props(styles.metadataValue)}>
            {new Date(sample.capturedAt).toLocaleString('ko-KR')}
          </dd>
        </div>
        <div>
          <dt {...stylex.props(styles.metadataLabel)}>크롭 영역</dt>
          <dd {...stylex.props(styles.metadataValue)}>
            ({sample.x}, {sample.y}) · {sample.width} × {sample.height}
          </dd>
        </div>
      </dl>
      <a
        {...stylex.props(styles.originalLink)}
        href={`/api/captures/${sample.captureId}/image`}
        target="_blank"
        rel="noreferrer"
      >
        원본 화면 열기 ↗
      </a>
      <p {...stylex.props(styles.paragraph, message !== '' && styles.editorStatus)} role="status">
        {message}
      </p>
    </section>
  )
}
