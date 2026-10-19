import { useRef, useState } from 'react'
import { paginate } from '@dfragon/lib/utils/pagination'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import type { DeveloperWorkbenchSample } from '../lib/developer-party'
import {
  nextDeveloperWorkbenchSampleId,
  queryDeveloperWorkbenchSamples,
  selectDeveloperWorkbenchSample,
  type DeveloperLabelFilter
} from '../lib/developer-workbench-samples'

const REMOTE_PAGE_SIZE = 50

/** 정답 입력 화면의 목록, 선택, 초안과 저장 동작 */
export type DeveloperLabeling = {
  filter: DeveloperLabelFilter
  /** 지금 페이지에 보이는 샘플. 로컬 자료는 나누지 않는다. */
  samples: DeveloperWorkbenchSample[]
  /** OCR 자료실을 읽는 동안 보이는 샘플이 있을 때만 있다. */
  pagination: { page: number; pageCount: number; total: number } | null
  /** 고른 평가 분할의 샘플. 평가 대상은 여기서 고른다. */
  splitSamples: DeveloperWorkbenchSample[]
  selected: DeveloperWorkbenchSample | null
  selectedNumber: number
  /** 선택한 샘플의 초안. 고친 적이 없으면 저장된 정답이다. */
  draft: string
  /** 로컬 자료에 저장하지 않은 초안이 있는지 */
  dirty: boolean
  notice: string
  /** 필터를 바꾸고 첫 페이지의 첫 샘플을 고른다. */
  changeFilter: (filter: DeveloperLabelFilter) => void
  /** 페이지를 바꾸고 선택을 비운다. */
  changePage: (page: number) => void
  select: (id: string) => void
  changeDraft: (value: string) => void
  /** 초안을 저장하고, 그 사이 선택이 바뀌지 않았으면 다음 샘플을 고른다. */
  saveAndNext: () => void
  skip: () => void
  /** 제외 여부를 바꾸고, 그 사이 선택이 바뀌지 않았으면 다음 샘플을 고른다. */
  setExcluded: (excluded: boolean) => void
  /** 자료 위치를 바꿀 때 그 위치의 필터로 첫 페이지부터 다시 보고 선택과 안내를 비운다. */
  reset: (filter: DeveloperLabelFilter) => void
  /** 자료를 다시 불러오거나 평가 분할을 바꿀 때 첫 페이지로 돌아가 선택을 비운다. */
  resetPage: () => void
  /** 탭을 바꿀 때 진행 중인 저장이 끝나도 다음 샘플로 넘어가지 않게 한다. */
  cancelAdvance: () => void
  clearNotice: () => void
}

/**
 * 개발자 작업 공간의 정답 입력. 필터, OCR 자료실 페이지, 선택, 샘플별 초안, 안내를 소유하고 로컬 자료에 정답과
 * 제외 여부를 저장한다. 저장이나 제외가 끝났을 때 그 사이 사용자가 다른 샘플, 페이지, 탭, 자료 위치로 옮기지
 * 않았을 때만 다음 샘플로 넘어간다. OCR 자료실은 읽기 전용이라 저장하지 않는다.
 */
