import { authNotices } from '../../constants/auth'
import { SupportingText } from '@ldb/ui'
import type { AuthPresentationProps } from '../../types/auth'
import { AuthPhaseContent } from './AuthPhaseContent'

export function AuthPresentation(props: AuthPresentationProps): React.JSX.Element {
  const { notice } = props.snapshot
  const hasNotice = notice != null
  return (
    <>
      <AuthPhaseContent {...props} />
      {hasNotice && (
        <div role="status">
          <SupportingText>{authNotices[notice]}</SupportingText>
        </div>
      )}
    </>
  )
}
