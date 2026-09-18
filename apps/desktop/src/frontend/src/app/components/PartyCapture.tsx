import { CaptureControls } from '../../features/capture/components/CaptureControls'
import { SearchResults } from '../../features/search/components/SearchResults'
import { usePartyCapture } from '../hooks/usePartyCapture'

function PartyCapture(): React.JSX.Element {
  const capture = usePartyCapture()
  return (
    <CaptureControls
      {...capture}
      ready={capture.search.ready}
      active={capture.search.captureActive}
    >
      <SearchResults view={capture.search} retry={capture.retrySearch} editing={capture.search} />
    </CaptureControls>
  )
}

export default PartyCapture
