export type CtcCandidate = {
  rank: number
  /** 문자열의 CTC 경로 확률 합 × 100이며, 실제 정답률이나 후보 내 상대 비율은 아니다. */
  modelScore: number
  nickname: string
}

const RESULT_COUNT = 5
const BEAM_WIDTH = 32
const TOKENS_PER_STEP = 16
const PROBABILITY_SUM_TOLERANCE = 1e-3
const LOG_ZERO = Number.NEGATIVE_INFINITY

type Frame = {
  offset: number
  logNormalizer: number
  tokens: number[]
  logProbabilities: Map<number, number>
}

type Prefix = { nickname: string; tokens: readonly number[] }
type Beam = Prefix & { blank: number; nonBlank: number; score: number }

/** 제한된 prefix beam으로 후보를 찾고, 각 문자열의 모든 CTC 경로를 재계산해 최대 5개를 반환한다. */
export function decodeCtcCandidates(
  data: Float32Array,
  steps: number,
  characters: readonly string[]
): CtcCandidate[] {
  const classes = characters.length + 1
  if (!Number.isSafeInteger(steps) || steps < 0 || data.length !== steps * classes) {
    throw new Error('OCR model output shape mismatch.')
  }

  if (
    new Set(characters).size !== characters.length ||
    characters.some(
      (character) => [...character].length !== 1 || /[\uD800-\uDFFF]/u.test(character)
    )
  ) {
    throw new Error('CTC labels must be unique Unicode characters.')
  }
  const frames = collectFrames(data, steps, classes)
  let beams: Beam[] = [{ nickname: '', tokens: [], blank: 0, nonBlank: LOG_ZERO, score: 0 }]

  for (const frame of frames) {
    const next = new Map<string, Beam>()
    const blank = logProbability(data, frame, 0)
    for (const beam of beams) {
      addPath(next, beam, 'blank', beam.score + blank)
      const lastToken = beam.tokens.at(-1)
      if (lastToken != null) {
        // 상위 문자에서 탈락했더라도 같은 문자의 연속 출력은 현재 prefix에 합산한다.
        addPath(next, beam, 'nonBlank', beam.nonBlank + logProbability(data, frame, lastToken))
      }
      for (const token of frame.tokens) {
        const previousScore = token === lastToken ? beam.blank : beam.score
        const score = previousScore + logProbability(data, frame, token)
        if (score === LOG_ZERO) {
          continue
        }
        const nickname = beam.nickname + characters[token - 1]
        const tokens = [...beam.tokens, token]
        addPath(next, { nickname, tokens }, 'nonBlank', score)
      }
    }
    beams = [...next.values()]
    for (const beam of beams) {
      beam.score = addLogProbabilities(beam.blank, beam.nonBlank)
    }
    beams.sort(compareBeams)
    beams.length = Math.min(beams.length, BEAM_WIDTH)
  }

  // 탐색 중 잘린 경로까지 포함해 남은 모든 문자열을 채점한 뒤 최종 순위를 정한다.
  for (const beam of beams) {
    beam.score = scoreSequence(data, frames, beam.tokens)
  }
  beams.sort(compareBeams)

  return beams.slice(0, RESULT_COUNT).map((beam, index) => {
    const rank = index + 1
    const modelScore = Math.min(100, Math.exp(beam.score) * 100)
    const nickname = beam.nickname

    return { rank, modelScore, nickname }
  })
}

