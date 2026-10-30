import { createContext } from 'react'
import { characterImageUrl } from '../../../preload/common/search/character-summary'
import type { CharacterChoice } from '../../../preload/common/types/search'

/** 후보 창이 후보 초상화를 받아 올 주소. 웹사이트 목업은 네오플 이미지 대신 번들한 그림을 넣는다. */
export const CandidateImageContext =
  createContext<(choice: CharacterChoice) => string>(characterImageUrl)
