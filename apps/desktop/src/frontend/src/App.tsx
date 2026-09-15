import { ExampleSection } from '@ldb/ui'
import { ManualSearch } from './search/ManualSearch'
import { AuthBridge } from './auth/AuthBridge'
import PartyCapture from './capture/PartyCapture'

function App(): React.JSX.Element {
  return (
    <AuthBridge
      api={window.auth}
      home={
        <>
          <ManualSearch api={window.manualSearch} />
          <ExampleSection title="화면 캡처">
            <PartyCapture />
          </ExampleSection>
        </>
      }
    />
  )
}

export default App
