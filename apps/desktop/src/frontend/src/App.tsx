import * as stylex from '@stylexjs/stylex'
import { lightTheme } from './constants/theme.stylex'
import { useColorTheme } from './hooks/useColorTheme'
import { PartyPage } from './pages/party/PartyPage'
import { LoginSection } from './sections/LoginSection'
import { styles } from './App.style'

function App(): React.JSX.Element {
  const { light } = useColorTheme()

  return (
    <main {...stylex.props(styles.app, light && lightTheme)}>
      <PartyPage
        slots={['idle', 'idle', 'idle', 'idle']}
        account={<LoginSection api={window.auth} />}
      />
      <footer {...stylex.props(styles.footer)}>
        <span>LDB Desktop</span>
        <span>검색·캡처 기능 준비 중</span>
      </footer>
    </main>
  )
}

export default App
