import { useEffect, useState } from 'react'
import type { CharacterDetailSnapshot } from '../../../preload/common/types/character-detail'

type CharacterDetailState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; snapshot: CharacterDetailSnapshot }>
  | Readonly<{ status: 'error' }>

export function useCharacterDetail(): CharacterDetailState {
  const [state, setState] = useState<CharacterDetailState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    const readSnapshot = async (): Promise<void> => {
      try {
        const snapshot = await window.characterDetail.read()
        if (active) {
          setState({ status: 'ready', snapshot })
        }
      } catch {
        if (active) {
          setState({ status: 'error' })
        }
      }
    }
    void readSnapshot()

    return () => {
      active = false
    }
  }, [])

  return state
}