export function useDeveloperLabeling({
  local,
  samples,
  source,
  split
}: {
  /** 로컬 자료. 정답과 제외 여부는 여기에만 저장한다. */
  local: {
    samples: readonly DeveloperSample[]
    saving: boolean
    saveLabel: (id: string, text: string | null) => Promise<DeveloperSample | null>
    setSampleExcluded: (id: string, excluded: boolean) => Promise<DeveloperSample | null>
  }
  /** 지금 자료 위치에서 읽은 샘플 */
  samples: readonly DeveloperWorkbenchSample[]
  source: 'local' | 'ocr'
  split: string
}): DeveloperLabeling {
  const [filter, setFilter] = useState<DeveloperLabelFilter>('unlabeled')
  const [remotePage, setRemotePage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 선택을 바꾸는 사용자 동작마다 올린다. 저장이 끝났을 때 값이 같아야 다음 샘플로 넘어간다.
  const selectionRevision = useRef(0)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState('')
  const readingRemote = source === 'ocr'
  const { splitSamples, visibleSamples } = queryDeveloperWorkbenchSamples({
    samples,
    source,
    split,
    labelFilter: filter
  })
  const pages = readingRemote
    ? paginate(visibleSamples, { page: remotePage, pageSize: REMOTE_PAGE_SIZE })
    : null
  const pageSamples = pages?.items ?? visibleSamples
  const pagination =
    pages != null && visibleSamples.length > 0
      ? { page: pages.currentPage, pageCount: pages.pageCount, total: visibleSamples.length }
      : null
  const { selected, selectedNumber } = selectDeveloperWorkbenchSample({
    splitSamples,
    pageSamples,
    selectedId
  })
  const draft = selected ? (drafts[selected.id] ?? selected.text ?? '') : ''
  const dirty = Object.entries(drafts).some(([id, value]) => {
    const sample = local.samples.find((row) => row.id === id)

    if (sample == null) {
      return false
    }

    if (sample.text == null) {
      return value !== ''
    }

    return value !== sample.text
  })

  function selectSample(id: string | null): void {
    selectionRevision.current += 1
    setSelectedId(id)
  }

  async function saveAndNext(): Promise<void> {
    if (readingRemote || !selected || local.saving || draft.length === 0) {
      return
    }

    const id = selected.id
    const revision = selectionRevision.current
    const nextId = nextDeveloperWorkbenchSampleId(visibleSamples, id)
    const saved = await local.saveLabel(id, draft)
    if (!saved) {
      return
    }

    setDrafts((previous) => {
      const next = { ...previous }
      delete next[id]

      return next
    })
    setNotice('정답을 저장했습니다.')
    if (revision === selectionRevision.current) {
      setSelectedId(nextId)
    }
  }

  async function setExcluded(excluded: boolean): Promise<void> {
    if (readingRemote || !selected || local.saving) {
      return
    }

    const id = selected.id
    const revision = selectionRevision.current
    const nextId = nextDeveloperWorkbenchSampleId(visibleSamples, id)
    const updated = await local.setSampleExcluded(id, excluded)
    if (!updated) {
      return
    }

    if (revision === selectionRevision.current) {
      setSelectedId(nextId)
    }
    setNotice(excluded ? '크롭을 제외했습니다.' : '크롭을 다시 포함했습니다.')
  }

  return {
    filter,
    samples: pageSamples,
    pagination,
    splitSamples,
    selected,
    selectedNumber,
    draft,
    dirty,
    notice,
    changeFilter: (nextFilter) => {
      const nextQuery = queryDeveloperWorkbenchSamples({
        samples,
        source,
        split,
        labelFilter: nextFilter
      })
      setFilter(nextFilter)
      setRemotePage(0)
      selectSample(nextQuery.visibleSamples[0]?.id ?? null)
      setNotice('')
    },
    changePage: (page) => {
      setRemotePage(page)
      selectSample(null)
    },
    select: (id) => {
      selectSample(id)
      setNotice('')
    },
    changeDraft: (value) => {
      if (selected) {
        setDrafts((previous) => ({ ...previous, [selected.id]: value }))
      }
    },
    saveAndNext: () => void saveAndNext(),
    skip: () => {
      if (!selected) {
        return
      }
      selectSample(nextDeveloperWorkbenchSampleId(visibleSamples, selected.id) ?? selected.id)
      setNotice('')
    },
    setExcluded: (excluded) => void setExcluded(excluded),
    reset: (nextFilter) => {
      setRemotePage(0)
      setFilter(nextFilter)
      selectSample(null)
      setNotice('')
    },
    resetPage: () => {
      setRemotePage(0)
      selectSample(null)
    },
    cancelAdvance: () => {
      selectionRevision.current += 1
    },
    clearNotice: () => setNotice('')
  }
}
