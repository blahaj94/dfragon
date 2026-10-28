import * as stylex from '@stylexjs/stylex'
import { useScreenCapture } from './hooks/useScreenCapture'
import { AppTopBar } from './components/AppTopBar'
import { SearchScreen } from './pages/search/SearchScreen'
import { styles } from './App.style'

function App(): React.JSX.Element {
  const { partyCapture, raidCapture, controls } = useScreenCapture()

  return (
    <main {...stylex.props(styles.app)}>
      <AppTopBar capture={partyCapture} controls={controls} />
      <SearchScreen partyCapture={partyCapture} raidCapture={raidCapture} />
    </main>
  )
}

export default App
