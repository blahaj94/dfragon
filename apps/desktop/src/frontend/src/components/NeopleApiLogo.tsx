import * as stylex from '@stylexjs/stylex'
import logo from '../../../../resources/neople-open-api-gray.png'
import { windowChromeStyles } from '../constants/window-chrome.style'
import { styles } from './NeopleApiLogo.style'

export const NEOPLE_API_URL = 'https://developers.neople.co.kr'

export function NeopleApiLogo(): React.JSX.Element {
  return (
    <a
      href={NEOPLE_API_URL}
      target="_blank"
      rel="noopener noreferrer"
      {...stylex.props(windowChromeStyles.noDrag, styles.link)}
    >
      <img src={logo} alt="Neople 오픈 API" width={86} height={24} />
    </a>
  )
}
