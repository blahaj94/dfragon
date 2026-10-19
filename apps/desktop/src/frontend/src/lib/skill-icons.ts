import skillIcons from '@dfragon/icons/skills.json'

// `@dfragon/icons`의 스킬 아이콘 PNG. 작은 그림도 JS에 data URI로 넣지 않고 파일로 둔다.
const iconUrls = import.meta.glob<string>('../../../../../../packages/icons/skills/*.png', {
  eager: true,
  query: '?no-inline',
  import: 'default'
})
const iconFiles: Readonly<Record<string, string>> = skillIcons.icons

/** 직업의 스킬 아이콘 URL. 아이콘을 뽑지 못한 스킬이면 undefined다. */
export function skillIconUrl(jobId: string, skillId: string): string | undefined {
  const key = `${jobId}/${skillId}`
  if (!Object.hasOwn(iconFiles, key)) {
    return undefined
  }

  return iconUrls[`../../../../../../packages/icons/skills/${iconFiles[key]}`]
}
