import { PRODUCT_NAME } from '@dfragon/lib'
import { timeOfDayImages } from '@dfragon/desktop-site/time-of-day'
import * as stylex from '@stylexjs/stylex'
import { lazy, Suspense } from 'react'
import neopleOpenApiLogo from './assets/neople-open-api.png'
import { DownloadLink } from './download/DownloadLink'
import { ExternalLinkIcon } from './icons'
import { useTimeOfDay } from './useTimeOfDay'
import { styles } from './App.style'

const REPOSITORY_URL = 'https://github.com/dungeon-and-dragon/dfragon'
const NEOPLE_API_URL = 'https://developers.neople.co.kr'

// 창 목업은 Base UI와 Desktop 카드 묶음이 커서 첫 문장과 내려받기 버튼을 먼저 그린 뒤 받는다.
const WindowMockup = lazy(() => import('./WindowMockup'))

export default function App(): React.JSX.Element {
  const timeOfDay = useTimeOfDay()

  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <a href="/" {...stylex.props(styles.brand)}>
          <img src="/favicon.png" alt="" width={32} height={32} {...stylex.props(styles.icon)} />
          {PRODUCT_NAME}
        </a>
        <nav aria-label="주 메뉴" {...stylex.props(styles.nav)}>
          <a href={REPOSITORY_URL} {...stylex.props(styles.navLink)}>
            GitHub
            <ExternalLinkIcon width={14} height={14} />
          </a>
        </nav>
      </header>
      <main
        data-time-of-day={timeOfDay}
        {...stylex.props(
          styles.hero,
          styles[timeOfDay],
          styles.sky(`url("${timeOfDayImages[timeOfDay]}")`)
        )}
      >
        <section aria-labelledby="hero-title" {...stylex.props(styles.panel)}>
          <h1 id="hero-title" {...stylex.props(styles.title)}>
            파티, 공대를 쉽게 확인
          </h1>
          <DownloadLink />
        </section>
        <section aria-label={`${PRODUCT_NAME} 창 목업`} {...stylex.props(styles.mockup)}>
          <Suspense fallback={<div {...stylex.props(styles.mockupPending)} />}>
            <WindowMockup />
          </Suspense>
        </section>
      </main>
      <footer {...stylex.props(styles.footer)}>
        <a href={NEOPLE_API_URL} target="_blank" rel="noopener noreferrer">
          <img
            src={neopleOpenApiLogo}
            alt="Neople 오픈 API"
            width={191}
            height={36}
            {...stylex.props(styles.neopleLogo)}
          />
        </a>
      </footer>
    </div>
  )
}
