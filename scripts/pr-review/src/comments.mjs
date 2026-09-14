export function providerMarker(provider, headSha) {
  return `<!-- ldb-ai-review:${provider}:${headSha} -->`
}

export function buildProviderTriggerComment({ provider, headSha }) {
  const isUnsupportedProvider = provider !== 'codex'
  if (isUnsupportedProvider) {
    throw new Error(`Unsupported review provider: ${provider}`)
  }

  const triggerCommentBody = [
    providerMarker(provider, headSha),
    '@codex review 리뷰 제목과 본문은 한국어 존댓말로 작성해 주세요.',
    '',
    `_Automated advisory review request for \`${headSha}\`._`
  ].join('\n')
  return triggerCommentBody
}

export function findCommentByMarker(comments, marker) {
  const matchingComment = comments.find((comment) => {
    const hasMarker = comment.body?.includes(marker)
    return hasMarker
  })
  return matchingComment
}