/** 전체 확률을 검사하되 전체 문자 정렬 대신 고정 크기의 상위 문자 배열만 유지한다. */
function collectFrames(data: Float32Array, steps: number, classes: number): Frame[] {
  const frames: Frame[] = []
  for (let step = 0; step < steps; step += 1) {
    const offset = step * classes
    const tokens: number[] = []
    let sum = 0
    for (let token = 0; token < classes; token += 1) {
      const probability = data[offset + token]
      if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
        throw new Error('CTC decoding requires softmax probabilities.')
      }
      sum += probability
      if (token === 0 || probability === 0) {
        continue
      }

      if (
        tokens.length === TOKENS_PER_STEP &&
        probability <= data[offset + tokens[tokens.length - 1]]
      ) {
        continue
      }
      let position = tokens.length
      while (position > 0 && probability > data[offset + tokens[position - 1]]) {
        position -= 1
      }
      tokens.splice(position, 0, token)
      if (tokens.length > TOKENS_PER_STEP) {
        tokens.pop()
      }
    }
    if (Math.abs(sum - 1) > PROBABILITY_SUM_TOLERANCE) {
      throw new Error('CTC probabilities must sum to one at each step.')
    }
    // float32 softmax의 작은 합계 오차만 보정한다. logits에 softmax를 다시 적용하지 않는다.
    const logNormalizer = Math.log(sum)
    frames.push({ offset, logNormalizer, tokens, logProbabilities: new Map() })
  }

  return frames
}

/** 재등장한 문자의 log 확률을 재사용하며, 사전 가지치기 밖의 문자도 원본에서 읽는다. */
function logProbability(data: Float32Array, frame: Frame, token: number): number {
  const cached = frame.logProbabilities.get(token)
  if (cached != null) {
    return cached
  }
  const value = data[frame.offset + token]
  const score = value === 0 ? LOG_ZERO : Math.log(value) - frame.logNormalizer
  frame.logProbabilities.set(token, score)

  return score
}

/** 같은 prefix의 blank 종료와 문자 종료 확률을 각각 합산한다. */
function addPath(
  beams: Map<string, Beam>,
  prefix: Prefix,
  ending: 'blank' | 'nonBlank',
  score: number
): void {
  if (score === LOG_ZERO) {
    return
  }
  let beam = beams.get(prefix.nickname)
  if (beam == null) {
    beam = { ...prefix, blank: LOG_ZERO, nonBlank: LOG_ZERO, score: LOG_ZERO }
    beams.set(prefix.nickname, beam)
  }
  beam[ending] = addLogProbabilities(beam[ending], score)
}

/** 작은 경로 확률을 직접 곱하지 않고 log-sum-exp로 합산한다. */
function addLogProbabilities(left: number, right: number): number {
  if (left === LOG_ZERO) {
    return right
  }

  if (right === LOG_ZERO) {
    return left
  }
  const maximum = Math.max(left, right)
  const minimum = Math.min(left, right)

  return maximum + Math.log1p(Math.exp(minimum - maximum))
}

/** 점수 내림차순, 동점은 사전 token 순서로 정렬해 실행 환경에 따른 순위 차이를 막는다. */
function compareBeams(left: Beam, right: Beam): number {
  if (left.score !== right.score) {
    return right.score - left.score
  }
  const count = Math.min(left.tokens.length, right.tokens.length)
  for (let index = 0; index < count; index += 1) {
    if (left.tokens[index] !== right.tokens[index]) {
      return left.tokens[index] - right.tokens[index]
    }
  }

  return left.tokens.length - right.tokens.length
}

/** blank를 사이에 둔 상태열에서 stay, 한 칸 이동, 허용된 두 칸 이동을 모두 더한다. */
function scoreSequence(
  data: Float32Array,
  frames: readonly Frame[],
  tokens: readonly number[]
): number {
  const labels = [0]
  for (const token of tokens) {
    labels.push(token, 0)
  }
  let previous = new Float64Array(labels.length).fill(LOG_ZERO)
  previous[0] = 0
  for (const frame of frames) {
    const next = new Float64Array(labels.length).fill(LOG_ZERO)
    for (let state = 0; state < labels.length; state += 1) {
      let score = previous[state]
      if (state > 0) {
        score = addLogProbabilities(score, previous[state - 1])
      }

      if (state > 1 && labels[state] !== 0 && labels[state] !== labels[state - 2]) {
        score = addLogProbabilities(score, previous[state - 2])
      }
      next[state] = score + logProbability(data, frame, labels[state])
    }
    previous = next
  }
  if (tokens.length === 0) {
    return previous[0]
  }

  return addLogProbabilities(previous[previous.length - 1], previous[previous.length - 2])
}
