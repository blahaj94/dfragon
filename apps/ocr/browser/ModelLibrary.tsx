import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as stylex from '@stylexjs/stylex'
import type { ModelSummary } from '../src/model.js'
import { requestOcr, errorMessage } from './client.js'
import { styles } from './styles.js'
import { primary } from './buttons.js'

function getModelKindLabel(model: ModelSummary): string {
  if (model.kind === 'pretrained') {
    return '기본 모델'
  }
  if (model.kind === 'expanded') {
    return '문자 확장 모델'
  }

  return '파인튜닝 모델'
}

export function ModelLibrary() {
  const client = useQueryClient()
  const models = useQuery({
    queryKey: ['ocr', 'models'],
    queryFn: ({ signal }) =>
      requestOcr<{ models: ModelSummary[] }>('/api/models', 'GET', undefined, signal)
  })
  const addBase = useMutation({
    mutationFn: () => requestOcr('/api/models/base/korean-v5', 'POST'),
    onSuccess: () => client.invalidateQueries({ queryKey: ['ocr', 'models'] })
  })
  const error = models.error ?? addBase.error

  return (
    <details {...stylex.props(styles.upload)}>
      <summary>학습 모델 · {models.data?.models.length ?? 0}개</summary>
      <p {...stylex.props(styles.uploadParagraph)}>
        모델 파일은 자료실 서버에 보관합니다. Windows 앱에서 모델을 내려받아 학습하고, 평가한 새
        모델은 앱의 ‘미니PC에 올리기’로 등록하세요.
      </p>
      <button
        className={primary}
        disabled={addBase.isPending || models.isPending}
        onClick={() => addBase.mutate()}
      >
        {addBase.isPending ? '공식 모델을 가져오는 중…' : '기본 한국어 PP-OCRv5 모델 추가'}
      </button>
      {error !== null && (
        <p role="alert" {...stylex.props(styles.error)}>
          {errorMessage(error)}
        </p>
      )}
      {models.data?.models.map((model) => (
        <article key={model.id} {...stylex.props(styles.statCard)}>
          <strong>{model.name}</strong>
          <p {...stylex.props(styles.muted)}>
            {getModelKindLabel(model)} ·{' '}
            {(model.files.reduce((sum, file) => sum + file.bytes, 0) / 1024 / 1024).toFixed(1)} MiB
            · {new Date(model.registeredAt).toLocaleString()}
          </p>
          <div {...stylex.props(styles.actions)}>
            {model.files.map((file) => (
              <a
                key={file.name}
                {...stylex.props(styles.originalLink)}
                href={`/api/models/${model.id}/files/${file.name}`}
              >
                {file.name}
              </a>
            ))}
          </div>
        </article>
      ))}
    </details>
  )
}
