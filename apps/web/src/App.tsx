import { useState } from 'react'
import { ActionButton } from '@dfragon/ui'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import * as stylex from '@stylexjs/stylex'
import { styles } from './App.style'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div {...stylex.props(styles.root)}>
      <section id="center" {...stylex.props(styles.center)}>
        <div {...stylex.props(styles.hero)}>
          <img
            src={heroImg}
            {...stylex.props(styles.heroImage, styles.base)}
            width="170"
            height="179"
            alt=""
          />
          <img
            src={reactLogo}
            {...stylex.props(styles.heroImage, styles.framework)}
            alt="React logo"
          />
          <img src={viteLogo} {...stylex.props(styles.heroImage, styles.vite)} alt="Vite logo" />
        </div>
        <div>
          <h1 {...stylex.props(styles.heading, styles.title)}>Get started</h1>
          <p {...stylex.props(styles.paragraph)}>
            Edit <code {...stylex.props(styles.code)}>src/App.tsx</code> and save to test{' '}
            <code {...stylex.props(styles.code)}>HMR</code>
          </p>
        </div>
        <ActionButton type="button" onClick={() => setCount((count) => count + 1)}>
          Count is {count}
        </ActionButton>
      </section>

      <div {...stylex.props(styles.ticks)}></div>

      <section id="next-steps" {...stylex.props(styles.nextSteps)}>
        <div id="docs" {...stylex.props(styles.nextPanel, styles.docs)}>
          <svg {...stylex.props(styles.icon)} role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2 {...stylex.props(styles.heading, styles.subtitle)}>Documentation</h2>
          <p {...stylex.props(styles.paragraph)}>Your questions, answered</p>
          <ul {...stylex.props(styles.links)}>
            <li {...stylex.props(styles.linkItem)}>
              <a {...stylex.props(styles.link)} href="https://vite.dev/" target="_blank">
                <img {...stylex.props(styles.logo)} src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li {...stylex.props(styles.linkItem)}>
              <a {...stylex.props(styles.link)} href="https://react.dev/" target="_blank">
                <img {...stylex.props(styles.buttonIcon)} src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social" {...stylex.props(styles.nextPanel)}>
          <svg {...stylex.props(styles.icon)} role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2 {...stylex.props(styles.heading, styles.subtitle)}>Connect with us</h2>
          <p {...stylex.props(styles.paragraph)}>Join the Vite community</p>
          <ul {...stylex.props(styles.links)}>
            <li {...stylex.props(styles.linkItem)}>
              <a
                {...stylex.props(styles.link)}
                href="https://github.com/vitejs/vite"
                target="_blank"
              >
                <svg
                  {...stylex.props(styles.buttonIcon, styles.socialIcon)}
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li {...stylex.props(styles.linkItem)}>
              <a {...stylex.props(styles.link)} href="https://chat.vite.dev/" target="_blank">
                <svg
                  {...stylex.props(styles.buttonIcon, styles.socialIcon)}
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li {...stylex.props(styles.linkItem)}>
              <a {...stylex.props(styles.link)} href="https://x.com/vite_js" target="_blank">
                <svg
                  {...stylex.props(styles.buttonIcon, styles.socialIcon)}
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li {...stylex.props(styles.linkItem)}>
              <a
                {...stylex.props(styles.link)}
                href="https://bsky.app/profile/vite.dev"
                target="_blank"
              >
                <svg
                  {...stylex.props(styles.buttonIcon, styles.socialIcon)}
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div {...stylex.props(styles.ticks)}></div>
      <section id="spacer" {...stylex.props(styles.spacer)}></section>
    </div>
  )
}

export default App
