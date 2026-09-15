import { BrowserRouter } from 'react-router-dom'
import { AppRouter } from './router'
import { AuthProvider } from './context/AuthContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { ToastProvider } from './context/ToastContext'

export default function App() {
  return (
    <BrowserRouter>
      <PreferencesProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </PreferencesProvider>
    </BrowserRouter>
  )
}
