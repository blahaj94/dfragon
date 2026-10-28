import * as stylex from '@stylexjs/stylex'
import { AppTopBar } from './components/AppTopBar'
import { ScreenCaptureProvider } from './sections/ScreenCaptureProvider'
import { SearchScreen } from './pages/search/SearchScreen'
import { styles } from './App.style'

function App(): React.JSX.Element {
  return (
    <ScreenCaptureProvider>
      <main {...stylex.props(styles.app)}>
        <AppTopBar />
        <SearchScreen />
      </main>
    </ScreenCaptureProvider>
  )
}

export default App
