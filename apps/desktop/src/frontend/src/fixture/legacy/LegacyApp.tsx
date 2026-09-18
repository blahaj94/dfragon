import { LoginPage } from '../../pages/login/LoginPage'
import { HomePage } from '../../pages/home/HomePage'

export function LegacyApp(): React.JSX.Element {
  return <LoginPage api={window.auth} home={<HomePage />} />
}
