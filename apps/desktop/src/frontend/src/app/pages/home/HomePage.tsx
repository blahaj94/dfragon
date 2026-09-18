import { ExampleSection } from '@ldb/ui'
import { ManualSearch } from '../../../features/search/components/ManualSearch'
import PartyCapture from '../../components/PartyCapture'

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
