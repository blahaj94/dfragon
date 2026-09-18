import { ExampleSection } from '@ldb/ui'
import { ManualSearch } from '../../sections/search/ManualSearch'
import PartyCapture from '../../sections/capture/PartyCapture'

export function HomePage(): React.JSX.Element {
  return (
    <>
      <ManualSearch api={window.manualSearch} />
      <ExampleSection title="화면 캡처">
        <PartyCapture />
      </ExampleSection>
    </>
  )
}
