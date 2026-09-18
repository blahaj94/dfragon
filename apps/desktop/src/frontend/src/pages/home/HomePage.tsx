import { ExampleSection } from '@ldb/ui'
import { ManualSearch } from '../../sections/ManualSearch'
import PartyCapture from '../../sections/PartyCapture'

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
