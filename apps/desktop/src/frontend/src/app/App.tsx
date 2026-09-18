import { LoginPage } from './pages/login/LoginPage'
import { HomePage } from './pages/home/HomePage'

function App(): React.JSX.Element {
  return <LoginPage api={window.auth} home={<HomePage />} />
}

export default App
